'use strict';
/* =============================================================================
   Zizzy — level 3 "The Radio Tower": first lessons in radio, for players of
   about 7-10. Every puzzle is one idea, and every wrong try explains why:
     sound room    a drum shows that sound is a vibration; the loudspeaker
                   needs its magnet back (a coil pushes against a magnet)
     crane yard    an electromagnet is a magnet you switch on and off; it lifts
                   the iron block (not the wooden crate) to make a step
     radio room    Dot the operator robot: tap SOS in Morse code on her key
     listening     every station has its own frequency: tune the dial past
                   the hiss and a music station to the polar station's call
     roof          raise the antenna (higher reaches farther), plug in the
                   aerial cable, and wait out the lightning by the rod
   Three machines (crane, Morse key, dial) take over the arrow keys while
   Zizzy works them: the engine's busy() hook.
   Hooks for the engine (see game.js); the map is in world3.js.
   ============================================================================= */
(function (root) {
  (root.ZIZZY_LEVELS = root.ZIZZY_LEVELS || [])[2] = E => {
    const { L, px, drawText, drawTextCentered, TILE, TOP } = E;
    const S = () => E.S;
    const WORLD = root.ZIZZY_WORLDS[2], spark = id => WORLD.sparks.find(s => s.id === id);

    // crane yard: the trolley's hook runs along the beam; the iron block is 2x2 tiles
    const CRANE = { min: 64, max: 200, home: 184, top: 56, beam: 36 };
    const BLOCK0 = { col: 12, row: 18 };
    const CRATE_X = 152;                               // centre of the wooden crate (cols 18-19)
    const yard = WORLD.rooms[1].grid;
    const firm = (c, r) => '#X='.includes(yard[r][c]);
    /** Row the block's top lands on when dropped at column c (falls to the first support). */
    function landingRow(c) {
      for (let r = (CRANE.top - TOP) / TILE; r < 18; r++) if (firm(c, r + 2) || firm(c + 1, r + 2)) return r;
      return 18;
    }

    // Morse code: SOS, and how long the key is held: up to DASH ticks is a dot
    const SOS = '...---...', DASH = 12;
    const CHART = [];                                  // where each dot and dash of SOS sits on the wall chart
    const LETTERS = [];
    {
      let x = 70;
      for (const [ch, code] of [['S', '...'], ['O', '---'], ['S', '...']]) {
        const x0 = x;
        for (const c of code) { const w = c === '.' ? 4 : 12; CHART.push({ x, w }); x += w + 4; }
        LETTERS.push({ ch, cx: (x0 + x - 4) / 2 });
        x += 8;
      }
    }

    // the receiver's dial (0-100): a music station and the polar station's call
    const DIAL = { music: 30, polar: 73, near: 3, x0: 30, scale: 1.64 };

    // radio room: Dot stands in front of the roof ladder until she has heard SOS
    const DOT_HOME = 200, DOT_AWAY = 240;

    // roof: lightning hits the rod now and then; the hazard is the strike
    const BOLT = { period: 200, warn: 30, on: 70, x0: 194, x1: 206 };
    const boltPhase = () => S().tick % BOLT.period;
    const boltLive = () => { const t = boltPhase(); return t >= BOLT.warn && t < BOLT.on; };
    const MAST = { x: 104, y: 174, len: 92 };

    const ring = (g, ink, cx, cy, r, from = 0, to = Math.PI * 2) => {
      for (let a = from; a <= to; a += 0.5 / r) px(g, ink, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r));
    };

    function hintBar(key) {
      const ctx = E.ctx;
      px(ctx, 'K', 0, 180, E.W, 11);
      drawTextCentered(ctx, E.T(key), 128, 182, PAL.C);
    }
    function endMode() { const s = S(); s.mode = null; s.keyDown = false; E.sound.key(false); }

    // ---- the machines -----------------------------------------------------------
    function craneUse() {
      const s = S(), b = s.block, sound = E.sound;
      if (b.state === 'held') {                        // magnet off: the block falls to the first support
        const col = Math.max(0, Math.round((s.hookX - 8) / TILE));
        Object.assign(b, { col, row: landingRow(col), state: 'fall' });
        s.hookX = col * TILE + 8;
        sound.drop();
        return E.say(L('l3.crane.drop'));
      }
      if (b.state !== 'rest') return;
      if (Math.abs(s.hookX - (b.col * TILE + 8)) <= 6) {
        s.hookX = b.col * TILE + 8; b.state = 'grab';
        sound.clank();
        return E.say(L('l3.crane.lift'));
      }
      if (Math.abs(s.hookX - CRATE_X) <= 8) { sound.beep(); return E.showDialog(L('l3.crane.wood')); }
      E.say(L('l3.crane.empty'));
    }

    function tuneUse() {
      const s = S(), f = s.flags;
      if (Math.abs(s.dial - DIAL.polar) <= DIAL.near) {
        s.dial = DIAL.polar; f.tuned = true; endMode();
        E.collectSpark(spark('tuner')); E.sound.solve();
        return E.showDialog(L('l3.tune.done', { n: s.sparks }));
      }
      if (Math.abs(s.dial - DIAL.music) <= DIAL.near) return E.showDialog(L('l3.tune.music'));
      E.say(L('l3.tune.hiss'));
    }

    function morseTick() {
      const s = S(), down = E.input.down || E.input.up;
      if (down) {
        if (!s.keyDown) { s.keyDown = true; s.keyT = 0; E.sound.key(true); }
        s.keyT++;
        return;
      }
      if (!s.keyDown) return;
      s.keyDown = false; E.sound.key(false);
      const sym = s.keyT > DASH ? '-' : '.', want = SOS[s.morse.length];
      if (sym !== want) {
        s.morse = ''; E.sound.beep();
        return E.say(L(want === '.' ? 'l3.morse.wantDot' : 'l3.morse.wantDash'), 160);
      }
      s.morse += sym;
      if (s.morse !== SOS) return;
      const f = s.flags;
      f.dotDone = true; endMode();
      E.collectSpark(spark('dot')); E.sound.solve();
      if (!E.giveItem('coax')) s.items.push({ id: 'coax', room: 2, x: Math.round(s.p.x) - 14, y: 176 });
      E.showDialog(L('l3.morse.done', { n: s.sparks }));
    }

    function tuneSounds() {
      const s = S(), t = s.tick, sound = E.sound;
      if (t % 8) return;
      const dm = Math.abs(s.dial - DIAL.music), dp = Math.abs(s.dial - DIAL.polar), d = Math.min(dm, dp);
      if (d > 2 * DIAL.near) return sound.noise(0.1, { vol: Math.min(0.9, 0.25 + d / 30), lowpass: 5000 });
      if (d > DIAL.near) sound.noise(0.1, { vol: 0.25, lowpass: 5000 });
      const vol = d <= DIAL.near ? 0.8 : 0.35;
      if (dm < dp) sound.tone([523, 659, 784, 659, 587, 698, 880, 698][(t >> 3) % 8], 0.12, { vol, type: 'triangle' });
      else sound.tone(260 + ((t * 37) % 7) * 30, 0.06, { vol, type: 'sawtooth' });
    }

    return {
      roomKey: 'l3.room.', intro: 'l3.intro', wonBanner: 'playAgain',
      init(st) {
        Object.assign(st.flags, { speakerOn: false, dotDone: false, tuned: false, mastUp: false, cableOn: false });
        Object.assign(st, {
          mode: null, craneSeen: false, morseSeen: false, tuneSeen: false, roofSeen: false,
          hookX: CRANE.home, magY: CRANE.top, block: { col: BLOCK0.col, row: BLOCK0.row, y: TOP + BLOCK0.row * TILE, state: 'rest' },
          morse: '', keyDown: false, keyT: 0, dial: 0, dotX: DOT_HOME, mastA: 0, drumT: 0, boomT: 0
        });
        E.sound.key(false);
      },
      busy: () => !!S().mode,
      blocked(rid, row, col) {
        const s = S(), b = s.block;
        if (rid === 1 && b.state === 'rest' && row >= b.row && row <= b.row + 1 && col >= b.col && col <= b.col + 1) return 'X';
        if (rid === 2 && !s.flags.dotDone && row >= 16 && row <= 19 && (col === 24 || col === 25)) return '#';   // Dot
        return null;
      },
      support: () => null,
      hazards: [
        { room: 4, x0: BOLT.x0, x1: BOLT.x1, y0: 24, y1: 180, active: boltLive, sfx: 'zap', msg: L('l3.hazard.bolt') }
      ],
      tick() {
        const s = S(), f = s.flags, b = s.block, input = E.input, sound = E.sound;
        // the crane's magnet goes down to the block, then both rise; a dropped block falls
        if (b.state === 'grab') { s.magY = Math.min(b.y, s.magY + 3); if (s.magY >= b.y) b.state = 'lift'; }
        else if (b.state === 'lift') { b.y = Math.max(CRANE.top, b.y - 2); s.magY = b.y; if (b.y <= CRANE.top) b.state = 'held'; }
        else if (b.state === 'fall') {
          const yb = TOP + b.row * TILE;
          b.y = Math.min(yb, b.y + 3);
          if (b.y >= yb) { b.state = 'rest'; if (s.room === 1) sound.land(), sound.clank(); }
        }
        if (b.state !== 'grab' && b.state !== 'lift') s.magY = CRANE.top;
        if (f.dotDone && s.dotX < DOT_AWAY) s.dotX = Math.min(DOT_AWAY, s.dotX + 0.5);
        if (f.mastUp && s.mastA < 1) { s.mastA = Math.min(1, s.mastA + 1 / 120); if (s.room === 4 && s.tick % 12 === 0) sound.clank(); }
        if (s.drumT > 0) s.drumT--;
        if (s.room === 4 && boltPhase() === BOLT.warn) sound.noise(0.9, { vol: 0.8, lowpass: 700 });
        if (f.speakerOn && s.room === 0 && s.boomT > 0 && s.tick % 25 === 0) { s.boomT--; sound.tone(70, 0.1, { to: 45, vol: 0.9 }); }
        if (s.dialog || f.won) { if (s.keyDown) { s.keyDown = false; sound.key(false); } return; }
        // a thunderstorm on the roof: say so the first time
        if (s.room === 4 && !s.roofSeen && !s.p.climb) { s.roofSeen = true; E.showDialog(L('l3.roof')); return; }
        if (!s.mode) return;
        const lr = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        if (s.mode === 'morse') {
          if (lr) { endMode(); return; }
          return morseTick();
        }
        if (input.down || input.up) { endMode(); return; }
        if (s.mode === 'crane' && lr && b.state !== 'grab' && b.state !== 'lift') s.hookX = Math.max(CRANE.min, Math.min(CRANE.max, s.hookX + lr));
        if (s.mode === 'tune') {
          if (lr) s.dial = Math.max(0, Math.min(100, s.dial + lr * 0.4));
          tuneSounds();
        }
      },

      use(at, cx, cy) {
        const s = S(), p = s.p, f = s.flags, D = E.showDialog, has = E.has, sound = E.sound;
        const held = s.inv[s.slot] || s.inv[1 - s.slot];
        if (s.mode === 'crane') return craneUse(), true;
        if (s.mode === 'tune') return tuneUse(), true;
        if (s.mode === 'morse') return E.say(L('l3.morse.hint')), true;
        if (s.room === 0) {
          if (at(156, 240, 100, 180)) {
            if (f.speakerOn) return E.say(L('l3.speaker.on')), true;
            if (has('ringmagnet')) {
              f.speakerOn = true; s.boomT = 8; E.takeItem('ringmagnet'); sound.solve();
              return D(L('l3.speaker.done')), true;
            }
            return D(L(held ? 'l3.speaker.wrong' : 'l3.speaker.need')), true;
          }
          if (at(88, 136, 130, 180)) { s.drumT = 50; sound.tone(90, 0.25, { to: 50 }); return D(L('l3.drum')), true; }
        }
        if (s.room === 1) {
          if (at(208, 248, 120, 180)) {
            const go = () => { s.mode = 'crane'; };
            if (!s.craneSeen) { s.craneSeen = true; return D(L('l3.crane'), go), true; }
            return go(), true;
          }
          if (at(8, 64, 130, 180) && p.y === 176) return D(L('l3.ledge')), true;
        }
        if (s.room === 2) {
          if (Math.abs(cx - s.dotX) < 26 && cy > 136) return D(L(f.dotDone ? 'l3.dot.after' : 'l3.dot.need')), true;
          if (at(80, 160, 120, 180)) {
            if (f.dotDone) return E.say(L('l3.morse.after')), true;
            const go = () => { s.mode = 'morse'; s.morse = ''; };
            if (!s.morseSeen) { s.morseSeen = true; return D(L('l3.morse'), go), true; }
            return go(), true;
          }
        }
        if (s.room === 3) {
          if (at(16, 120, 120, 180)) {
            if (f.tuned) return E.say(L('l3.tune.after')), true;
            const go = () => { s.mode = 'tune'; };
            if (!s.tuneSeen) { s.tuneSeen = true; return D(L('l3.radio'), go), true; }
            return go(), true;
          }
        }
        if (s.room === 4) {
          if (at(112, 148, 120, 180)) {
            if (f.mastUp) return E.say(L('l3.winch.up')), true;
            f.mastUp = true; sound.clank();
            return D(L('l3.winch.done')), true;
          }
          if (at(80, 111, 120, 180)) {
            if (f.cableOn) return E.say(L('l3.mast.ok')), true;
            if (!f.mastUp) return D(L('l3.mast.flat')), true;
            if (!has('coax')) return D(L('l3.mast.need')), true;
            f.cableOn = true; E.takeItem('coax');
            E.collectSpark(spark('antenna')); sound.solve();
            return D(L('l3.mast.done', { n: s.sparks })), true;
          }
          if (at(149, 186, 120, 180)) {
            if (!f.cableOn) return D(L('l3.tx')), true;
            if (s.sparks < WORLD.sparks.length) return D(L('l3.tx.need', { n: s.sparks })), true;
            return E.win('l3.win'), true;
          }
        }
        return false;
      },
      onWonUse: () => E.restart(),

      decor: {
        0(g) {
          // a poster of the radio tower sending waves
          px(g, 'w', 72, 40, 64, 52); px(g, 'b', 74, 42, 60, 48);
          for (let i = 0; i < 34; i++) { px(g, 'W', 104 - (i >> 2), 54 + i); px(g, 'W', 104 + (i >> 2), 54 + i); }
          for (let i = 0; i < 4; i++) { const y = 62 + i * 7, hw = (y - 54) >> 2; px(g, 'W', 104 - hw, y, hw * 2 + 1, 1); }
          px(g, 'R', 103, 51, 3, 3);
          for (const r of [8, 13, 18]) { ring(g, 'C', 104, 52, r, -2.6, -2.0); ring(g, 'C', 104, 52, r, -1.15, -0.55); }
          // the drum
          px(g, 'r', 98, 158, 28, 18); px(g, 'R', 100, 158, 2, 18); px(g, 'Y', 98, 162, 28, 1); px(g, 'Y', 98, 172, 28, 1);
          px(g, 'W', 96, 156, 32, 2);
          // the loudspeaker cabinet
          px(g, 'y', 168, 88, 64, 88); px(g, 'K', 172, 92, 56, 80);
          ring(g, 'w', 200, 122, 20); ring(g, 'w', 200, 122, 19);
          px(g, 'w', 192, 156, 16, 10); px(g, 'K', 194, 158, 12, 6);
          for (let x = 195; x < 206; x += 3) px(g, 'w', x, 159, 1, 4);
        },
        1(g) {
          // the crane: a beam under the ceiling, a column and the control panel
          px(g, 'y', 56, CRANE.beam - 4, 192, 4);
          for (let x = 58; x < 246; x += 8) px(g, 'Y', x, CRANE.beam - 4, 4, 1);
          px(g, 'y', 236, CRANE.beam, 4, 96);
          px(g, 'w', 220, 132, 24, 30); px(g, 'K', 222, 134, 20, 26);
          px(g, 'R', 226, 150, 6, 6); px(g, 'w', 234, 140, 4, 14);
          // scrap on the floor and a sign over the ledge
          for (const [x, ink] of [[176, 'w'], [184, 'r'], [196, 'w']]) px(g, ink, x, 172, 6, 4);
          px(g, 'K', 70, 140, 1, 1);
        },
        2(g) {
          // the Morse chart: S O S as dots and dashes
          px(g, 'w', 62, 46, 124, 38); px(g, 'K', 64, 48, 120, 34);
          for (const c of CHART) px(g, 'w', c.x, 58, c.w, 4);
          for (const l of LETTERS) drawText(g, l.ch, l.cx - 3, 68, PAL.Y);
          // the desk and the Morse key
          px(g, 'y', 84, 152, 80, 3); px(g, 'y', 88, 155, 3, 21); px(g, 'y', 157, 155, 3, 21);
          px(g, 'w', 108, 146, 30, 6); px(g, 'K', 110, 148, 26, 2);
          px(g, 'K', 146, 142, 8, 10); px(g, 'w', 147, 143, 6, 8);
          // a set of radios on the wall
          px(g, 'r', 200, 52, 40, 24); px(g, 'K', 204, 56, 18, 16); px(g, 'C', 226, 58, 10, 4); px(g, 'w', 228, 66, 6, 6);
        },
        3(g) {
          // the dial on the wall: a long scale with ticks
          px(g, 'w', 22, 44, 180, 26); px(g, 'K', 24, 46, 176, 22);
          for (let i = 0; i <= 20; i++) px(g, 'w', DIAL.x0 + Math.round(i * 5 * DIAL.scale), 58, 1, i % 5 ? 4 : 8);
          drawText(g, '0', DIAL.x0 - 3, 48, PAL.w); drawText(g, '100', DIAL.x0 + 164 - 22, 48, PAL.w);
          // the receiver and the headphones on the desk
          px(g, 'y', 16, 150, 112, 3); px(g, 'y', 20, 153, 3, 23); px(g, 'y', 121, 153, 3, 23);
          px(g, 'r', 24, 116, 76, 34); px(g, 'K', 28, 120, 40, 26);
          for (let y = 122; y < 146; y += 3) px(g, 'r', 28, y, 40, 1);
          px(g, 'w', 80, 124, 10, 10); px(g, 'K', 84, 126, 2, 4);
          ring(g, 'w', 112, 144, 6, Math.PI, Math.PI * 2); px(g, 'w', 104, 144, 4, 6); px(g, 'w', 116, 144, 4, 6);
          // a map with the polar station far in the north
          px(g, 'w', 210, 76, 36, 30); px(g, 'b', 212, 78, 32, 26); px(g, 'W', 212, 78, 32, 5);
          px(g, 'g', 216, 88, 10, 8); px(g, 'g', 230, 92, 10, 10); px(g, 'R', 236, 80, 2, 2);
        },
        4(g) {
          // storm clouds
          for (const [x, y, w] of [[12, 34, 50], [70, 38, 40], [130, 34, 60], [196, 36, 48]]) { px(g, 'w', x, y, w, 6); px(g, 'w', x + 6, y - 3, w - 12, 3); }
          // the winch, the transmitter with its microphone, the mast's pivot
          px(g, 'w', 118, 152, 24, 24); px(g, 'K', 120, 154, 20, 20); ring(g, 'w', 130, 164, 6); px(g, 'Y', 129, 156, 2, 8);
          px(g, 'b', 152, 142, 30, 34); px(g, 'K', 154, 144, 26, 20); px(g, 'C', 157, 148, 6, 6); px(g, 'C', 167, 148, 8, 2);
          px(g, 'w', 172, 130, 2, 12); px(g, 'w', 169, 124, 8, 7); px(g, 'K', 171, 126, 4, 3);
          px(g, 'w', MAST.x - 4, 170, 9, 6);
          // the lightning rod
          px(g, 'y', 199, 40, 3, 136); px(g, 'W', 199, 34, 3, 6); px(g, 'y', 194, 172, 13, 4);
        }
      },

      draw() {
        const s = S(), t = s.tick, f = s.flags, ctx = E.ctx, ART = E.ART, b = s.block;
        if (s.room === 0) {
          // rice on the drum: it jumps while the skin shakes
          for (let i = 0; i < 6; i++) px(ctx, 'W', 100 + i * 5, 154 - (s.drumT ? ((t * 3 + i * 5) % 7) : 0), 1, 1);
          if (f.speakerOn) {
            const k = (t >> 2) % 2;
            ring(ctx, 'W', 200, 122, 20 + k); ring(ctx, 'Y', 200, 122, 8 - k); px(ctx, 'Y', 197, 119, 6, 6);
            for (let i = 0; i < 3; i++) {                  // notes flying out
              const y = 110 - ((t + i * 20) % 60), x = 160 - ((t + i * 20) % 60) / 3 + i * 6;
              px(ctx, 'C', Math.round(x), Math.round(y), 3, 2); px(ctx, 'C', Math.round(x) + 2, Math.round(y) - 6, 1, 6);
            }
            for (let i = 0; i < 5; i++) px(ctx, 'w', 174 + i * 12, 86 - (k ? (i % 3) : 0), 2, 2);   // dust on top
          } else {
            px(ctx, 'K', 194, 116, 12, 12); px(ctx, 'w', 196, 118, 8, 8); px(ctx, 'K', 198, 120, 4, 4);   // empty magnet slot
          }
        } else if (s.room === 1) {
          // trolley, cable, electromagnet; the iron block
          const hx = Math.round(s.hookX), carried = b.state === 'held' || b.state === 'lift';
          const bx = carried ? hx - 8 : b.col * TILE, by = Math.round(b.y);
          px(ctx, 'w', hx - 6, CRANE.beam, 12, 5);
          const magBottom = carried ? by : Math.round(s.magY);
          px(ctx, 'w', hx, CRANE.beam + 5, 1, magBottom - 6 - CRANE.beam - 5);
          px(ctx, 'r', hx - 6, magBottom - 6, 13, 4); px(ctx, 'w', hx - 6, magBottom - 2, 13, 2);
          if (carried && t % 6 < 3) px(ctx, 'C', hx - 8, magBottom - 4, 2, 2), px(ctx, 'C', hx + 7, magBottom - 4, 2, 2);
          px(ctx, 'w', bx, by, 16, 16); px(ctx, 'K', bx + 2, by + 2, 12, 12); px(ctx, 'w', bx + 4, by + 4, 8, 8);
          for (const [dx, dy] of [[1, 1], [13, 1], [1, 13], [13, 13]]) px(ctx, 'W', bx + dx, by + dy, 2, 2);
          px(ctx, b.state === 'held' ? 'G' : 'R', 226, 150, 6, 6);
          if (s.mode === 'crane' && t % 30 < 20) px(ctx, 'Y', 232, 136, 8, 2);
        } else if (s.room === 2) {
          // the chart lights up as SOS is keyed; the key and its lamp
          for (let i = 0; i < s.morse.length; i++) px(ctx, 'Y', CHART[i].x, 58, CHART[i].w, 4);
          if (s.mode === 'morse' && s.morse.length < CHART.length && t % 30 < 18) px(ctx, 'C', CHART[s.morse.length].x, 64, CHART[s.morse.length].w, 1);
          if (f.dotDone && t % 20 < 10) for (const c of CHART) px(ctx, 'G', c.x, 58, c.w, 4);
          const down = s.keyDown ? 2 : 0;
          px(ctx, 'W', 112, 142 + down, 20, 2); px(ctx, 'K', 130, 139 + down, 5, 4); px(ctx, 'w', 131, 140 + down, 3, 2);
          px(ctx, s.keyDown ? 'Y' : 'r', 148, 145, 4, 4);
          ctx.drawImage(ART.dot, Math.round(s.dotX) - 8, 156);
          if (t % 40 < 20) px(ctx, 'Y', Math.round(s.dotX) - 1, 156, 2, 1);
        } else if (s.room === 3) {
          // the needle and the signal lamp
          const x = DIAL.x0 + Math.round(s.dial * DIAL.scale);
          px(ctx, 'R', x, 47, 2, 20);
          const dm = Math.abs(s.dial - DIAL.music), dp = Math.abs(s.dial - DIAL.polar);
          const lamp = f.tuned || dp <= DIAL.near ? 'G' : dm <= DIAL.near ? 'Y' : s.mode === 'tune' && t % 10 < 5 ? 'r' : 'K';
          px(ctx, lamp, 86, 140, 6, 6);
          const level = Math.max(0, 12 - Math.round(Math.min(dm, dp) * 2));
          px(ctx, 'K', 28, 120, 40, 26);
          for (let y = 122; y < 146; y += 3) px(ctx, 'r', 28, y, 40, 1);
          if (s.mode === 'tune' || f.tuned) px(ctx, 'G', 30, 144 - (f.tuned ? 12 : level) * 2, 4, (f.tuned ? 12 : level) * 2);
        } else if (s.room === 4) {
          // rain
          for (let i = 0; i < 26; i++) {
            const x = (i * 37 + (t >> 1) * 3) % 240 + 8, y = 44 + ((i * 53 + t * 4) % 128);
            px(ctx, 'b', x, y, 1, 4);
          }
          // the mast: lying flat to the left, raised by the winch
          const a = (1 - s.mastA) * Math.PI / 2, ex = MAST.x - Math.sin(a) * MAST.len, ey = MAST.y - Math.cos(a) * MAST.len;
          for (let i = 0; i <= MAST.len; i += 2) px(ctx, 'w', Math.round(MAST.x - Math.sin(a) * i) - 1, Math.round(MAST.y - Math.cos(a) * i) - 1, 3, 3);
          for (const k of [0, 8, 16]) {                    // the antenna's cross bars near the top
            const cx = MAST.x - Math.sin(a) * (MAST.len - k), cy = MAST.y - Math.cos(a) * (MAST.len - k), hw = 10 - k / 4;
            for (let j = -hw; j <= hw; j++) px(ctx, 'W', Math.round(cx + Math.cos(a) * j), Math.round(cy - Math.sin(a) * j));
          }
          // the winch rope to the mast's middle
          const mx = MAST.x - Math.sin(a) * 46, my = MAST.y - Math.cos(a) * 46;
          for (let i = 0; i <= 20; i++) px(ctx, 'y', Math.round(126 + (mx - 126) * i / 20), Math.round(152 + (my - 152) * i / 20));
          if (f.cableOn) { px(ctx, 'c', MAST.x + 4, 172, 48, 2); px(ctx, 'G', 157, 148, 6, 6); }
          // lightning: a flicker at the rod's tip, then the strike
          const ph = boltPhase();
          if (ph < BOLT.warn) { if (t % 6 < 3) px(ctx, 'C', 198 + (t % 3), 30, 2, 2); }
          else if (ph < BOLT.on) {
            let x = 200;
            for (let y = 18; y < 34; y += 2) { const nx = 196 + ((y * 7 + t * 5) % 9); px(ctx, 'W', Math.min(x, nx), y, Math.abs(nx - x) + 1, 2); x = nx; }
            px(ctx, t % 4 < 2 ? 'W' : 'C', 198, 34, 5, 142);
            if (ph < BOLT.warn + 4) px(ctx, 'W', 8, 34, 240, 2);
          }
          if (f.won) {                                     // radio waves leaving the antenna
            for (let k = 0; k < 4; k++) {
              const r = 8 + ((t + k * 18) % 72);
              ring(ctx, k % 2 ? 'C' : 'Y', ex, ey, r, -Math.PI * 0.9, -Math.PI * 0.6);
              ring(ctx, k % 2 ? 'C' : 'Y', ex, ey, r, -Math.PI * 0.4, -Math.PI * 0.1);
            }
          }
        }
      },
      overlay() {
        const s = S();
        if (s.dialog) return;
        if (s.mode === 'crane') hintBar('l3.crane.hint');
        else if (s.mode === 'morse') hintBar('l3.morse.hint');
        else if (s.mode === 'tune') hintBar('l3.tune.hint');
      }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
