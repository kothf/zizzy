'use strict';
/* =============================================================================
   Zizzy — the world of level 2, "The Power Station": five rooms where every
   puzzle is a first lesson in electricity (for players of about 7-10):
     generator room  a dynamo turns running into electricity
     dark hall       a circuit only works as a closed loop
     storeroom       metal conducts; wood and rubber insulate
     classroom       Volta the robot teacher's quiz
     roof substation switch the power off first, rubber gloves, water is danger
   Same tile rules as level 1 (see world.js).
   ============================================================================= */
(function (root) {
  const { COLS, ROWS, TILE, TOP, DOOR } = root.ZIZZY_WORLD;
  const { room, doorLeft, doorRight } = root.ZIZZY_ROOM;

  const rooms = [
    room({ id: 0, name: 'THE GENERATOR ROOM', gx: 0, gy: 1,
      theme: { wall: 'blocks', ink: 'g', block: 'y', plank: 'Y', ladder: 'W', pipe: 'c' } }, fill => {
      doorRight(fill);
      fill(1, 3, 6, 3, 'p'); fill(6, 4, 6, 9, 'i');           // cable from the dynamo up to the ceiling
    }),
    room({ id: 1, name: 'THE DARK HALL', gx: 1, gy: 1,
      theme: { wall: 'stone', ink: 'w', block: 'y', plank: 'y', ladder: 'W', pipe: 'c' } }, fill => {
      doorLeft(fill); doorRight(fill);
      fill(22, 0, 23, 19, 'H');               // ladder up to the hatch (electric lock) into the classroom
      fill(7, 16, 12, 16, '=');               // low shelf
      fill(2, 12, 7, 12, '=');                // high shelf (spark, once the light is on)
    }),
    room({ id: 2, name: 'THE STOREROOM', gx: 2, gy: 1,
      theme: { wall: 'boards', ink: 'y', block: 'r', plank: 'Y', ladder: 'W', pipe: 'c' } }, fill => {
      doorLeft(fill);
      fill(17, 10, 25, 10, '=');              // high shelf (spark); the rope ladder (cols 26-27) comes down when the motor runs
      fill(29, 19, 30, 19, 'X');              // boxes in the corner
    }),
    room({ id: 3, name: "VOLTA'S CLASSROOM", gx: 1, gy: 0,
      theme: { wall: 'panels', ink: 'c', block: 'b', plank: 'Y', ladder: 'W', pipe: 'c' } }, fill => {
      doorRight(fill);
      fill(22, 20, 23, 21, 'H');              // ladder down through the hatch to the hall
      fill(3, 18, 8, 19, 'X');                // teacher's desk
    }),
    room({ id: 4, name: 'THE ROOF SUBSTATION', gx: 2, gy: 0,
      theme: { wall: 'bricks', ink: 'b', block: 'y', plank: 'Y', ladder: 'W', pipe: 'c' } }, fill => {
      doorLeft(fill);
      for (let i = 0; i < 4; i++) fill(27 + i, 2 + i, 30, 2 + i, '#');   // roof slope
      fill(1, 3, 30, 3, 'p');                 // the power line along the ceiling
    })
  ];

  // Sparks: `when` = shown (and collectable) only once that puzzle flag is set;
  // `given` = handed over by a puzzle (never lying around)
  const sparks = [
    { id: 'dynamo', room: 0, x: 100, y: 128, when: 'charged' },
    { id: 'hall', room: 1, x: 36, y: 104, when: 'lit' },
    { id: 'store', room: 2, x: 152, y: 86 },
    { id: 'volta', room: 3, given: true },
    { id: 'cable', room: 4, given: true }
  ];

  const items = [
    { id: 'stick', room: 2, x: 120, y: 176 },
    { id: 'duck', room: 2, x: 152, y: 176 },
    { id: 'spoon', room: 2, x: 184, y: 176 },
    { id: 'wire', room: 1, x: 212, y: 176 }       // on the floor right under the light circuit's gap
  ];

  const level2 = { COLS, ROWS, TILE, TOP, DOOR, rooms, sparks, items, start: { room: 1, x: 128, y: 176 } };
  (root.ZIZZY_WORLDS = root.ZIZZY_WORLDS || []).push(level2);
})(typeof window !== 'undefined' ? window : globalThis);
