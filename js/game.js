'use strict';
/* =============================================================================
   Zizzy — engine: fixed 50 Hz simulation, tile collision, dialogs, rendering.
   Each level brings its world (world.js, world2.js) and its puzzle logic
   (level1.js, level2.js); the engine calls the level's hooks:
     init(S)                 its flags and moving parts in a fresh state
     blocked(room,row,col)   a tile that puzzle state puts over the map, or null
     support(x,yb,climbing)  'crate' when a moving platform carries Zizzy there
     conveyor()              x speed a moving floor adds while Zizzy stands on it
     hazards                 [{ room, x0..y1, active(), sfx, msg }]
     tick()                  per-step world animation (runs during dialogs too)
     use(at, cx, cy)         USE next to something; true when it handled it
     decor[room](g)          static scenery, drawn once into the room layer
     draw(), overlay()       moving scenery under / over Zizzy
     drawPlayer()            true when the level draws Zizzy itself (an ending)
     intro, wonBanner        text keys; onWonUse() after the ending
   ============================================================================= */
(function () {
  const { COLS, ROWS, TILE, TOP } = window.ZIZZY_WORLD;
  const WORLDS = window.ZIZZY_WORLDS, LOGIC = window.ZIZZY_LEVELS;
  const I18N = window.ZIZZY_I18N, T = I18N.T;
  // a text in the current language, resolved when it is drawn, so switching EN/RU
  // also changes a dialog or speech bubble that is already on screen
  const L = (key, vars) => () => T(key, vars);
  const itemName = id => T('item.' + id);
  const W = 256, H = 192, FIELD_H = ROWS * TILE;
  const TICK_MS = 20;                                   // 50 updates per second, on any display
  const PH = { W: 10, H: 18, WALK: 1.4, AIR: 1.0, ROLL: 1.6, JUMP: 4.2, G: 0.24, MAXFALL: 5, CLIMB: 1.2 };

  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const ART = buildArt();
  const sound = new Beeper();

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let S;
  // the level being played: its world data and its logic (hooks)
  let LV, WORLD, ROOMS, SPARKS;
  const LEVELS = [];
  function newState(level) {
    LV = LEVELS[level]; WORLD = LV.world; ROOMS = WORLD.rooms; SPARKS = WORLD.sparks;
    const START = WORLD.start;
    S = {
      level, tick: 0, room: START.room, lives: 3, sparks: 0, got: {},
      inv: [null, null], slot: 0,
      items: WORLD.items.map(i => ({ ...i })),
      flags: { won: false, wonTick: 0 },
      crateX: 0, crateV: 0,
      dialog: null, speech: null, restartArmed: 0, levelArmed: 0,
      p: { x: START.x, y: START.y, vx: 0, vy: 0, face: 1, ground: true, support: 'solid', roll: false, rollA: 0,
        carry: 0, climb: false, ladX: 0, walkT: 0, climbT: 0, dead: false },
      safe: { room: START.room, x: START.x, y: START.y }
    };
    LV.init(S);
    return S;
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
    // puzzle state that changes the map (a shut trapdoor, a robot in the way, a lowered ladder)
    const b = LV.blocked(r.id, row, col);
    return b || r.grid[row][col];
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
    return climbing ? null : LV.support(x, yb);
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
  // Hazards (the level's list: zone = always-unsafe area, active() = currently deadly)
  // ---------------------------------------------------------------------------
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
    moveX(p.vx + (p.ground ? 0 : p.carry) + (riding ? S.crateV : 0) + (p.ground && LV.conveyor ? LV.conveyor() : 0));
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
    for (const h of LV.hazards) {
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
      if (s.room !== S.room || !sparkShown(s)) continue;
      if (Math.abs(s.x - p.x) < 8 && s.y + 4 > p.y - PH.H && s.y - 4 < p.y + 2) collectSpark(s);
    }
  }

  // a spark lying in the room right now (not one a puzzle hands over, or one still hidden)
  const sparkShown = s => !S.got[s.id] && !s.grate && !s.given && (!s.when || S.flags[s.when]);
  function collectSpark(s) {
    S.got[s.id] = true;
    S.sparks++;
    sound.spark();
    say(L('spark', { n: S.sparks }));
  }

  function die(msg, sfx) {
    S.lives--;
    sound[sfx]();
    S.p.dead = true;
    const last = S.lives <= 0;
    const lives = S.lives;
    showDialog(() => msg() + (last ? '' : '\n\n' + T('livesLeft', { n: lives })), () => {
      if (last) showDialog(L('gameOver'), restart);
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
  // text: a string or a function returning one (resolved in the current language when read)
  const textOf = src => (typeof src === 'function' ? src() : src);
  function showDialog(text, onClose) { S.dialog = { src: text, get text() { return textOf(this.src); }, shown: 0, onClose: onClose || null }; }
  /** A question with answers to pick (↑/↓ or ←/→, then USE; or tap one): onChoose(index).
      Nothing is picked at first, so USE pressed to hurry the text never answers by accident. */
  function ask(text, choices, onChoose) {
    showDialog(text, null);
    Object.assign(S.dialog, { choices, sel: -1, onChoose });
  }
  function say(text, ticks = 110) { S.speech = { src: text, get text() { return textOf(this.src); }, t: ticks }; }

  function advanceDialog() {
    const d = S.dialog;
    if (d.shown < d.text.length) { d.shown = d.text.length; return; }
    if (d.choices && d.sel < 0) return;                 // pick an answer first
    S.dialog = null;
    if (d.choices) { sound.pickup(); d.onChoose(d.sel); return; }
    if (d.onClose) d.onClose();
  }
  function chooseAnswer(i) {
    const d = S.dialog;
    if (!d || !d.choices || d.shown < d.text.length) return;
    if (d.sel !== i) { d.sel = i; sound.blip(); }
  }

  const has = id => S.inv.includes(id);
  function takeItem(id) { const i = S.inv.indexOf(id); if (i >= 0) S.inv[i] = null; updateHud(); }
  /** Hand Zizzy an item in place of one (or into a free hand); false when both hands are full. */
  function giveItem(id, insteadOf) {
    let i = insteadOf ? S.inv.indexOf(insteadOf) : -1;
    if (i < 0) i = S.inv.indexOf(null);
    if (i < 0) return false;
    S.inv[i] = id; S.slot = i; updateHud();
    return true;
  }

  const itemUnder = p => S.items.find(it => it.room === S.room && Math.abs(it.x - p.x) < 10 && Math.abs(it.y - p.y) < 6);

  function pickOrDrop() {
    const p = S.p;
    const near = itemUnder(p);
    if (near && !p.climb) {
      const free = S.inv[S.slot] === null ? S.slot : S.inv.indexOf(null);
      if (free < 0) { say(L('handsFull')); return; }
      S.inv[free] = near.id; S.slot = free;
      S.items.splice(S.items.indexOf(near), 1);
      sound.pickup();
      const got = near.id; say(() => T('got', { item: itemName(got) }));
      updateHud();
      return;
    }
    const held = S.inv[S.slot];
    if (!held) { say(L('nothingToPick')); return; }
    if (!p.ground || p.climb || p.support === 'crate') { say(L('cantDrop')); return; }
    S.items.push({ id: held, room: S.room, x: Math.round(p.x), y: p.y });
    S.inv[S.slot] = null;
    sound.drop();
    say(() => T('dropped', { item: itemName(held) }));
    updateHud();
  }

  // ---------------------------------------------------------------------------
  // Puzzles: USE checks what Zizzy is standing next to
  // ---------------------------------------------------------------------------
  function use() {
    const p = S.p, cx = p.x, cy = p.y - 9;
    const at = (x0, x1, y0, y1) => cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
    // a thing lying right at Zizzy's feet is the closest point of interest: say what it is
    const near = !p.climb && itemUnder(p);
    if (near) { const id = near.id; showDialog(() => T('look.' + id) + '\n\n' + T('look.pick')); return; }
    if (LV.use(at, cx, cy)) return;
    const held = S.inv[S.slot];
    say(held ? () => T('holding', { item: itemName(held) }) : L('nothingToDo'));
  }

  function win(key) {
    S.flags.won = true;
    S.flags.wonTick = S.tick;
    sound.victory();
    const secs = Math.round(S.tick / 50), t = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    showDialog(L(key, { t }));
  }

  // start a level afresh (restart, game over, the next level, the level button)
  function startLevel(level) {
    newState(level);
    try { localStorage.setItem('zizzy-level', String(level + 1)); } catch (e) { /* storage blocked */ }
    updateHud();
    intro();
  }
  const restart = () => startLevel(S.level);

  function intro() {
    showDialog(L(LV.intro));
    S.dialog.intro = true;
  }

  // the start screen: choose a level (the one played last is picked already, so USE starts it)
  function menu(level) {
    newState(level);
    updateHud();
    ask(L('menu.title'), LEVELS.map((_, i) => L('menu.l' + (i + 1))), i => startLevel(i));
    Object.assign(S.dialog, { sel: level, intro: true, menu: true });
  }

  // ---------------------------------------------------------------------------
  // Fixed-step update
  // ---------------------------------------------------------------------------
  function handleAction(a) {
    if (a === 'mute') { sound.toggleMute(); updateHud(); return; }
    if (a === 'lang') { I18N.toggle(); return; }
    if (a === 'restart') {
      if (S.restartArmed > 0) { restart(); return; }
      S.restartArmed = 100; say(L('restartPrompt'));
      return;
    }
    if (a === 'level') {
      // the other level; asks once unless nothing has happened yet (the intro, or the ending)
      const other = (S.level + 1) % LEVELS.length;
      if (S.levelArmed > 0 || S.flags.won || S.tick < 2 || (S.dialog && S.dialog.intro)) { startLevel(other); return; }
      S.levelArmed = 100; S.dialog = null; say(L('levelPrompt', { n: other + 1 }));
      return;
    }
    if (S.dialog && S.dialog.choices && (a === 'slot0' || a === 'slot1')) { chooseAnswer(Number(a.slice(-1))); return; }
    if (a === 'slot0' || a === 'slot1' || a === 'slot') {
      S.slot = a === 'slot' ? 1 - S.slot : Number(a.slice(-1));
      updateHud();
      return;
    }
    if (S.dialog) { if (a === 'use' || a === 'pick') advanceDialog(); return; }
    if (S.flags.won) { if (a === 'use') LV.onWonUse(); return; }
    if (a === 'use') use();
    if (a === 'pick') pickOrDrop();
  }

  function update() {
    while (actions.length) handleAction(actions.shift());
    S.tick++;
    if (S.restartArmed > 0) S.restartArmed--;
    if (S.levelArmed > 0) S.levelArmed--;

    // the world keeps moving even while a dialog is open
    LV.tick();

    if (S.dialog) {
      const d = S.dialog;
      if (d.shown < d.text.length) { d.shown = Math.min(d.text.length, d.shown + 2); if (S.tick % 3 === 0) sound.blip(); }
      // answers: up/left = the first, down/right = the second
      else if (d.choices) { if (input.up || input.left) chooseAnswer(0); else if (input.down || input.right) chooseAnswer(1); }
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
    const key = S.level + ':' + rid;
    if (layers[key]) return layers[key];
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
    LV.decor[rid](g);
    layers[key] = c;
    return c;
  }

  function cobweb(g, x, y, dir) {
    for (let i = 0; i < 12; i++) { px(g, 'w', x + dir * i, y); px(g, 'w', x, y + i); }
    for (let i = 0; i < 9; i++) px(g, 'w', x + dir * (8 - i), y + i);
    for (let i = 0; i < 5; i++) px(g, 'w', x + dir * (4 - i), y + i);
  }

  function drawWorld() {
    const t = S.tick;
    LV.draw();
    for (const it of S.items) if (it.room === S.room) { const img = ART.items[it.id]; ctx.drawImage(img, Math.round(it.x - img.width / 2), it.y - img.height); }
    for (const s of SPARKS) {
      if (s.room !== S.room || !sparkShown(s)) continue;
      ctx.drawImage(ART.spark[(t >> 3) % 2], s.x - 4, s.y - 4 + Math.round(Math.sin((t + s.x) / 10)));
    }
  }

  function drawPlayer() {
    const p = S.p, z = ART.zizzy[p.face];
    if (LV.drawPlayer && LV.drawPlayer()) return;
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
    drawTextCentered(ctx, T(LV.roomKey + S.room), 128, 4, PAL.Y);
    ctx.drawImage(ART.spark[0], 222, 4);
    drawText(ctx, `${S.sparks}/${SPARKS.length}`, 230, 4, PAL.W);
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
    // answers: wrapped to 26 characters after a 2-character marker, a gap above each
    const answers = (d.choices || []).map(c => wrapText(textOf(c), 26));
    const extra = answers.reduce((n, a) => n + a.length * 9 + 4, answers.length ? 4 : 0);
    const h = all.length * 9 + 22 + extra, y = Math.max(TOP + 1, Math.round(TOP + (H - TOP - h) / 2));
    px(ctx, 'K', 8, y, 240, h); ctx.strokeStyle = PAL.Y; ctx.lineWidth = 2; ctx.strokeRect(9, y + 1, 238, h - 2);
    lines.forEach((l, i) => drawTextCentered(ctx, l, 128, y + 7 + i * 9, PAL.W));
    const done = d.shown >= d.text.length;
    if (answers.length) {
      d.rows = [];
      let ay = y + 7 + all.length * 9 + 4;
      answers.forEach((a, i) => {
        const on = d.sel === i, top = ay - 2;
        if (done) {
          if (on) px(ctx, 'b', 14, top, 228, a.length * 9 + 2);
          a.forEach((l, k) => drawText(ctx, (k ? '  ' : on ? '> ' : '- ') + l, 18, ay + k * 9, on ? PAL.Y : PAL.w));
        }
        d.rows.push([top, ay + a.length * 9 + 2]);
        ay += a.length * 9 + 4;
      });
    }
    if (done && S.tick % 40 < 28) drawTextCentered(ctx, T(answers.length ? 'answer' : 'next'), 128, y + h - 12, PAL.C);
  }

  function render() {
    ctx.drawImage(roomLayer(S.room), 0, 0);
    drawWorld();
    drawPlayer();
    if (LV.overlay) LV.overlay();
    drawStatus();
    if (S.speech && !S.dialog) drawSpeech();
    if (S.dialog) drawDialog();
    else if (S.flags.won) {
      px(ctx, 'K', 28, 22, 200, 13);
      drawTextCentered(ctx, T(LV.wonBanner), 128, 25, (S.tick >> 4) % 2 ? PAL.W : PAL.Y);
    }
  }

  // ---------------------------------------------------------------------------
  // HUD below the screen
  // ---------------------------------------------------------------------------
  const $ = id => document.getElementById(id);
  function updateHud() {
    for (const i of [0, 1]) {
      const el = $('slot' + i), id = S.inv[i];
      el.textContent = id ? itemName(id) : T('html.empty');
      el.classList.toggle('active', S.slot === i);
      el.classList.toggle('empty', !id);
    }
    $('mute').textContent = T(sound.muted ? 'html.soundOff' : 'html.soundOn');
    for (const sp of $('level').querySelectorAll('[data-v]')) sp.classList.toggle('on', Number(sp.dataset.v) === S.level);
    for (const sp of $('lang').querySelectorAll('[data-l]')) sp.classList.toggle('on', sp.dataset.l === I18N.lang);
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
  const ACTIONKEYS = { Space: 'use', Enter: 'use', KeyE: 'pick', KeyG: 'pick', Tab: 'slot', Digit1: 'slot0', Digit2: 'slot1', KeyM: 'mute', KeyL: 'lang', KeyR: 'restart', KeyN: 'level' };

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
  canvas.addEventListener('pointerdown', e => {
    sound.unlock();
    const d = S.dialog;
    if (!d) return;
    // a tap on an answer picks it; anywhere else is USE
    if (d.choices && d.rows && d.shown >= d.text.length) {
      const r = canvas.getBoundingClientRect(), y = (e.clientY - r.top) * H / r.height;
      const i = d.rows.findIndex(([y0, y1]) => y >= y0 && y <= y1);
      if (i >= 0) { chooseAnswer(i); actions.push('use'); return; }
      return;
    }
    actions.push('use');
  });

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

  // page texts: data-i18n (text), data-i18n-html (markup), data-i18n-aria (label)
  function applyPage() {
    document.documentElement.lang = I18N.lang;
    document.title = T('html.title');
    for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = T(el.dataset.i18n);
    for (const el of document.querySelectorAll('[data-i18n-html]')) el.innerHTML = T(el.dataset.i18nHtml);
    for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', T(el.dataset.i18nAria));
  }
  I18N.onChange(() => { for (const k in layers) delete layers[k]; applyPage(); updateHud(); render(); });

  // what the levels may use
  const E = {
    get S() { return S; }, input, sound, ART, T, L, PH, TILE, TOP, COLS, ROWS, W, H,
    get ctx() { return ctx; }, px, tileImg, cobweb, drawText, drawTextCentered,
    say, showDialog, ask, has, takeItem, giveItem, collectSpark, win,
    nextLevel: () => startLevel((S.level + 1) % LEVELS.length), restart
  };
  WORLDS.forEach((world, i) => LEVELS.push({ world, ...LOGIC[i](E) }));

  // ?level=2 in the address starts that level (links, embeds); otherwise the start screen
  // offers both, with the one played last picked
  let last = 0, asked = 0;
  try { last = Number(localStorage.getItem('zizzy-level')) - 1; } catch (e) { /* storage blocked */ }
  try { asked = Number(new URLSearchParams(location.search).get('level')); } catch (e) { /* no location */ }
  if (LEVELS[asked - 1]) startLevel(asked - 1);
  else menu(LEVELS[last] ? last : 0);
  applyPage();
  render();
  requestAnimationFrame(frame);

  // Automation hooks used by the test suite (and handy in the console)
  window.zizzy = {
    get state() { return S; },
    get world() { return WORLD; },
    level: n => startLevel(n - 1),
    menu: () => menu(S.level),
    manual(on) { manual = on; acc = 0; lastTime = performance.now(); },
    setKeys(k) { releaseAll(); Object.assign(input, k); },
    press(a) { actions.push(a); },
    step(n = 1) { for (let i = 0; i < n; i++) update(); render(); },
    tileAt: (rid, c, r) => tileAt(rid, c, r)
  };
})();
