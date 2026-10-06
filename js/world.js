'use strict';
/* =============================================================================
   Zizzy — the world: five rooms of an abandoned radio station.
   Each room is a 32x22 tile grid (8 px tiles) below a 16 px status line. One
   grid drives both drawing and collision, so they can never disagree.

   Tiles:  '#' wall (solid)   'X' crate/metal block (solid)   '=' plank (stand
           on it from above, jump through from below)   'H' ladder   '~' water
           'p' / 'i' pipes (decoration)   '.' empty
   Rooms sit on a grid (gx, gy). Walking off an edge enters the neighbour at
   the same height; climbing through the ceiling/floor keeps the same column.
   ============================================================================= */
(function (root) {
  const COLS = 32, ROWS = 22, TILE = 8, TOP = 16;

  function room(def, build) {
    const g = Array.from({ length: ROWS }, () => Array(COLS).fill('.'));
    const fill = (c0, r0, c1, r1, ch) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = ch; };
    // Shell: ceiling (rows 0-1), floor (rows 20-21) and side walls
    fill(0, 0, COLS - 1, 1, '#'); fill(0, ROWS - 2, COLS - 1, ROWS - 1, '#');
    fill(0, 0, 0, ROWS - 1, '#'); fill(COLS - 1, 0, COLS - 1, ROWS - 1, '#');
    build(fill);
    return { ...def, grid: g.map(r => r.join('')) };
  }
  // Doorways in the side walls are always rows 16-19: a standing player fits
  const DOOR = [16, 19];
  const doorLeft = fill => fill(0, DOOR[0], 0, DOOR[1], '.');
  const doorRight = fill => fill(COLS - 1, DOOR[0], COLS - 1, DOOR[1], '.');

  const rooms = [
    room({ id: 0, name: 'THE DUSTY CELLAR', gx: 1, gy: 1,
      theme: { wall: 'stone', ink: 'w', block: 'y', plank: 'y', ladder: 'W', pipe: 'c' } }, fill => {
      doorLeft(fill); doorRight(fill);
      fill(22, 0, 23, 19, 'H');               // ladder up through the trapdoor to the workshop
      fill(9, 16, 14, 16, '=');               // low shelf
      fill(12, 12, 17, 12, '=');              // high shelf (spark)
      fill(27, 19, 28, 19, 'X');              // crates (one high: Zizzy steps over)
      fill(1, 3, 9, 3, 'p'); fill(3, 4, 3, 4, 'i');   // steam pipe and nozzle
    }),
    room({ id: 1, name: 'THE BOILER ROOM', gx: 0, gy: 1,
      theme: { wall: 'bricks', ink: 'r', block: 'r', plank: 'y', ladder: 'W', pipe: 'c' } }, fill => {
      doorRight(fill);
      fill(8, 13, 15, 19, 'X');               // the boiler
      fill(3, 16, 6, 16, '=');                // step to the boiler top
      fill(18, 17, 20, 17, '=');              // low shelf
      fill(21, 14, 27, 14, '=');              // tool shelf (fuse)
      fill(11, 3, 30, 3, 'p'); fill(11, 4, 11, 12, 'i');
    }),
    room({ id: 2, name: 'THE FLOODED TUNNEL', gx: 2, gy: 1,
      theme: { wall: 'blocks', ink: 'b', block: 'b', plank: 'c', ladder: 'W', pipe: 'c', water: 'B' } }, fill => {
      doorLeft(fill);
      fill(0, 2, COLS - 1, 5, '#');           // low tunnel roof
      fill(7, 20, 24, 20, '~');               // flood water (solid bed below)
    }),
    room({ id: 3, name: 'THE WORKSHOP', gx: 1, gy: 0,
      theme: { wall: 'boards', ink: 'y', block: 'r', plank: 'Y', ladder: 'W', pipe: 'c' } }, fill => {
      doorRight(fill);
      fill(22, 20, 23, 21, 'H');              // ladder down through the trapdoor
      fill(2, 18, 5, 19, 'X');                // workbench
      fill(13, 16, 17, 16, '=');              // shelf
      fill(5, 12, 9, 12, '=');                // high shelf (spark), past the arc
    }),
    room({ id: 4, name: 'THE RADIO ATTIC', gx: 2, gy: 0,
      theme: { wall: 'panels', ink: 'm', block: 'y', plank: 'Y', ladder: 'W', pipe: 'c' } }, fill => {
      doorLeft(fill);
      for (let i = 0; i < 5; i++) { fill(1, 2 + i, 6 - i, 2 + i, '#'); fill(25 + i, 2 + i, 30, 2 + i, '#'); }  // roof slopes
      fill(22, 13, 28, 19, 'X');              // the grand wireless
      fill(17, 16, 20, 16, '=');              // step up to it
    })
  ];

  // Collectables: five sparks; the attic one sits behind a grate
  const sparks = [
    { id: 'cellar', room: 0, x: 124, y: 108 },
    { id: 'boiler', room: 1, x: 100, y: 116 },
    { id: 'tunnel', room: 2, x: 132, y: 132 },
    { id: 'workshop', room: 3, x: 60, y: 108 },
    { id: 'attic', room: 4, x: 44, y: 168, grate: true }
  ];

  // Items lying around at the start: x = centre, y = the surface they rest on
  const items = [
    { id: 'wrench', room: 2, x: 228, y: 176 },
    { id: 'oilcan', room: 1, x: 188, y: 176 },
    { id: 'fuse', room: 1, x: 204, y: 128 }
  ];

  const ITEM_NAMES = { wrench: 'A RUSTY WRENCH', oilcan: 'AN OIL CAN', fuse: 'A GLASS FUSE', magnet: 'A HORSESHOE MAGNET' };

  root.ZIZZY_WORLD = { COLS, ROWS, TILE, TOP, DOOR, rooms, sparks, items, ITEM_NAMES, start: { room: 0, x: 128, y: 176 } };
})(typeof window !== 'undefined' ? window : globalThis);
