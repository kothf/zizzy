'use strict';
/* =============================================================================
   Zizzy — level 4 "The Lighthouse": more first lessons in electricity, for
   players of about 7-10. Every puzzle is one idea, and every wrong try
   explains why instead of punishing:
     keeper's hut   a solar panel turns sunlight into electricity, but only
                    when light reaches it: wipe the dust off with the rag
     battery room   three batteries in a row, each + to the next one's -:
                    spot the one put in the wrong way round
     fuse room      four plugs in one socket overheat the wire (a bare wire
                    sparks: a hazard); unplug some, then a new fuse, a thin
                    wire that melts first so the house wires never get too hot
     garland room   bulbs in a chain (in series): one broken bulb and the
                    whole chain is dark; a spare bulb closes the chain
     lamp room      the lighthouse lamp and its lens: switch it on, the ship
                    in the storm finds its way home
   Hooks for the engine (see game.js); the map is in world4.js.
   ============================================================================= */
(function (root) {
  (root.ZIZZY_LEVELS = root.ZIZZY_LEVELS || [])[3] = E => {
    const { L, px, drawText, drawTextCentered, TOP } = E;
    const S = () => E.S;
    const WORLD = root.ZIZZY_WORLDS[3], spark = id => WORLD.sparks.find(s => s.id === id);

    // battery room: which of the three batteries is the wrong way round (0, 1 or 2)
    const WRONG_BATTERY = 1;
    const RACK = { x: 84, y: 118, w: 26, gap: 4 };
    // fuse room: the bare wire on the floor sparks while the socket is overloaded
    const ARC = { period: 150, warn: 30, on: 75, x0: 136, x1: 152 };
    const arcPhase = () => S().tick % ARC.period;
    const arcLive = () => !S().flags.unplugged && arcPhase() >= ARC.warn && arcPhase() < ARC.on;
    // garland room: the bulbs on the wire; the broken one is in the middle
    const BULBS = [24, 52, 80, 108, 136, 164, 192, 220], BROKEN = 4, sagY = x => 40 + Math.round(Math.sin((x - 16) / 224 * Math.PI) * 10);
    // lamp room: the lamp's centre; the ship sails in the window on the left
    const LAMP = { x: 128, y: 82 };

    const ring = (g, ink, cx, cy, r, from = 0, to = Math.PI * 2) => {
      for (let a = from; a <= to; a += 0.5 / r) px(g, ink, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r));
    };

    function battery(g, x, y, flipped, lit) {
      // a battery lying down: the body, a + nub at one end (+ / - labels)
      px(g, 'w', x, y, RACK.w, 12); px(g, lit ? 'g' : 'r', x + 1, y + 1, RACK.w - 2, 10);
      px(g, 'K', x + 1, y + 1, 5, 10);
      if (flipped) { px(g, 'W', x - 3, y + 4, 3, 4); drawText(g, '+', x + 3, y + 3, PAL.W); drawText(g, '-', x + RACK.w - 9, y + 3, PAL.W); }
      else { px(g, 'W', x + RACK.w, y + 4, 3, 4); drawText(g, '-', x + 3, y + 3, PAL.W); drawText(g, '+', x + RACK.w - 9, y + 3, PAL.W); }
    }

    // the questions: a dialog with answers; standing by it asks once, after that USE asks again
    function askRack() {
      const s = S();
      s.rackAsked = true;
      E.ask(L('l4.rack'), [L('l4.rack.a'), L('l4.rack.b'), L('l4.rack.c')], i => {
        if (i !== WRONG_BATTERY) { E.sound.beep(); return E.showDialog(L('l4.rack.no')); }
        s.flags.batteriesOk = true;
        E.collectSpark(spark('battery')); E.sound.solve();
        E.showDialog(L('l4.rack.yes', { n: s.sparks }));
      });
    }
    function askSocket() {
      const s = S();
      s.socketAsked = true;
      E.ask(L('l4.socket'), [L('l4.socket.a'), L('l4.socket.b')], i => {
        if (i !== 0) { E.sound.zap(); return E.showDialog(L('l4.socket.no')); }
        s.flags.unplugged = true; E.sound.clank();
        E.showDialog(L('l4.socket.yes'));
      });
    }

    return {
      roomKey: 'l4.room.', intro: 'l4.intro', wonBanner: 'playAgain',
      init(st) {
        Object.assign(st.flags, { panelClean: false, batteriesOk: false, unplugged: false, fuseOn: false, garlandOn: false });
        Object.assign(st, { rackAsked: false, socketAsked: false, meter: 0, beamA: 0 });
      },
      blocked: () => null,
      support: () => null,
      hazards: [
        { room: 2, x0: ARC.x0, x1: ARC.x1, y0: 150, y1: 180, active: arcLive, sfx: 'zap', msg: L('l4.hazard.arc') }
      ],
      tick() {
        const s = S(), f = s.flags, sound = E.sound;
        if (f.panelClean && s.meter < 1) s.meter = Math.min(1, s.meter + 1 / 60);
        if (f.won) s.beamA += 0.04;
        if (s.room === 2 && !f.unplugged && arcPhase() === ARC.warn) sound.noise(0.5, { vol: 0.6, lowpass: 9000 });
      },

      use(at, cx, cy, auto) {
        const s = S(), f = s.flags, D = E.showDialog, has = E.has, sound = E.sound;
        const held = s.inv[s.slot] || s.inv[1 - s.slot];
        if (s.room === 0) {
          if (at(144, 240, 100, 180)) {
            if (f.panelClean) return E.say(L('l4.panel.on')), true;
            if (has('rag')) {
              f.panelClean = true; E.takeItem('rag'); sound.solve();
              return D(L('l4.panel.done')), true;
            }
            return D(L(held ? 'l4.panel.wrong' : 'l4.panel.need')), true;
          }
        }
        if (s.room === 1) {
          if (at(72, 176, 100, 180)) {
            if (f.batteriesOk) return E.say(L('l4.rack.after')), true;
            if (auto && s.rackAsked) return E.hint(L('l4.askAgain')), true;
            return askRack(), true;
          }
        }
        if (s.room === 2) {
          if (at(48, 112, 120, 180)) {
            if (f.unplugged) return E.say(L('l4.socket.after')), true;
            if (auto && s.socketAsked) return E.hint(L('l4.askAgain')), true;
            return askSocket(), true;
          }
          if (at(160, 206, 100, 180)) {
            if (f.fuseOn) return E.say(L('l4.fuse.on')), true;
            if (!has('fuse')) return D(L('l4.fuse.need')), true;
            if (!f.unplugged) { sound.beep(); return D(L('l4.fuse.overload')), true; }
            f.fuseOn = true; E.takeItem('fuse');
            E.collectSpark(spark('fuse')); sound.solve();
            return D(L('l4.fuse.done', { n: s.sparks })), true;
          }
        }
        if (s.room === 3) {
          if (at(112, 160, 100, 180)) {
            if (f.garlandOn) return E.say(L('l4.garland.on')), true;
            if (!f.fuseOn) return D(L('l4.garland.dead')), true;
            if (!has('bulb')) return D(L('l4.garland.need')), true;
            f.garlandOn = true; E.takeItem('bulb');
            E.collectSpark(spark('garland')); sound.solve();
            return D(L('l4.garland.done', { n: s.sparks })), true;
          }
        }
        if (s.room === 4) {
          if (at(24, 72, 120, 180)) {
            if (s.sparks < WORLD.sparks.length) return D(L('l4.switch.need', { n: s.sparks })), true;
            if (auto) return E.hint(L('useIt')), true;   // the big moment is Zizzy's own press
            return E.win('l4.win'), true;
          }
          if (at(96, 160, 100, 180)) return D(L('l4.lamp')), true;
        }
        return false;
      },
      onWonUse: () => E.restart(),

      decor: {
        0(g) {
          // a window with the sun, the solar panel under it, its meter and the cable
          px(g, 'w', 168, 34, 56, 34); px(g, 'b', 170, 36, 52, 30); px(g, 'w', 195, 36, 2, 30);
          px(g, 'Y', 176, 40, 10, 10); px(g, 'W', 178, 42, 6, 6);
          for (const [dx, dy] of [[-3, 4], [12, 4], [4, -3], [4, 12]]) px(g, 'Y', 176 + dx, 40 + dy, 2, 2);
          px(g, 'w', 160, 78, 72, 36);
          px(g, 'w', 194, 114, 4, 62);                                    // the panel's stand
          px(g, 'w', 224, 120, 20, 30); px(g, 'K', 226, 122, 16, 18);     // the meter
          drawText(g, '0', 226, 142, PAL.w);
          // a bed and a table: the keeper's things
          px(g, 'r', 120, 160, 40, 8); px(g, 'w', 120, 156, 10, 4); px(g, 'y', 120, 168, 3, 8); px(g, 'y', 157, 168, 3, 8);
          px(g, 'y', 24, 120, 40, 3); px(g, 'Y', 30, 112, 6, 8);          // a lamp on the shelf's wall
        },
        1(g) {
          // the battery rack: a board with three slots and a little lamp it should light
          px(g, 'y', RACK.x - 8, RACK.y - 6, 3 * (RACK.w + RACK.gap) + 12, 24);
          px(g, 'K', RACK.x - 6, RACK.y - 4, 3 * (RACK.w + RACK.gap) + 8, 20);
          for (let i = 0; i < 3; i++) drawText(g, String(i + 1), RACK.x + i * (RACK.w + RACK.gap) + 9, RACK.y + 18, PAL.Y);
          px(g, 'w', 140, 96, 8, 8); px(g, 'w', 143, 104, 2, 8);
          // a poster: + and - like a battery's ends
          px(g, 'w', 200, 50, 40, 30); px(g, 'K', 202, 52, 36, 26);
          drawText(g, '+', 208, 60, PAL.R); drawText(g, '-', 224, 60, PAL.B);
        },
        2(g) {
          // the wall socket and the fuse box
          px(g, 'w', 60, 140, 24, 16); px(g, 'K', 62, 142, 20, 12);
          for (let i = 0; i < 4; i++) px(g, 'w', 64 + i * 5, 145, 2, 4);
          px(g, 'w', 166, 104, 36, 44); px(g, 'K', 168, 106, 32, 40);
          drawText(g, 'FUSE', 169, 108, PAL.Y);
          px(g, 'w', 174, 122, 20, 10); px(g, 'K', 176, 124, 16, 6);
          px(g, 'c', 183, 42, 2, 62);                                     // its cable up to the mains
          // the bare wire on the floor
          px(g, 'r', 120, 174, 48, 2); px(g, 'W', ARC.x0, 173, ARC.x1 - ARC.x0, 1);
        },
        3(g) {
          // the garland's wire, sagging across the room, and its plug in the wall
          for (let x = 16; x < 240; x++) px(g, 'w', x, sagY(x));
          px(g, 'w', 236, 36, 6, 8); px(g, 'w', 238, 44, 2, 132);
          // a note on the wall
          px(g, 'w', 180, 112, 44, 30); px(g, 'K', 182, 114, 40, 26);
          for (let y = 118; y < 138; y += 5) px(g, 'w', 186, y, 32, 1);
        },
        4(g) {
          // the window on the left: the sea at night and the rocks
          px(g, 'w', 14, 50, 70, 60); px(g, 'b', 16, 52, 66, 56); px(g, 'B', 16, 92, 66, 16);
          px(g, 'w', 48, 52, 2, 56);
          px(g, 'K', 60, 86, 10, 8); px(g, 'K', 64, 82, 6, 4);           // the rocks
          // the lamp's stand and the switch
          px(g, 'y', LAMP.x - 10, 120, 20, 56); px(g, 'Y', LAMP.x - 14, 116, 28, 4);
          px(g, 'w', 40, 136, 16, 24); px(g, 'K', 42, 138, 12, 20);
        }
      },

      draw() {
        const s = S(), t = s.tick, f = s.flags, ctx = E.ctx;
        if (s.room === 0) {
          // the panel: grey with dust, then blue cells shining
          for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
            const x = 162 + c * 12, y = 80 + r * 11;
            px(ctx, f.panelClean ? ((c + r + (t >> 4)) % 7 ? 'b' : 'C') : 'w', x, y, 10, 9);
            if (!f.panelClean) for (let k = 0; k < 4; k++) px(ctx, 'K', x + ((k * 7 + c * 3) % 9), y + ((k * 5 + r) % 8));
          }
          if (f.panelClean) for (let i = 0; i < 3; i++) px(ctx, 'Y', 186 + i * 6 - ((t >> 2) % 8), 52 + ((t >> 2) % 8) * 3, 2, 2);   // light falling on it
          const a = Math.PI * (1.1 + s.meter * 0.8);
          for (let i = 0; i < 9; i++) px(ctx, 'R', Math.round(234 + Math.cos(a) * i), Math.round(138 + Math.sin(a) * i));
        } else if (s.room === 1) {
          for (let i = 0; i < 3; i++) battery(ctx, RACK.x + i * (RACK.w + RACK.gap), RACK.y, i === WRONG_BATTERY && !f.batteriesOk, f.batteriesOk);
          px(ctx, f.batteriesOk ? (t % 20 < 14 ? 'Y' : 'W') : 'K', 141, 97, 6, 6);
        } else if (s.room === 2) {
          // the plugs in the socket: four, the wire red hot, until some are unplugged
          const n = f.unplugged ? 1 : 4;
          for (let i = 0; i < n; i++) { px(ctx, 'W', 63 + i * 5, 150, 4, 6); px(ctx, f.unplugged ? 'w' : (t % 16 < 8 ? 'R' : 'r'), 64 + i * 5, 156, 2, 20 - i * 2); }
          if (!f.unplugged) px(ctx, t % 16 < 8 ? 'R' : 'r', 84, 174, 52, 2);
          // the fuse: melted black, then glowing
          px(ctx, f.fuseOn ? 'C' : 'K', 178, 126, 12, 2); if (!f.fuseOn) px(ctx, 'w', 177, 125, 2, 4), px(ctx, 'w', 189, 125, 2, 4);
          // the bare wire: a flicker, then sparks
          const ph = arcPhase();
          if (!f.unplugged) {
            if (ph < ARC.warn) { if (t % 6 < 3) px(ctx, 'Y', ARC.x0 + (t % 16), 171, 1, 1); }
            else if (ph < ARC.on) {
              for (let i = 0; i < 6; i++) {
                const x = ARC.x0 + ((t * 7 + i * 5) % (ARC.x1 - ARC.x0)), h = 6 + ((t * 3 + i * 11) % 18);
                px(ctx, i % 2 ? 'W' : 'C', x, 174 - h, 1, h);
              }
            }
          }
        } else if (s.room === 3) {
          // the bulbs: dark until the chain is closed, then twinkling colours
          const INKS = ['R', 'G', 'Y', 'C', 'M', 'B'];
          BULBS.forEach((x, i) => {
            const y = sagY(x);
            px(ctx, 'w', x - 1, y + 1, 3, 2);
            if (i === BROKEN && !f.garlandOn) { px(ctx, 'K', x - 2, y + 3, 5, 6); px(ctx, 'w', x - 2, y + 3, 1, 6); px(ctx, 'w', x + 2, y + 3, 1, 6); px(ctx, 'w', x - 1, y + 6, 3, 1); return; }
            px(ctx, f.garlandOn ? INKS[(i + (t >> 4)) % INKS.length] : 'w', x - 2, y + 3, 5, 6);
            if (!f.garlandOn) px(ctx, 'K', x - 1, y + 4, 3, 4);
          });
        } else if (s.room === 4) {
          // the ship in the storm: it heads for the rocks until the lamp shines
          const sx = f.won ? Math.max(20, 46 - (t - s.flags.wonTick) / 8) : 30 + Math.round(Math.sin(t / 40) * 3), sy = 86 + ((t >> 4) % 2);
          px(ctx, 'w', sx, sy, 14, 4); px(ctx, 'w', sx + 6, sy - 9, 1, 9); px(ctx, 'W', sx + 7, sy - 8, 5, 6);
          if (!f.won && t % 60 < 30) px(ctx, 'R', sx + 6, sy - 10, 1, 1);
          // the lamp: a bulb inside its glass lens
          px(ctx, 'w', LAMP.x - 16, LAMP.y - 20, 32, 40); px(ctx, 'K', LAMP.x - 14, LAMP.y - 18, 28, 36);
          for (let y = -16; y <= 16; y += 4) px(ctx, 'c', LAMP.x - 14, LAMP.y + y, 28, 1);
          px(ctx, f.won ? 'W' : 'w', LAMP.x - 4, LAMP.y - 6, 8, 12);
          if (f.won) {
            // the beam turning round
            const a = s.beamA, dir = Math.cos(a) < 0 ? -1 : 1, len = Math.abs(Math.cos(a)) * 110;
            for (let i = 16; i < len; i += 2) {
              const hw = 2 + i / 10;
              px(ctx, i % 4 ? 'Y' : 'W', Math.round(LAMP.x + dir * i), Math.round(LAMP.y - hw / 2), 2, Math.round(hw));
            }
            ring(ctx, 'Y', LAMP.x, LAMP.y, 6 + (t >> 2) % 4);
          }
          px(ctx, f.won ? 'G' : 'R', 46, 144, 4, 6);                   // the switch's lamp
        }
      },
      overlay() {}
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
