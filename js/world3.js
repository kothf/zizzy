'use strict';
/* =============================================================================
   Zizzy — the world of level 3, "The Radio Tower": five rooms where every
   puzzle is a first lesson in radio (for players of about 7-10):
     sound room      sound is a vibration; a speaker needs a magnet and a coil
     crane yard      an electromagnet: a magnet you switch on and off (iron only)
     Dot's radio room  Morse code: short and long beeps make letters (SOS)
     listening room  every station has its own frequency: tune the dial
     antenna roof    a high antenna reaches far; a lightning rod in a storm
   The tower stands on a grid of its own: the sound room and the crane yard at
   the bottom, the radio and listening rooms above, the roof on top.
   Same tile rules as level 1 (see world.js).
   ============================================================================= */
(function (root) {
  const { COLS, ROWS, TILE, TOP, DOOR } = root.ZIZZY_WORLD;
  const { room, doorLeft, doorRight } = root.ZIZZY_ROOM;

  const rooms = [
    room({ id: 0, name: 'THE SOUND ROOM', gx: 1, gy: 2,
      theme: { wall: 'panels', ink: 'm', block: 'y', plank: 'Y', ladder: 'W', pipe: 'c' } }, fill => {
      doorLeft(fill);
      fill(4, 0, 5, 19, 'H');                 // ladder up to Dot's radio room
    }),
    room({ id: 1, name: 'THE CRANE YARD', gx: 0, gy: 2,
      theme: { wall: 'bricks', ink: 'r', block: 'y', plank: 'Y', ladder: 'W', pipe: 'c' } }, fill => {
      doorRight(fill);
      fill(1, 14, 6, 14, '=');                // high ledge (ring magnet, spark): too high to jump from the floor
      fill(18, 18, 19, 19, 'X');              // a wooden crate (the electromagnet won't lift it)
    }),
    room({ id: 2, name: "DOT'S RADIO ROOM", gx: 1, gy: 1,
      theme: { wall: 'boards', ink: 'y', block: 'r', plank: 'Y', ladder: 'W', pipe: 'c' } }, fill => {
      doorLeft(fill);
      fill(4, 20, 5, 21, 'H');                // ladder down to the sound room
      fill(27, 0, 28, 19, 'H');               // ladder up to the roof (Dot stands in front of it)
    }),
    room({ id: 3, name: 'THE LISTENING ROOM', gx: 0, gy: 1,
      theme: { wall: 'stone', ink: 'c', block: 'b', plank: 'Y', ladder: 'W', pipe: 'c' } }, fill => {
      doorRight(fill);
      fill(1, 3, 30, 3, 'p');                 // the aerial lead along the ceiling
    }),
    room({ id: 4, name: 'THE ANTENNA ROOF', gx: 1, gy: 0,
      theme: { wall: 'bricks', ink: 'b', block: 'y', plank: 'Y', ladder: 'W', pipe: 'c' } }, fill => {
      fill(27, 20, 28, 21, 'H');              // ladder up from the radio room
    })
  ];

  const sparks = [
    { id: 'speaker', room: 0, x: 150, y: 164, when: 'speakerOn' },
    { id: 'crane', room: 1, x: 24, y: 116 },
    { id: 'dot', room: 2, given: true },
    { id: 'tuner', room: 3, given: true },
    { id: 'antenna', room: 4, given: true }
  ];

  const items = [
    { id: 'ringmagnet', room: 1, x: 44, y: 128 }   // on the high ledge
  ];

  const level3 = { COLS, ROWS, TILE, TOP, DOOR, rooms, sparks, items, start: { room: 0, x: 128, y: 176 } };
  (root.ZIZZY_WORLDS = root.ZIZZY_WORLDS || []).push(level3);
})(typeof window !== 'undefined' ? window : globalThis);
