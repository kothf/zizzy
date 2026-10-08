'use strict';
/* =============================================================================
   Zizzy — level 1 "The Radio Station": puzzles, hazards and scenery.
   Hooks for the engine (see game.js); the map is in world.js.
   ============================================================================= */
(function (root) {
  (root.ZIZZY_LEVELS = root.ZIZZY_LEVELS || [])[0] = E => {
    const { L, px, tileImg, cobweb, drawText, TILE, TOP } = E;
    const CRATE = { y: 168, w: 24, x0: 56, span: 120 };   // the raft in the flooded tunnel
    const ARC = { period: 160, warn: 24, on: 84, x0: 88, x1: 96 };
    const ROBOT_HOME = 224, ROBOT_AWAY = 150;
    const S = () => E.S;

    const arcPhase = () => S().tick % ARC.period;
    const arcLive = () => { const t = arcPhase(); return t >= ARC.warn && t < ARC.on; };

    return {
      roomKey: 'room.', intro: 'intro', wonBanner: 'nextLevel',
      init(st) {
        Object.assign(st.flags, { steamOff: false, trapOpen: false, robotFixed: false });
        Object.assign(st, { robotX: ROBOT_HOME, crateX: CRATE.x0, crateV: 0, cratePhase: 0 });
      },
      blocked(rid, row, col) {
        const f = S().flags;
        if (rid === 0 && !f.trapOpen && row === 1 && (col === 22 || col === 23)) return '#';
        if (rid === 3 && !f.robotFixed && row >= 16 && row <= 19 && (col === 27 || col === 28)) return '#';
        return null;
      },
      support(x, yb) {
        const s = S();
        return s.room === 2 && yb === CRATE.y && x + 4 > s.crateX && x - 4 < s.crateX + CRATE.w ? 'crate' : null;
      },
      hazards: [
        { room: 0, x0: 18, x1: 38, y0: 56, y1: 176, active: () => !S().flags.steamOff, sfx: 'hurt', msg: L('hazard.steam') },
        { room: 2, x0: 56, x1: 200, y0: 179, y1: 400, active: () => true, sfx: 'fizz', msg: L('hazard.water') },
        { room: 3, x0: ARC.x0, x1: ARC.x1, y0: 32, y1: 176, active: arcLive, sfx: 'zap', msg: L('hazard.arc') }
      ],
      tick() {
        const s = S(), before = s.crateX;
        s.cratePhase += 0.012;
        s.crateX = CRATE.x0 + (CRATE.span / 2) * (1 - Math.cos(s.cratePhase));
        s.crateV = s.crateX - before;
        if (s.flags.robotFixed && s.robotX > ROBOT_AWAY) s.robotX = Math.max(ROBOT_AWAY, s.robotX - 0.5);
      },

      // USE: what Zizzy is standing next to
      use(at, cx, cy) {
        const s = S(), p = s.p, f = s.flags, has = E.has, D = E.showDialog, sound = E.sound;
        if (s.room === 0) {
          if (at(36, 84, 140, 180)) {
            if (f.steamOff) return D(L('valve.shut')), true;
            if (!has('wrench')) return D(L('valve.need')), true;
            f.steamOff = true; E.takeItem('wrench'); sound.hiss();
            return D(L('valve.done')), true;
          }
          if (at(168, 200, 20, 90) && p.climb) {
            if (f.trapOpen) return E.say(L('trap.open')), true;
            if (!has('oilcan')) return D(L('trap.need')), true;
            f.trapOpen = true; E.takeItem('oilcan'); sound.clank();
            return D(L('trap.done')), true;
          }
          if (at(160, 208, 120, 180) && !f.trapOpen) return D(L('trap.ladder')), true;
        }
        if (s.room === 1 && at(56, 136, 100, 180)) return D(L('boiler')), true;
        if (s.room === 2 && cy > 140 && (cx < 64 || cx > 192)) return D(L('water')), true;
        if (s.room === 3) {
          if (Math.abs(cx - s.robotX) < 26 && cy > 136) {
            if (f.robotFixed) return D(L('robot.fixed')), true;
            if (!has('fuse')) { sound.beep(); return D(L('robot.need')), true; }
            f.robotFixed = true;
            E.giveItem('magnet', 'fuse'); sound.solve();
            return D(L('robot.done')), true;
          }
          if (at(72, 112, 24, 180)) return D(L('tesla')), true;
        }
        if (s.room === 4) {
          if (at(176, 232, 88, 124)) {
            if (s.sparks < 5) return D(L('socket.need', { n: s.sparks })), true;
            return E.win('win'), true;
          }
          if (at(24, 64, 140, 180)) {
            const sp = root.ZIZZY_WORLDS[0].sparks.find(k => k.grate);
            if (s.got[sp.id]) return E.say(L('grate.empty')), true;
            if (!has('magnet')) return D(L('grate.need')), true;
            E.collectSpark(sp);
            return D(L('grate.done', { n: s.sparks })), true;
          }
          if (at(160, 240, 130, 180)) return D(L('wireless')), true;
        }
        return false;
      },
      onWonUse: () => E.nextLevel(),

      // Static scenery, drawn once per room into its cached layer
      decor: {
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
          px(g, 'Y', 12, 128, 34, 18); px(g, 'K', 14, 130, 30, 14); drawText(g, E.T('sign.deep'), 14, 133, PAL.Y);
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
          px(g, 'R', 212, 118, 38, 13); px(g, 'K', 214, 120, 34, 9); drawText(g, E.T('sign.stop'), 215, 121, PAL.W);
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
      },

      // moving scenery under Zizzy
      draw() {
        const s = S(), t = s.tick, f = s.flags, ctx = E.ctx, ART = E.ART;
        if (s.room === 0) {
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
        } else if (s.room === 1) {
          const glow = (t >> 2) % 3;
          px(ctx, glow ? 'R' : 'Y', 80, 166, 32, 8);
          for (let i = 0; i < 6; i++) px(ctx, (i + glow) % 2 ? 'Y' : 'R', 82 + i * 5, 164 - ((t + i * 3) % 4), 2, 2);
        } else if (s.room === 2) {
          const water = tileImg((t >> 3) % 2 ? 'water0' : 'water1', 'B');
          for (let c = 7; c <= 24; c++) ctx.drawImage(water, c * TILE, TOP + 20 * TILE);
          const x = Math.round(s.crateX);
          px(ctx, 'y', x, CRATE.y, CRATE.w, 8); px(ctx, 'Y', x, CRATE.y, CRATE.w, 1);
          for (let i = 4; i < CRATE.w; i += 8) px(ctx, 'r', x + i, CRATE.y + 2, 1, 6);
        } else if (s.room === 3) {
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
          ctx.drawImage(f.robotFixed ? ART.robotFixed : ART.robotBroken, Math.round(s.robotX) - 8, 156);
          if (!f.robotFixed && t % 50 < 25) px(ctx, 'R', Math.round(s.robotX) - 1, 156, 2, 1);
        } else if (s.room === 4) {
          const sp = root.ZIZZY_WORLDS[0].sparks.find(k => k.grate);
          if (!s.got[sp.id]) ctx.drawImage(ART.spark[(t >> 3) % 2], sp.x - 4, sp.y - 6);
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
      },
      // the ending: Zizzy back in the wireless's socket
      drawPlayer() {
        const s = S();
        if (!(s.flags.won && s.room === 4)) return false;
        E.ctx.drawImage(E.ART.zizzy[s.p.face].stand, 198, 98);
        if (s.tick % 8 < 4) px(E.ctx, 'W', 203, 101, 2, 2);
        return true;
      }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
