'use strict';
/* =============================================================================
   Zizzy — level 2 "The Power Station": first lessons in electricity, for
   players of about 7-10. Every puzzle is one idea, and every wrong try
   explains why instead of punishing:
     storeroom   only a conductor (the metal spoon) closes the motor's gap;
                 the wooden stick and the rubber duck are insulators
     dark hall   a circuit works only as a closed loop: a long copper wire
                 closes it, the bulb lights and the hatch's electric lock opens
     generator   running on the dynamo's belt makes electricity (a battery)
     classroom   Volta the robot teacher, woken by the battery, asks a quiz
     roof        switch the power off before fixing; rubber gloves; a puddle
                 under a live cable is deadly; power on again lights the town
   Hooks for the engine (see game.js); the map is in world2.js.
   ============================================================================= */
(function (root) {
  (root.ZIZZY_LEVELS = root.ZIZZY_LEVELS || [])[1] = E => {
    const { L, px, tileImg, drawText, TILE, TOP } = E;
    const S = () => E.S;
    const WORLD = root.ZIZZY_WORLDS[1], spark = id => WORLD.sparks.find(s => s.id === id);
    const BELT = { x0: 64, x1: 144 };                    // the dynamo's running belt (generator room floor)
    const CHARGE_FULL = 200;                             // steps of running: 4 s
    const VOLTA_HOME = 224, VOLTA_AWAY = 150;
    const PUDDLE = { x0: 104, x1: 152 };
    const onBelt = p => p.ground && p.y === 176 && p.x >= BELT.x0 && p.x <= BELT.x1;

    // the quiz: the right answer's index, and texts l2.qN, l2.qN.a / .b, l2.qN.yes / .no
    const QUIZ = [0, 1, 0, 1];

    // what each thing does in a gap of a circuit
    const CONDUCTS = { spoon: true, wire: true };
    function tryInGap(id) {
      if (id === 'stick' || id === 'duck' || id === 'gloves') return L('l2.ins.' + id);
      if (id === 'battery') return L('l2.gap.battery');
      return null;
    }

    // darkness over the hall until the light works: Zizzy's own glow shows a little
    let dark = null;
    function darkness() {
      const p = S().p;
      if (!dark) { dark = document.createElement('canvas'); dark.width = E.W; dark.height = E.H; }
      const g = dark.getContext('2d');
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, E.W, E.H);
      g.fillStyle = 'rgba(0,0,0,0.86)'; g.fillRect(0, TOP, E.W, E.H - TOP);
      g.globalCompositeOperation = 'destination-out';
      const cx = p.x, cy = p.y - 9, r = 38 + Math.sin(S().tick / 9) * 2;
      const grad = g.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
      grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      E.ctx.drawImage(dark, 0, 0);
    }

    function startQuiz(n) {
      const s = S();
      if (n >= QUIZ.length) {
        s.flags.quizDone = true;
        E.collectSpark(spark('volta'));
        E.sound.solve();
        // the gloves go into a free hand, or onto the floor beside Zizzy
        if (!E.giveItem('gloves')) s.items.push({ id: 'gloves', room: s.room, x: Math.round(s.p.x) + 12, y: 176 });
        return E.showDialog(L('l2.volta.done', { n: s.sparks }));
      }
      const q = 'l2.q' + (n + 1);
      E.ask(L(q), [L(q + '.a'), L(q + '.b')], i => {
        if (i === QUIZ[n]) { E.sound.spark(); E.showDialog(L(q + '.yes'), () => startQuiz(n + 1)); }
        else { E.sound.beep(); E.showDialog(L(q + '.no'), () => startQuiz(n)); }
      });
    }

    return {
      roomKey: 'l2.room.', intro: 'l2.intro', wonBanner: 'playAgain',
      init(st) {
        Object.assign(st.flags, { lit: false, motorOn: false, charged: false, voltaOn: false, quizDone: false, powerOn: true, cableFixed: false });
        Object.assign(st, { charge: 0, beltT: 0, voltaX: VOLTA_HOME, hatchHint: 0 });
      },
      blocked(rid, row, col) {
        const f = S().flags;
        if (rid === 1 && !f.lit && row === 1 && (col === 22 || col === 23)) return '#';          // hatch: electric lock
        if (rid === 2 && f.motorOn && row >= 10 && row <= 19 && (col === 26 || col === 27)) return 'H';   // rope ladder
        if (rid === 3 && !f.quizDone && row >= 16 && row <= 19 && (col === 27 || col === 28)) return '#';  // Volta at the door
        return null;
      },
      support: () => null,
      // the belt runs back as fast as Zizzy walks: running on it keeps Zizzy in place
      conveyor() {
        const s = S();
        return s.room === 0 && !s.flags.charged && onBelt(s.p) ? -E.PH.WALK : 0;
      },
      hazards: [
        { room: 4, x0: PUDDLE.x0, x1: PUDDLE.x1, y0: 150, y1: 180, active: () => S().flags.powerOn && !S().flags.cableFixed,
          sfx: 'zap', msg: L('l2.hazard.puddle') }
      ],
      tick() {
        const s = S(), f = s.flags, p = s.p;
        if (f.quizDone && s.voltaX > VOLTA_AWAY) s.voltaX = Math.max(VOLTA_AWAY, s.voltaX - 0.5);
        if (s.hatchHint > 0) s.hatchHint--;
        if (s.dialog || f.won) return;
        // running on the dynamo
        if (s.room === 0 && !f.charged && onBelt(p) && E.input.right && !E.input.left) {
          s.charge++; s.beltT++;
          if (s.charge % 25 === 0) E.sound.blip();
          if (s.charge >= CHARGE_FULL) {
            f.charged = true;
            s.items.push({ id: 'battery', room: 0, x: 192, y: 176 });
            E.sound.solve();
            E.showDialog(L('l2.dynamo.done'));
          }
        }
        // head against the locked hatch
        if (s.room === 1 && !f.lit && p.climb && p.y < 60 && E.input.up && !s.hatchHint) { s.hatchHint = 250; E.say(L('l2.hatch.locked')); }
      },

      use(at, cx, cy) {
        const s = S(), p = s.p, f = s.flags, D = E.showDialog, has = E.has, sound = E.sound;
        const held = s.inv[s.slot] || s.inv[1 - s.slot];
        if (s.room === 0) {
          if (at(48, 160, 100, 180)) return D(L(f.charged ? 'l2.dynamo.used' : 'l2.dynamo')), true;
        }
        if (s.room === 1) {
          if (at(168, 200, 20, 90) && p.climb) return (f.lit ? E.say(L('l2.hatch.open')) : D(L('l2.hatch.locked'))), true;
          if (at(198, 252, 120, 180)) {
            if (f.lit) return E.say(L('l2.hall.lit')), true;
            if (has('wire')) {
              f.lit = true; E.takeItem('wire'); sound.solve();
              return D(L('l2.hall.done')), true;
            }
            if (held === 'spoon') return D(L('l2.hall.spoon')), true;
            const why = held && tryInGap(held);
            return D(why || L('l2.hall.need')), true;
          }
        }
        if (s.room === 2) {
          if (at(12, 104, 136, 180)) {
            if (f.motorOn) return E.say(L('l2.motor.on')), true;
            if (!held) return D(L('l2.motor.need')), true;
            if (CONDUCTS[held]) {
              f.motorOn = true; E.takeItem(held); sound.solve();
              return D(L('l2.motor.done')), true;
            }
            return D(tryInGap(held) || L('l2.motor.need')), true;
          }
        }
        if (s.room === 3) {
          if (Math.abs(cx - s.voltaX) < 26 && cy > 136) {
            if (f.quizDone) return D(L('l2.volta.after')), true;
            if (!f.voltaOn) {
              if (!has('battery')) { sound.beep(); return D(L('l2.volta.need')), true; }
              f.voltaOn = true; E.takeItem('battery'); sound.solve();
              return D(L('l2.volta.thanks'), () => startQuiz(0)), true;
            }
            return startQuiz(0), true;
          }
          if (at(16, 112, 40, 180)) return D(L('l2.board')), true;
        }
        if (s.room === 4) {
          if (at(12, 64, 120, 180)) {
            if (f.powerOn) { f.powerOn = false; sound.clank(); return D(L('l2.switch.off')), true; }
            if (!f.cableFixed) { f.powerOn = true; sound.zap(); return D(L('l2.switch.on')), true; }
            if (s.sparks < WORLD.sparks.length) return D(L('l2.switch.need', { n: s.sparks })), true;
            f.powerOn = true;
            return E.win('l2.win'), true;
          }
          if (at(160, 224, 100, 180)) {
            if (f.cableFixed) return E.say(L('l2.cable.fixed')), true;
            if (f.powerOn) { sound.beep(); return D(L('l2.cable.live')), true; }
            if (!has('gloves')) return D(L('l2.cable.need')), true;
            f.cableFixed = true; E.collectSpark(spark('cable')); sound.solve();
            return D(L('l2.cable.done', { n: s.sparks })), true;
          }
          if (at(88, 168, 120, 180)) return D(L('l2.puddle')), true;
        }
        return false;
      },
      onWonUse: () => E.restart(),

      decor: {
        0(g) {
          // the dynamo: a big wheel with magnets, a meter and a lamp, over the belt
          px(g, 'K', 88, 104, 56, 56); px(g, 'w', 90, 106, 52, 52); px(g, 'K', 92, 108, 48, 48);
          px(g, 'w', 56, 166, 4, 10); px(g, 'w', 148, 166, 4, 10);      // belt rollers
          px(g, 'w', 46, 76, 12, 16); px(g, 'K', 48, 78, 8, 12);        // the cable's lamp socket on the wall
          px(g, 'c', 51, 92, 2, 12); px(g, 'c', 51, 104, 37, 2);
          // label
          px(g, 'g', 176, 56, 64, 26); px(g, 'K', 178, 58, 60, 22);
          drawText(g, 'N', 186, 62, PAL.R); drawText(g, 'S', 222, 62, PAL.B);
          px(g, 'R', 194, 64, 12, 6); px(g, 'B', 206, 64, 12, 6);
        },
        1(g) {
          // the light circuit on the wall: battery, bulb, wires and a gap
          px(g, 'K', 196, 48, 52, 72); px(g, 'w', 198, 50, 48, 68); px(g, 'K', 200, 52, 44, 64);
          px(g, 'r', 204, 86, 12, 22); px(g, 'R', 206, 88, 8, 4); px(g, 'w', 208, 82, 4, 4);   // battery
          drawText(g, '+', 205, 72, PAL.Y);
          px(g, 'c', 209, 62, 2, 20); px(g, 'c', 209, 60, 22, 2);         // wire up and across
          px(g, 'c', 231, 60, 2, 10);                                    // down to the bulb
          px(g, 'w', 227, 70, 10, 4); px(g, 'y', 228, 74, 8, 9);          // bulb socket + glass
          px(g, 'c', 231, 83, 2, 27); px(g, 'c', 228, 108, 5, 2);          // wire down
          px(g, 'c', 209, 108, 6, 2);                                     // from the battery... the gap between
          px(g, 'R', 216, 106, 1, 6); px(g, 'R', 226, 106, 1, 6);          // gap ends
          // hatch frame around the hatch
          px(g, 'y', 172, 32, 24, 1);
          // a little lock box beside the hatch, wired to the circuit
          px(g, 'w', 196, 34, 8, 8); px(g, 'c', 199, 42, 2, 6);
        },
        2(g) {
          // the lift motor circuit by the floor: battery, motor, a gap in the wire
          px(g, 'K', 16, 136, 88, 40); px(g, 'y', 18, 138, 84, 36); px(g, 'K', 20, 140, 80, 32);
          px(g, 'r', 26, 150, 12, 18); px(g, 'R', 28, 152, 8, 4); drawText(g, '+', 27, 141, PAL.Y);
          px(g, 'w', 76, 148, 18, 20); px(g, 'K', 80, 152, 10, 12); px(g, 'w', 84, 156, 2, 4);   // motor
          px(g, 'c', 38, 156, 12, 2); px(g, 'c', 64, 156, 12, 2);          // wire with a gap
          px(g, 'R', 50, 153, 1, 8); px(g, 'R', 63, 153, 1, 8);
          px(g, 'c', 85, 70, 2, 78);                                      // motor cable up the wall
          px(g, 'c', 85, 68, 128, 2);                                     // and along to the pulley
          px(g, 'w', 208, 60, 16, 10); px(g, 'K', 212, 62, 8, 6);         // pulley above the ladder
          // boxes and jars on the high shelf
          px(g, 'r', 196, 80, 10, 16); px(g, 'R', 197, 81, 8, 2);
          for (const [x, ink] of [[140, 'G'], [146, 'M']]) { px(g, ink, x, 89, 4, 7); px(g, 'W', x, 87, 4, 2); }
        },
        3(g) {
          // the blackboard: a drawn circuit and "+ -"
          px(g, 'y', 22, 54, 92, 52); px(g, 'g', 24, 56, 88, 48);
          px(g, 'W', 34, 66, 24, 1); px(g, 'W', 34, 66, 1, 26); px(g, 'W', 34, 92, 60, 1); px(g, 'W', 93, 66, 1, 27);
          px(g, 'W', 76, 66, 18, 1); px(g, 'W', 58, 62, 18, 9);            // battery
          px(g, 'g', 60, 64, 14, 5); drawText(g, '+', 59, 73, PAL.W); drawText(g, '-', 70, 73, PAL.W);
          px(g, 'Y', 60, 86, 8, 8); px(g, 'W', 62, 88, 4, 4);              // bulb
          px(g, 'w', 24, 104, 88, 2);                                      // chalk rail
          // desk top
          px(g, 'y', 24, 144, 48, 2);
          // hatch in the floor
          px(g, 'y', 172, 176, 24, 1);
        },
        4(g) {
          // the window: the town at night
          px(g, 'w', 24, 40, 96, 52); px(g, 'b', 26, 42, 92, 48);
          for (const [x, y] of [[34, 48], [60, 46], [96, 50], [108, 44]]) px(g, 'W', x, y);
          for (const [x, w, h] of [[30, 14, 18], [48, 12, 26], [64, 18, 14], [86, 10, 22], [100, 16, 16]]) px(g, 'K', x, 90 - h, w, h);
          // the main switch box by the door
          px(g, 'w', 22, 128, 28, 36); px(g, 'K', 24, 130, 24, 32);
          // the pole, its insulators and the danger sign
          px(g, 'y', 186, 40, 6, 136); px(g, 'w', 178, 46, 22, 3); px(g, 'W', 179, 42, 3, 4); px(g, 'W', 195, 42, 3, 4);
          px(g, 'Y', 196, 100, 52, 13); px(g, 'K', 198, 102, 48, 9); drawText(g, E.T('l2.sign.danger'), 198, 103, PAL.Y);
        }
      },

      draw() {
        const s = S(), t = s.tick, f = s.flags, ctx = E.ctx, ART = E.ART;
        if (s.room === 0) {
          // belt stripes run back while Zizzy runs; the wheel spins; meter and lamp fill up
          const run = f.charged ? 0 : s.beltT;
          px(ctx, 'w', BELT.x0 - 4, 173, BELT.x1 - BELT.x0 + 16, 3);
          for (let x = BELT.x0 - 4 + ((-run) % 8 + 8) % 8; x < BELT.x1 + 12; x += 8) px(ctx, 'K', x, 173, 2, 3);
          const a = run / 6;
          for (let k = 0; k < 4; k++) {
            const ang = a + k * Math.PI / 2, x = 116 + Math.cos(ang) * 16, y = 132 + Math.sin(ang) * 16;
            px(ctx, k % 2 ? 'B' : 'R', Math.round(x) - 3, Math.round(y) - 3, 6, 6);
          }
          px(ctx, 'w', 113, 129, 6, 6);
          const fill = Math.min(1, s.charge / CHARGE_FULL);
          px(ctx, 'K', 160, 112, 10, 44); px(ctx, 'w', 160, 112, 10, 1); px(ctx, 'w', 160, 155, 10, 1);
          px(ctx, fill >= 1 ? 'G' : 'Y', 162, 154 - Math.round(fill * 40), 6, Math.round(fill * 40));
          px(ctx, fill >= 1 || (fill > 0 && t % 10 < 5 && E.input.right && onBelt(s.p)) ? 'Y' : 'y', 49, 80, 6, 8);
        } else if (s.room === 1) {
          if (f.lit) {
            px(ctx, 'c', 215, 108, 12, 2);                            // the wire across the gap
            px(ctx, 'Y', 228, 74, 8, 9); px(ctx, 'W', 230, 76, 4, 4);  // lit bulb
            if (t % 20 < 10) { px(ctx, 'Y', 224, 72, 2, 2); px(ctx, 'Y', 238, 72, 2, 2); px(ctx, 'Y', 231, 66, 2, 2); }
            px(ctx, 'G', 198, 36, 4, 4);                              // lock light: open
          } else px(ctx, 'R', 198, 36, 4, 4);
          if (!f.lit) { px(ctx, 'y', 176, 24, 16, 8); for (let x = 176; x < 192; x += 4) px(ctx, 'K', x, 24, 1, 8); }
          else { px(ctx, 'y', 196, 24, 3, 22); px(ctx, 'Y', 197, 26, 1, 18); }
        } else if (s.room === 2) {
          if (f.motorOn) {
            px(ctx, 'w', 50, 156, 14, 2);                             // the spoon in the gap
            px(ctx, 'W', 82 + (t >> 1) % 6, 156, 2, 4);              // motor turning
            const lad = tileImg('ladder', 'y');
            for (let r = 10; r <= 19; r++) for (const c of [26, 27]) ctx.drawImage(lad, c * TILE, TOP + r * TILE);
          } else {
            px(ctx, 'y', 208, 70, 16, 8); px(ctx, 'Y', 208, 72, 16, 1); px(ctx, 'Y', 208, 75, 16, 1);   // rolled-up ladder
          }
        } else if (s.room === 3) {
          const img = f.voltaOn ? ART.voltaOn : ART.voltaOff;
          ctx.drawImage(img, Math.round(s.voltaX) - 8, 156);
          if (!f.voltaOn && t % 60 < 30) px(ctx, 'R', Math.round(s.voltaX) + 3, 168, 2, 2);   // flat battery light
        } else if (s.room === 4) {
          // the puddle; the broken cable dangling over it, sparking while the power is on
          px(ctx, 'b', PUDDLE.x0 - 4, 172, PUDDLE.x1 - PUDDLE.x0 + 8, 4);
          px(ctx, 'B', PUDDLE.x0, 171, PUDDLE.x1 - PUDDLE.x0, 4);
          for (let i = 0; i < 4; i++) px(ctx, 'C', PUDDLE.x0 + 4 + ((i * 13 + (t >> 2)) % (PUDDLE.x1 - PUDDLE.x0 - 8)), 172, 4, 1);
          if (f.powerOn && !f.cableFixed && t % 16 < 8) px(ctx, 'W', PUDDLE.x0 + 8 + (t % 32), 171, 2, 1);
          if (f.cableFixed) px(ctx, 'K', 180, 46, 2, 1), px(ctx, 'w', 120, 45, 62, 2);
          else {
            px(ctx, 'w', 178, 47, 2, 2);
            for (let i = 0; i < 26; i++) px(ctx, 'w', 178 - i, 48 + i * 4.6, 2, 5);   // dangling cable
            if (f.powerOn && t % 8 < 5) {
              for (let k = 0; k < 5; k++) px(ctx, k % 2 ? 'C' : 'W', 150 + ((t * 7 + k * 13) % 14) - 4, 160 + ((t * 5 + k * 7) % 12), 2, 2);
            }
          }
          // the main switch's lever: up = on
          px(ctx, 'w', 34, 136, 4, 20);
          if (f.powerOn) { px(ctx, 'R', 30, 134, 12, 6); } else { px(ctx, 'G', 30, 152, 12, 6); }
          // the town lights come on at the end
          if (f.won) for (const [x, y] of [[33, 76], [51, 68], [55, 78], [68, 80], [74, 82], [89, 72], [104, 78], [110, 80]]) px(ctx, (t >> 3) % 4 ? 'Y' : 'y', x, y, 2, 2);
        }
      },
      overlay() { if (S().room === 1 && !S().flags.lit) darkness(); }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
