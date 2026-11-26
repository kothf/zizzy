'use strict';
/* =============================================================================
   Zizzy — the world of level 4, "The Lighthouse": five rooms where every
   puzzle is one more lesson in electricity (for players of about 7-10):
     keeper's hut   a solar panel turns light into electricity; dust blocks it
     battery room   batteries in a row: each + touches the next one's -
     fuse room      too much plugged into one socket overheats the wire; a
                    fuse is a thin wire that melts first, to keep us safe
     garland room   bulbs in a chain (in series): one broken bulb, all dark
     lamp room      the lighthouse lamp and its lens guide the ship home
   The lighthouse stands on a grid of its own: the hut and the battery room at
   the bottom, the garland and fuse rooms above, the lamp room on top.
   Same tile rules as level 1 (see world.js).
   ============================================================================= */
(function (root) {
  const { COLS, ROWS, TILE, TOP, DOOR } = root.ZIZZY_WORLD;
  const { room, doorLeft, doorRight } = root.ZIZZY_ROOM;

  const rooms = [
    room({ id: 0, name: "THE KEEPER'S HUT", gx: 0, gy: 2,
      theme: { wall: 'boards', ink: 'y', block: 'r', plank: 'Y', ladder: 'W', pipe: 'c' } }, fill => {
      doorRight(fill);
      fill(3, 16, 8, 16, '=');                // a shelf (the rag lies on it)
      fill(18, 3, 30, 3, 'p');                // the panel's cable along the ceiling
    }),
    room({ id: 1, name: 'THE BATTERY ROOM', gx: 1, gy: 2,
      theme: { wall: 'stone', ink: 'w', block: 'y', plank: 'Y', ladder: 'W', pipe: 'c' } }, fill => {
      doorLeft(fill);
      fill(4, 0, 5, 19, 'H');                 // ladder up to the fuse room
      fill(22, 16, 27, 16, '=');              // a shelf (the spare fuse lies on it)
    }),
    room({ id: 2, name: 'THE FUSE ROOM', gx: 1, gy: 1,
      theme: { wall: 'bricks', ink: 'r', block: 'y', plank: 'Y', ladder: 'W', pipe: 'c' } }, fill => {
      doorLeft(fill);
      fill(4, 20, 5, 21, 'H');                // ladder down to the battery room
      fill(26, 0, 27, 19, 'H');               // ladder up to the lamp room
      fill(6, 3, 23, 3, 'p');                 // the mains cable along the ceiling (between the ladders)
    }),
    room({ id: 3, name: 'THE GARLAND ROOM', gx: 0, gy: 1,
      theme: { wall: 'panels', ink: 'm', block: 'b', plank: 'Y', ladder: 'W', pipe: 'c' } }, fill => {
      doorRight(fill);
      fill(3, 16, 8, 16, '=');                // low shelf
      fill(7, 12, 13, 12, '=');               // middle shelf (the spare bulb)
      fill(14, 8, 19, 8, '=');                // top shelf (a spark)
    }),
    room({ id: 4, name: 'THE LAMP ROOM', gx: 1, gy: 0,
      theme: { wall: 'blocks', ink: 'c', block: 'y', plank: 'Y', ladder: 'W', pipe: 'c' } }, fill => {
      fill(26, 20, 27, 21, 'H');              // ladder up from the fuse room
      for (let i = 0; i < 4; i++) { fill(1, 2 + i, 4 - i, 2 + i, '#'); fill(27 + i, 2 + i, 30, 2 + i, '#'); }   // the dome
    })
  ];

  // Sparks: `when` = shown once that puzzle flag is set; `given` = handed over by a puzzle
  const sparks = [
    { id: 'sun', room: 0, x: 232, y: 164, when: 'panelClean' },
    { id: 'battery', room: 1, given: true },
    { id: 'fuse', room: 2, given: true },
    { id: 'garland', room: 3, given: true },
    { id: 'shelf', room: 3, x: 136, y: 68 }
  ];

  const items = [
    { id: 'rag', room: 0, x: 44, y: 144 },        // on the hut's shelf
    { id: 'fuse', room: 1, x: 196, y: 144 },      // on the battery room's shelf
    { id: 'bulb', room: 3, x: 84, y: 112 }        // on the garland room's middle shelf
  ];

  const level4 = { COLS, ROWS, TILE, TOP, DOOR, rooms, sparks, items, start: { room: 0, x: 96, y: 176 } };
  (root.ZIZZY_WORLDS = root.ZIZZY_WORLDS || []).push(level4);
})(typeof window !== 'undefined' ? window : globalThis);
