'use strict';
/* =============================================================================
   Zizzy — engine: fixed 50 Hz simulation, tile collision, puzzles, rendering.
   ============================================================================= */
(function () {
  const { COLS, ROWS, TILE, TOP, rooms: ROOMS, sparks: SPARKS, items: ITEM_SPAWNS, ITEM_NAMES, start: START } = window.ZIZZY_WORLD;
  const W = 256, H = 192, FIELD_H = ROWS * TILE;
  const TICK_MS = 20;                                   // 50 updates per second, on any display
  const PH = { W: 10, H: 18, WALK: 1.4, AIR: 1.0, ROLL: 1.6, JUMP: 4.2, G: 0.24, MAXFALL: 5, CLIMB: 1.2 };
  const CRATE = { y: 168, w: 24, x0: 56, span: 120 };   // the raft in the flooded tunnel
  const ARC = { period: 160, warn: 24, on: 84, x0: 88, x1: 96 };
  const ROBOT_HOME = 224, ROBOT_AWAY = 150;

  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const ART = buildArt();
  const sound = new Beeper();

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let S;
  function newState() {
    return {
      tick: 0, room: START.room, lives: 3, sparks: 0, got: {},
      inv: [null, null], slot: 0,
      items: ITEM_SPAWNS.map(i => ({ ...i })),
      flags: { steamOff: false, trapOpen: false, robotFixed: false, won: false, wonTick: 0 },
      robotX: ROBOT_HOME, crateX: CRATE.x0, crateV: 0, cratePhase: 0,
      dialog: null, speech: null, restartArmed: 0,
      p: { x: START.x, y: START.y, vx: 0, vy: 0, face: 1, ground: true, support: 'solid', roll: false, rollA: 0,
        carry: 0, climb: false, ladX: 0, walkT: 0, climbT: 0, dead: false },
      safe: { room: START.room, x: START.x, y: START.y }
    };
  }

  const input = { left: false, right: false, up: false, down: false };
  const actions = [];

  // ---------------------------------------------------------------------------
  // World queries
  // ---------------------------------------------------------------------------
  const roomAt = (gx, gy) => ROOMS.find(r => r.gx === gx && r.gy === gy) || null;
  const isSolid = ch => ch === '#' || ch === 'X';

  /** Tile at (col,row) of a room; coordinates past an edge read the neighbour. */
  function tileAt(rid, col, row) {
    let r = ROOMS[rid];
    while (col < 0 || col >= COLS || row < 0 || row >= ROWS) {
      let dx = 0, dy = 0;
      if (col < 0) { dx = -1; col += COLS; } else if (col >= COLS) { dx = 1; col -= COLS; }
      else if (row < 0) { dy = -1; row += ROWS; } else { dy = 1; row -= ROWS; }
      r = roomAt(r.gx + dx, r.gy + dy);
      if (!r) return '#';
    }
    // puzzle state that blocks the way
    if (r.id === 0 && !S.flags.trapOpen && row === 1 && (col === 22 || col === 23)) return '#';
    if (r.id === 3 && !S.flags.robotFixed && row >= 16 && row <= 19 && (col === 27 || col === 28)) return '#';
    return r.grid[row][col];
  }
  const colOf = x => Math.floor(x / TILE);
  const rowOf = y => Math.floor((y - TOP) / TILE);
  /** First tile boundary at or below y (tolerant of floating-point drift). */
  const boundaryBelow = y => TOP + Math.ceil((y - TOP) / TILE - 1e-6) * TILE;

  /** Does the player's box (feet at x,y) overlap a solid tile? */
  function boxSolid(x, y) {
    const c0 = colOf(x - PH.W / 2), c1 = colOf(x + PH.W / 2 - 0.001);
    const r0 = rowOf(y - PH.H), r1 = rowOf(y - 0.001);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (isSolid(tileAt(S.room, c, r))) return true;
    return false;
  }

  /** What would the feet stand on at height yb (a tile boundary)? */
  function supportAt(x, yb, climbing) {
    const row = Math.round((yb - TOP) / TILE);
    for (let c = colOf(x - 4); c <= colOf(x + 3.999); c++) {
      const ch = tileAt(S.room, c, row);
      if (isSolid(ch)) return 'solid';
      if (climbing) continue;
      if (ch === '=') return 'plank';
      if (ch === 'H' && tileAt(S.room, c, row - 1) !== 'H') return 'ladder';
    }
    if (!climbing && S.room === 2 && yb === CRATE.y && x + 4 > S.crateX && x - 4 < S.crateX + CRATE.w) return 'crate';
    return null;
  }

  /** Centre x of the ladder at pixel (x,y), or null. Ladders are two tiles wide. */
  function ladderX(x, y) {
    const c = colOf(x), r = rowOf(y);
    if (tileAt(S.room, c, r) !== 'H') return null;
    let c0 = c, c1 = c;
    while (tileAt(S.room, c0 - 1, r) === 'H') c0--;
    while (tileAt(S.room, c1 + 1, r) === 'H') c1++;
    return (c0 * TILE + (c1 + 1) * TILE) / 2;
  }

  // ---------------------------------------------------------------------------
  // Hazards (zone = always-unsafe area, active() = currently deadly)
  // ---------------------------------------------------------------------------
  const arcPhase = () => S.tick % ARC.period;
  const arcLive = () => { const t = arcPhase(); return t >= ARC.warn && t < ARC.on; };
  const HAZARDS = [
    { room: 0, x0: 18, x1: 38, y0: 56, y1: 176, active: () => !S.flags.steamOff, sfx: 'hurt',
      msg: "OUCH! ZIZZY'S GLASS CRACKED IN THE SCALDING STEAM!" },
    { room: 2, x0: 56, x1: 200, y0: 179, y1: 400, active: () => true, sfx: 'fizz',
      msg: 'FIZZ! ZIZZY SHORT-CIRCUITED IN THE WATER!' },
    { room: 3, x0: ARC.x0, x1: ARC.x1, y0: 32, y1: 176, active: arcLive, sfx: 'zap',
      msg: "ZAP! THE TESLA COIL BLEW ZIZZY'S FILAMENT!" }
  ];
  const hurtbox = p => ({ x0: p.x - 4, x1: p.x + 4, y0: p.y - 16, y1: p.y - 1 });
  const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

  // ---------------------------------------------------------------------------
  // Player physics
  // ---------------------------------------------------------------------------
  function moveX(dx) {
    const p = S.p, steps = Math.ceil(Math.abs(dx) / 0.5);
    for (let i = 0; i < steps; i++) {
      const nx = p.x + dx / steps;
      if (!boxSolid(nx, p.y)) { p.x = nx; continue; }
      // walk up a single 8 px step (crates, kerbs) without jumping; in the air,
      // forgive clipping a ledge corner by up to 4 px instead of dropping off it
      if (!p.climb) {
        const maxLift = p.ground ? TILE : 4;
        let lift = 1;
        while (lift <= maxLift && boxSolid(nx, p.y - lift)) lift++;
        if (lift <= maxLift) { p.y -= lift; p.x = nx; continue; }
      }
      p.vx = 0; p.carry = 0;
      return;
    }
  }

  function land(type) {
    const p = S.p;
    p.vy = 0;
    p.support = type;
    if (!p.ground) {
      p.ground = true; p.roll = false; p.rollA = 0; p.carry = 0;
      if (!p.climb) sound.land();
    }
  }

  /** Vertical move in sub-steps; lands on tile boundaries, bumps heads on solids. */
  function moveY(dy, climbing) {
    const p = S.p, steps = Math.max(1, Math.ceil(Math.abs(dy) / 0.5));
    for (let i = 0; i < steps; i++) {
      const s = dy / steps, ny = p.y + s;
      if (s > 0) {
        const yb = boundaryBelow(p.y);
        if (yb <= ny) {
          const sup = supportAt(p.x, yb, climbing);
          if (sup) { p.y = yb; land(sup); return; }
        }
        p.y = ny;
      } else if (s < 0) {
        if (boxSolid(p.x, ny)) {
          p.y = TOP + (rowOf(ny - PH.H) + 1) * TILE + PH.H;
          p.vy = 0;
          return;
        }
        p.y = ny;
      }
    }
  }

  function startClimb(lx) {
    const p = S.p;
    p.climb = true; p.ladX = lx; p.ground = false; p.roll = false; p.rollA = 0;
    p.vx = 0; p.vy = 0; p.carry = 0;
  }

  function updatePlayer() {
    const p = S.p, k = input;
    const lr = (k.right ? 1 : 0) - (k.left ? 1 : 0);

    if (p.climb) { climbStep(lr); return; }

    const ladBody = ladderX(p.x, p.y - 9);
    if (p.ground) {
      if (k.up && ladBody !== null) { startClimb(ladBody); return; }
      if (k.down && p.support === 'ladder') { const lx = ladderX(p.x, p.y + 4); if (lx !== null) { startClimb(lx); return; } }
      p.vx = lr * PH.WALK;
      if (lr) { p.face = lr; p.walkT++; } else p.walkT = 0;
      if (k.up) {
        p.carry = p.support === 'crate' ? S.crateV : 0;
        p.ground = false; p.vy = -PH.JUMP; p.roll = lr !== 0; p.rollA = 0;
        if (p.roll) p.vx = lr * PH.ROLL;
        sound.jump();
      }
    } else {
      if ((k.up || k.down) && ladBody !== null) { startClimb(ladBody); return; }
      if (p.roll) p.rollA += (Math.PI * 2) / 35;
      else { p.vx = lr * PH.AIR; if (lr) p.face = lr; }
      p.vy = Math.min(p.vy + PH.G, PH.MAXFALL);
    }

    const riding = p.ground && p.support === 'crate';
    moveX(p.vx + (p.ground ? 0 : p.carry) + (riding ? S.crateV : 0));
    if (!p.ground) moveY(p.vy, false);
    else {
      const sup = supportAt(p.x, p.y, false);
      if (sup) p.support = sup;
      else { p.ground = false; p.vy = 0; p.carry = riding ? S.crateV : 0; }
    }
  }

  function climbStep(lr) {
    const p = S.p, k = input;
    const lx = ladderX(p.x, p.y - 9) ?? ladderX(p.x, p.y - 1) ?? ladderX(p.x, p.y + 4);
    if (lx === null) { p.climb = false; return; }
    p.ladX = lx;
    p.x += Math.max(-1, Math.min(1, lx - p.x));
    const dy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    if (lr && !dy) {                       // step off the ladder sideways
      p.climb = false; p.face = lr; p.vy = 0;
      const sup = supportAt(p.x, p.y, false);
      if (sup) { p.ground = true; p.support = sup; } else p.ground = false;
      moveX(lr * PH.WALK);
      return;
    }
    if (dy) p.climbT++;
    if (dy < 0) {
      if (boxSolid(p.x, p.y - PH.CLIMB)) return;          // head against the trapdoor
      p.y -= PH.CLIMB;
      if (ladderX(p.x, p.y - 1) === null) {               // feet reached the ladder top: stand on it
        p.y = TOP + (rowOf(p.y - 1) + 1) * TILE;
        p.climb = false; p.ground = false; land('ladder');
      }
    } else if (dy > 0) {
      moveY(PH.CLIMB, true);
      if (p.ground) p.climb = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Rooms, hazards, collectables
  // ---------------------------------------------------------------------------
  function checkEdges() {
    const p = S.p, r = ROOMS[S.room];
    let dx = 0, dy = 0;
    if (p.x < 0) dx = -1; else if (p.x >= W) dx = 1;
    else if (p.y - 9 < TOP) dy = -1; else if (p.y - 9 >= TOP + FIELD_H) dy = 1;
    if (!dx && !dy) return;
    const n = roomAt(r.gx + dx, r.gy + dy);
    if (!n) { p.x = Math.max(PH.W / 2, Math.min(W - PH.W / 2, p.x)); return; }
    p.x -= dx * W;
    p.y -= dy * FIELD_H;
    S.room = n.id;
  }

  function checkHazards() {
    const p = S.p, hb = hurtbox(p);
    let unsafe = false;
    for (const h of HAZARDS) {
      if (h.room !== S.room) continue;
      if (overlaps(hb, h)) {
        unsafe = true;
        if (h.active()) { die(h.msg, h.sfx); return; }
      }
      // never record a respawn point next to an intermittent hazard
      if (overlaps({ x0: hb.x0 - 12, x1: hb.x1 + 12, y0: hb.y0, y1: hb.y1 }, h)) unsafe = true;
    }
    if (p.ground && p.support !== 'crate' && !unsafe) S.safe = { room: S.room, x: p.x, y: p.y };
  }

  function checkSparks() {
    const p = S.p;
    for (const s of SPARKS) {
      if (s.room !== S.room || S.got[s.id] || s.grate) continue;
      if (Math.abs(s.x - p.x) < 8 && s.y + 4 > p.y - PH.H && s.y - 4 < p.y + 2) collectSpark(s);
    }
  }

  function collectSpark(s) {
    S.got[s.id] = true;
    S.sparks++;
    sound.spark();
    say(`A SPARK! (${S.sparks}/5)`);
  }

  function die(msg, sfx) {
    S.lives--;
    sound[sfx]();
    S.p.dead = true;
    const last = S.lives <= 0;
    showDialog(msg + (last ? '' : `\n\nLIVES LEFT: ${S.lives}`), () => {
      if (last) showDialog("GAME OVER\n\nZIZZY'S GLOW HAS GONE OUT. PRESS USE TO TRY AGAIN.", restart);
      else respawn();
    });
  }

  function respawn() {
    const p = S.p, s = S.safe;
    S.room = s.room;
    Object.assign(p, { x: s.x, y: s.y, vx: 0, vy: 0, ground: true, support: 'solid', roll: false, rollA: 0,
      carry: 0, climb: false, dead: false });
    p.support = supportAt(p.x, p.y, false) || 'solid';
  }

  // ---------------------------------------------------------------------------
  // Dialog, speech, inventory
  // ---------------------------------------------------------------------------
  function showDialog(text, onClose) { S.dialog = { text, shown: 0, onClose: onClose || null }; }
  function say(text, ticks = 110) { S.speech = { text, t: ticks }; }

  function advanceDialog() {
    const d = S.dialog;
    if (d.shown < d.text.length) { d.shown = d.text.length; return; }
    S.dialog = null;
    if (d.onClose) d.onClose();
  }

  const has = id => S.inv.includes(id);
  function takeItem(id) { const i = S.inv.indexOf(id); if (i >= 0) S.inv[i] = null; updateHud(); }

  function pickOrDrop() {
    const p = S.p;
    const near = S.items.find(it => it.room === S.room && Math.abs(it.x - p.x) < 10 && Math.abs(it.y - p.y) < 6);
    if (near && !p.climb) {
      const free = S.inv[S.slot] === null ? S.slot : S.inv.indexOf(null);
      if (free < 0) { say('HANDS FULL! DROP SOMETHING FIRST.'); return; }
      S.inv[free] = near.id; S.slot = free;
      S.items.splice(S.items.indexOf(near), 1);
      sound.pickup();
      say('GOT ' + ITEM_NAMES[near.id]);
      updateHud();
      return;
    }
    const held = S.inv[S.slot];
    if (!held) { say('NOTHING HERE TO PICK UP.'); return; }
    if (!p.ground || p.climb || p.support === 'crate') { say("CAN'T DROP THAT HERE."); return; }
    S.items.push({ id: held, room: S.room, x: Math.round(p.x), y: p.y });
    S.inv[S.slot] = null;
    sound.drop();
    say('DROPPED ' + ITEM_NAMES[held]);
    updateHud();
  }

  // ---------------------------------------------------------------------------
  // Puzzles: USE checks what Zizzy is standing next to
  // ---------------------------------------------------------------------------
  function use() {
    const p = S.p, cx = p.x, cy = p.y - 9, f = S.flags;
    const at = (x0, x1, y0, y1) => cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;

    if (S.room === 0) {
      if (at(36, 84, 140, 180)) {
        if (f.steamOff) return showDialog('THE VALVE IS SHUT TIGHT.');
        if (!has('wrench')) return showDialog("A BIG STEAM VALVE. THE WHEEL IS STUCK FAST - YOU'LL NEED A TOOL TO TURN IT.");
        f.steamOff = true; takeItem('wrench'); sound.hiss();
        return showDialog('YOU WEDGE THE WRENCH IN THE WHEEL AND HEAVE... THE STEAM SPLUTTERS AND STOPS!\n\n(THE WRENCH IS STUCK THERE NOW.)');
      }
      if (at(168, 200, 20, 90) && p.climb) {
        if (f.trapOpen) return say('THE TRAPDOOR IS OPEN.');
        if (!has('oilcan')) return showDialog('A TRAPDOOR! ITS HINGES ARE RUSTED SOLID.');
        f.trapOpen = true; takeItem('oilcan'); sound.clank();
        return showDialog('SQUIRT, SQUIRT... THE HINGES LOOSEN AND THE TRAPDOOR SWINGS OPEN!');
      }
      if (at(160, 208, 120, 180) && !f.trapOpen) return showDialog('A LADDER UP TO A TRAPDOOR IN THE CEILING.');
    }
    if (S.room === 1 && at(56, 136, 100, 180)) return showDialog('THE OLD BOILER STILL GLOWS. IT FEEDS THE STEAM PIPE NEXT DOOR.');
    if (S.room === 2 && cy > 140 && (cx < 64 || cx > 192)) {
      return showDialog('DEEP, COLD WATER. ONE DROP AND ZIZZY WOULD SHORT-CIRCUIT! THAT CRATE LOOKS LIKE A RAFT...');
    }
    if (S.room === 3) {
      if (Math.abs(cx - S.robotX) < 26 && cy > 136) {
        if (f.robotFixed) return showDialog("'BEEP BOOP. THE ATTIC IS THROUGH THAT DOOR. GOOD LUCK, SMALL VALVE!'");
        if (!has('fuse')) {
          sound.beep();
          return showDialog("'BZZT. I AM SPROCKET. MY FUSE HAS BLOWN AND I CANNOT MOVE. NOBODY PASSES UNTIL I AM FIXED. RULES ARE RULES.'");
        }
        f.robotFixed = true;
        S.inv[S.inv.indexOf('fuse')] = 'magnet';
        updateHud(); sound.solve();
        return showDialog("YOU POP THE FUSE INTO SPROCKET'S BACK...\n\n'SYSTEMS ONLINE! THANK YOU. TAKE THIS MAGNET FROM MY TOOLBOX - IT MAY BE USEFUL.'");
      }
      if (at(72, 112, 24, 180)) return showDialog('A TESLA COIL CRACKLES ON AND OFF. WAIT FOR THE GAP!');
    }
    if (S.room === 4) {
      if (at(176, 232, 88, 124)) {
        if (S.sparks < 5) return showDialog(`AN EMPTY VALVE SOCKET! BUT THE WIRELESS IS STONE COLD. IT NEEDS 5 SPARKS TO WARM UP - YOU HAVE ${S.sparks}.`);
        return win();
      }
      if (at(24, 64, 140, 180)) {
        const s = SPARKS.find(k => k.grate);
        if (S.got[s.id]) return say('NOTHING LEFT BEHIND THE GRATE.');
        if (!has('magnet')) return showDialog('A SPARK IS STUCK BEHIND THE GRATE. THE BARS ARE TOO NARROW FOR ZIZZY.');
        collectSpark(s);
        return showDialog(`YOU DANGLE THE MAGNET THROUGH THE BARS... AND THE SPARK CLINGS TO IT! (${S.sparks}/5)`);
      }
      if (at(160, 240, 130, 180)) return showDialog("THE GRAND OLD WIRELESS. THERE'S AN EMPTY SOCKET ON TOP.");
    }
    const held = S.inv[S.slot];
    say(held ? 'HOLDING ' + ITEM_NAMES[held] : 'NOTHING TO DO HERE.');
  }

  function win() {
    S.flags.won = true;
    S.flags.wonTick = S.tick;
    sound.victory();
    const secs = Math.round(S.tick / 50), t = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    showDialog(`ZIZZY HOPS INTO THE SOCKET AND THE FIVE SPARKS LEAP INTO THE GLASS...\n\nTHE GRAND OLD WIRELESS SINGS AGAIN!\n\nTIME ${t}`);
  }

  function restart() {
    S = newState();
    updateHud();
    intro();
  }

  function intro() {
    showDialog('ZIZZY THE LITTLE VALVE HAS ROLLED OUT OF THE GRAND OLD WIRELESS AND INTO THE CELLAR!\n\nFIND 5 SPARKS AND CLIMB BACK UP TO THE ATTIC TO MAKE THE RADIO SING AGAIN.');
  }

  // ---------------------------------------------------------------------------
  // Fixed-step update
  // ---------------------------------------------------------------------------
  function handleAction(a) {
    if (a === 'mute') { sound.toggleMute(); updateHud(); return; }
    if (a === 'restart') {
      if (S.restartArmed > 0) { restart(); return; }
      S.restartArmed = 100; say('PRESS R AGAIN TO RESTART.');
      return;
    }
    if (a === 'slot0' || a === 'slot1' || a === 'slot') {
      S.slot = a === 'slot' ? 1 - S.slot : Number(a.slice(-1));
      updateHud();
      return;
    }
    if (S.dialog) { if (a === 'use' || a === 'pick') advanceDialog(); return; }
    if (S.flags.won) { if (a === 'use') restart(); return; }
    if (a === 'use') use();
    if (a === 'pick') pickOrDrop();
  }

  function update() {
    while (actions.length) handleAction(actions.shift());
    S.tick++;
    if (S.restartArmed > 0) S.restartArmed--;

    // the world keeps moving even while a dialog is open
    const before = S.crateX;
    S.cratePhase += 0.012;
    S.crateX = CRATE.x0 + (CRATE.span / 2) * (1 - Math.cos(S.cratePhase));
    S.crateV = S.crateX - before;
    if (S.flags.robotFixed && S.robotX > ROBOT_AWAY) S.robotX = Math.max(ROBOT_AWAY, S.robotX - 0.5);

    if (S.dialog) {
      const d = S.dialog;
      if (d.shown < d.text.length) { d.shown = Math.min(d.text.length, d.shown + 2); if (S.tick % 3 === 0) sound.blip(); }
      return;
    }
    if (S.speech && --S.speech.t <= 0) S.speech = null;
    if (S.flags.won) return;

    updatePlayer();
    checkEdges();
    checkHazards();
    if (!S.dialog) checkSparks();
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  const px = (g, color, x, y, w = 1, h = 1) => { g.fillStyle = PAL[color]; g.fillRect(x, y, w, h); };
  const tileCache = {};
  function tileImg(pattern, ink) { const k = pattern + ink; return tileCache[k] || (tileCache[k] = tile(pattern, ink)); }

  const layers = {};
  function roomLayer(rid) {
    if (layers[rid]) return layers[rid];
    const r = ROOMS[rid], th = r.theme;
    const c = newCanvas(W, H), g = c.getContext('2d');
    g.fillStyle = PAL.K; g.fillRect(0, 0, W, H);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const ch = r.grid[row][col], x = col * TILE, y = TOP + row * TILE;
        if (ch === '#') g.drawImage(tileImg(th.wall, (row + col) % 7 === 0 ? th.ink.toUpperCase() : th.ink), x, y);
        else if (ch === 'X') g.drawImage(tileImg('crate', th.block), x, y);
        else if (ch === '=') g.drawImage(tileImg('plank', th.plank), x, y);
        else if (ch === 'H') g.drawImage(tileImg('ladder', th.ladder), x, y);
        else if (ch === 'p') g.drawImage(tileImg('pipeH', th.pipe), x, y);
        else if (ch === 'i') g.drawImage(tileImg('pipeV', th.pipe), x, y);
      }
    }
    DECOR[rid](g);
    layers[rid] = c;
    return c;
  }

  function cobweb(g, x, y, dir) {
    for (let i = 0; i < 12; i++) { px(g, 'w', x + dir * i, y); px(g, 'w', x, y + i); }
    for (let i = 0; i < 9; i++) px(g, 'w', x + dir * (8 - i), y + i);
    for (let i = 0; i < 5; i++) px(g, 'w', x + dir * (4 - i), y + i);
  }

  // Static scenery, drawn once per room into its cached layer
  const DECOR = {
    0(g) {
      cobweb(g, 8, 32, 1); cobweb(g, 247, 32, -1);
      // bulb on a flex
      px(g, 'w', 120, 32, 1, 10); px(g, 'w', 118, 42, 5, 2); px(g, 'y', 118, 44, 5, 4); px(g, 'Y', 119, 45, 2, 2);
      // jars on the high shelf
      for (const [x, ink] of [[100, 'G'], [108, 'M'], [138, 'C']]) { px(g, ink, x, 105, 5, 7); px(g, 'W', x + 1, 103, 3, 2); }
      // hatch frame around the trapdoor
      px(g, 'y', 172, 32, 24, 1);
    },
    1(g) {
      // the boiler, drawn over its block tiles
      px(g, 'K', 64, 120, 64, 56); px(g, 'r', 66, 122, 60, 54); px(g, 'R', 70, 122, 6, 54);
      for (let y = 126; y < 176; y += 10) { px(g, 'Y', 68, y); px(g, 'Y', 123, y); }
      px(g, 'W', 90, 128, 14, 12); px(g, 'K', 92, 130, 10, 8); px(g, 'R', 96, 132, 1, 4); px(g, 'R', 97, 132, 3, 1);
      px(g, 'K', 76, 160, 40, 16); px(g, 'y', 76, 160, 40, 2);
      cobweb(g, 247, 32, -1);
    },
    2(g) {
      // stalactites under the tunnel roof
      for (let x = 12; x < 248; x += 23) { const h = 3 + (x % 5); for (let i = 0; i < h; i++) px(g, 'c', x + (i >> 1), 64 + i, 2, 1); }
      px(g, 'Y', 12, 128, 34, 18); px(g, 'K', 14, 130, 30, 14); drawText(g, 'DEEP', 13, 133, PAL.Y);
      px(g, 'w', 28, 146, 2, 30);
    },
    3(g) {
      // pegboard with tools
      px(g, 'r', 120, 64, 48, 24);
      for (let y = 68; y < 88; y += 6) for (let x = 124; x < 168; x += 6) px(g, 'K', x, y);
      px(g, 'W', 126, 70, 2, 12); px(g, 'W', 123, 70, 8, 3);     // hammer
      px(g, 'C', 138, 72, 14, 2); px(g, 'C', 138, 72, 2, 8);     // square
      px(g, 'Y', 158, 70, 2, 14);                               // screwdriver
      // workbench top and vice
      px(g, 'y', 16, 160, 32, 2);
      px(g, 'w', 24, 154, 12, 6); px(g, 'W', 30, 150, 2, 4);
      // tesla coil emitters
      px(g, 'w', 86, 32, 12, 3); px(g, 'C', 90, 35, 4, 5);
      px(g, 'w', 86, 168, 12, 8); px(g, 'C', 90, 164, 4, 4);
      // sign by the door
      px(g, 'R', 212, 118, 38, 13); px(g, 'K', 214, 120, 34, 9); drawText(g, 'STOP', 215, 121, PAL.W);
      // hatch in the floor
      px(g, 'y', 172, 176, 24, 1);
    },
    4(g) {
      // window with moon and stars
      px(g, 'm', 72, 40, 32, 24); px(g, 'b', 74, 42, 28, 20);
      px(g, 'W', 90, 46, 6, 6); px(g, 'b', 92, 46, 4, 4);
      for (const [x, y] of [[78, 46], [84, 56], [98, 58], [80, 52]]) px(g, 'W', x, y);
      px(g, 'm', 87, 42, 2, 20); px(g, 'm', 74, 51, 28, 2);
      cobweb(g, 56, 32, 1);
      // the grand wireless (over its block tiles)
      px(g, 'K', 176, 120, 56, 56); px(g, 'y', 178, 122, 52, 52); px(g, 'r', 182, 126, 44, 26);
      for (let y = 128; y < 150; y += 3) px(g, 'y', 184, y, 40, 1);
      px(g, 'K', 186, 156, 36, 10); px(g, 'C', 188, 158, 32, 6); px(g, 'R', 204, 157, 1, 8);
      px(g, 'W', 184, 168, 6, 4); px(g, 'W', 218, 168, 6, 4);
      // empty valve socket on top
      px(g, 'w', 198, 116, 12, 4); px(g, 'K', 200, 117, 8, 2);
    }
  };

  function drawWorld() {
    const t = S.tick, f = S.flags;
    if (S.room === 0) {
      // valve wheel (with the wrench left in it once used)
      px(ctx, 'R', 50, 154, 12, 2); px(ctx, 'R', 50, 164, 12, 2); px(ctx, 'R', 48, 156, 2, 8); px(ctx, 'R', 62, 156, 2, 8);
      px(ctx, 'R', 55, 156, 2, 8); px(ctx, 'R', 50, 159, 12, 2); px(ctx, 'w', 55, 145, 2, 9);
      if (f.steamOff) ctx.drawImage(ART.items.wrench, 52, 150);
      else {
        // a plume that widens as it falls from the nozzle
        for (let i = 0; i < 34; i++) {
          const y = 56 + ((i * 29 + t * 3) % 120), spread = 2 + ((y - 56) >> 4);
          const x = 27 - spread + ((i * 7 + (t >> 1)) % (spread * 2 + 1));
          px(ctx, i % 4 ? 'W' : 'C', x, y, i % 3 ? 2 : 3, i % 3 ? 2 : 3);
        }
      }
      if (f.trapOpen) { px(ctx, 'y', 196, 24, 3, 22); px(ctx, 'Y', 197, 26, 1, 18); }
      else { px(ctx, 'y', 176, 24, 16, 8); for (let x = 176; x < 192; x += 4) px(ctx, 'K', x, 24, 1, 8); px(ctx, 'W', 177, 27, 2, 2); }
    } else if (S.room === 1) {
      const glow = (t >> 2) % 3;
      px(ctx, glow ? 'R' : 'Y', 80, 166, 32, 8);
      for (let i = 0; i < 6; i++) px(ctx, (i + glow) % 2 ? 'Y' : 'R', 82 + i * 5, 164 - ((t + i * 3) % 4), 2, 2);
    } else if (S.room === 2) {
      const water = tileImg((t >> 3) % 2 ? 'water0' : 'water1', 'B');
      for (let c = 7; c <= 24; c++) ctx.drawImage(water, c * TILE, TOP + 20 * TILE);
      const x = Math.round(S.crateX);
      px(ctx, 'y', x, CRATE.y, CRATE.w, 8); px(ctx, 'Y', x, CRATE.y, CRATE.w, 1);
      for (let i = 4; i < CRATE.w; i += 8) px(ctx, 'r', x + i, CRATE.y + 2, 1, 6);
    } else if (S.room === 3) {
      const ph = arcPhase();
      if (ph < ARC.warn) { if (t % 6 < 3) { px(ctx, 'C', 91, 40 + (t % 5), 2, 2); px(ctx, 'C', 92, 160 - (t % 7), 2, 2); } }
      else if (ph < ARC.on) {
        let x = 92;
        for (let y = 40; y < 164; y += 4) {
          const nx = 90 + ((y * 7 + t * 5) % 5);
          px(ctx, t % 2 ? 'W' : 'C', Math.min(x, nx), y, Math.abs(nx - x) + 1, 1);
          px(ctx, 'C', nx, y, 1, 4); x = nx;
        }
      }
      ctx.drawImage(f.robotFixed ? ART.robotFixed : ART.robotBroken, Math.round(S.robotX) - 8, 156);
      if (!f.robotFixed && t % 50 < 25) px(ctx, 'R', Math.round(S.robotX) - 1, 156, 2, 1);
    } else if (S.room === 4) {
      const s = SPARKS.find(k => k.grate);
      if (!S.got[s.id]) ctx.drawImage(ART.spark[(t >> 3) % 2], s.x - 4, s.y - 6);
      px(ctx, 'w', 34, 158, 22, 2); for (let x = 34; x <= 54; x += 4) px(ctx, 'w', x, 158, 2, 18);
      if (f.won) {
        px(ctx, (t >> 3) % 2 ? 'C' : 'G', 188, 158, 32, 6);
        for (let i = 0; i < 4; i++) {
          const nx = 170 + i * 22 + Math.round(Math.sin((t + i * 20) / 8) * 4), ny = 100 - ((t + i * 17) % 50);
          const ink = ['Y', 'C', 'M', 'G'][i];
          px(ctx, ink, nx, ny, 3, 3); px(ctx, ink, nx + 2, ny - 6, 1, 6);
        }
      }
    }
    for (const it of S.items) if (it.room === S.room) { const img = ART.items[it.id]; ctx.drawImage(img, Math.round(it.x - img.width / 2), it.y - img.height); }
    for (const s of SPARKS) {
      if (s.room !== S.room || S.got[s.id] || s.grate) continue;
      ctx.drawImage(ART.spark[(t >> 3) % 2], s.x - 4, s.y - 4 + Math.round(Math.sin((t + s.x) / 10)));
    }
  }

  function drawPlayer() {
    const p = S.p, z = ART.zizzy[p.face];
    if (S.flags.won && S.room === 4) {
      ctx.drawImage(z.stand, 198, 98);
      if (S.tick % 8 < 4) px(ctx, 'W', 203, 101, 2, 2);
      return;
    }
    if (p.dead && S.tick % 10 < 5) return;
    const x = Math.round(p.x), y = Math.round(p.y);
    if (p.roll) {
      const i = ((Math.round((p.rollA / (Math.PI * 2)) * 16) % 16) + 16) % 16;
      ctx.drawImage(ART.zizzy.roll[p.face][i], x - 12, y - 9 - 12);
      return;
    }
    let img = z.stand;
    if (p.climb) img = (p.climbT >> 3) % 2 ? z.stepA : z.stepB;
    else if (p.ground && p.vx) img = [z.stepA, z.stand, z.stepB, z.stand][(p.walkT >> 2) % 4];
    else if (!p.ground) img = z.stepA;
    ctx.drawImage(img, x - 6, y - PH.H);
  }

  function drawStatus() {
    ctx.fillStyle = PAL.K; ctx.fillRect(0, 0, W, TOP);
    for (let i = 0; i < S.lives; i++) ctx.drawImage(ART.life, 4 + i * 8, 4);
    drawTextCentered(ctx, ROOMS[S.room].name, 128, 4, PAL.Y);
    ctx.drawImage(ART.spark[0], 222, 4);
    drawText(ctx, `${S.sparks}/5`, 230, 4, PAL.W);
    px(ctx, 'b', 0, TOP - 1, W, 1);
  }

  function drawSpeech() {
    const lines = wrapText(S.speech.text, 22), w = Math.max(...lines.map(l => l.length)) * 8 + 8, h = lines.length * 9 + 5;
    const x = Math.max(2, Math.min(W - w - 2, Math.round(S.p.x - w / 2)));
    const y = Math.max(TOP + 2, Math.round(S.p.y - PH.H - 8 - h));
    px(ctx, 'K', x, y, w, h); ctx.strokeStyle = PAL.C; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    lines.forEach((l, i) => drawTextCentered(ctx, l, x + w / 2, y + 3 + i * 9, PAL.C));
  }

  function drawDialog() {
    const d = S.dialog, lines = wrapText(d.text.slice(0, d.shown), 28), all = wrapText(d.text, 28);
    const h = all.length * 9 + 22, y = Math.round(TOP + (H - TOP - h) / 2);
    px(ctx, 'K', 8, y, 240, h); ctx.strokeStyle = PAL.Y; ctx.lineWidth = 2; ctx.strokeRect(9, y + 1, 238, h - 2);
    lines.forEach((l, i) => drawTextCentered(ctx, l, 128, y + 7 + i * 9, PAL.W));
    if (d.shown >= d.text.length && S.tick % 40 < 28) drawTextCentered(ctx, 'USE >', 128, y + h - 12, PAL.C);
  }

  function render() {
    ctx.drawImage(roomLayer(S.room), 0, 0);
    drawWorld();
    drawPlayer();
    drawStatus();
    if (S.speech && !S.dialog) drawSpeech();
    if (S.dialog) drawDialog();
    else if (S.flags.won) {
      px(ctx, 'K', 28, 22, 200, 13);
      drawTextCentered(ctx, 'PRESS USE TO PLAY AGAIN', 128, 25, (S.tick >> 4) % 2 ? PAL.W : PAL.Y);
    }
  }

  // ---------------------------------------------------------------------------
  // HUD below the screen
  // ---------------------------------------------------------------------------
  const $ = id => document.getElementById(id);
  function updateHud() {
    for (const i of [0, 1]) {
      const el = $('slot' + i), id = S.inv[i];
      el.textContent = id ? ITEM_NAMES[id] : 'EMPTY';
      el.classList.toggle('active', S.slot === i);
      el.classList.toggle('empty', !id);
    }
    $('mute').textContent = sound.muted ? 'SOUND OFF' : 'SOUND ON';
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', KeyO: 'left',
    ArrowRight: 'right', KeyD: 'right', KeyP: 'right',
    ArrowUp: 'up', KeyW: 'up', KeyQ: 'up',
    ArrowDown: 'down', KeyS: 'down'
  };
  const ACTIONKEYS = { Space: 'use', Enter: 'use', KeyE: 'pick', KeyG: 'pick', Tab: 'slot', Digit1: 'slot0', Digit2: 'slot1', KeyM: 'mute', KeyR: 'restart' };

  let acc = 0, lastTime = performance.now(), manual = false;
  const releaseAll = () => { for (const k in input) input[k] = false; };

  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const dir = KEYMAP[e.code], act = ACTIONKEYS[e.code];
    if (!dir && !act) return;
    e.preventDefault();
    sound.unlock();
    if (dir) input[dir] = true;
    if (act && !e.repeat) actions.push(act);
  });
  window.addEventListener('keyup', e => { const dir = KEYMAP[e.code]; if (dir) input[dir] = false; });
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { releaseAll(); lastTime = performance.now(); acc = 0; });

  for (const btn of document.querySelectorAll('[data-hold]')) {
    const k = btn.dataset.hold;
    const on = e => { e.preventDefault(); sound.unlock(); input[k] = true; btn.setPointerCapture?.(e.pointerId); };
    const off = e => { e.preventDefault(); input[k] = false; };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointercancel', off);
    btn.addEventListener('lostpointercapture', off);
  }
  for (const btn of document.querySelectorAll('[data-act]')) {
    btn.addEventListener('pointerdown', e => { e.preventDefault(); sound.unlock(); actions.push(btn.dataset.act); });
  }
  canvas.addEventListener('pointerdown', () => { sound.unlock(); if (S.dialog) actions.push('use'); });

  // ---------------------------------------------------------------------------
  // Main loop: fixed 50 Hz steps; draw only after the state changed
  // ---------------------------------------------------------------------------
  function frame(now) {
    if (!manual) {
      acc += Math.min(250, now - lastTime);
      lastTime = now;
      let steps = 0;
      while (acc >= TICK_MS) { update(); acc -= TICK_MS; steps++; }
      if (steps) render();
    }
    requestAnimationFrame(frame);
  }

  S = newState();
  updateHud();
  intro();
  render();
  requestAnimationFrame(frame);

  // Automation hooks used by the test suite (and handy in the console)
  window.zizzy = {
    get state() { return S; },
    world: window.ZIZZY_WORLD,
    manual(on) { manual = on; acc = 0; lastTime = performance.now(); },
    setKeys(k) { releaseAll(); Object.assign(input, k); },
    press(a) { actions.push(a); },
    step(n = 1) { for (let i = 0; i < n; i++) update(); render(); },
    tileAt: (rid, c, r) => tileAt(rid, c, r)
  };
})();
