'use strict';
/* =============================================================================
   Zizzy — art: 8-bit palette, sprites and tile patterns, all drawn as pixel
   maps in code (original artwork; no image files).
   Sprite maps use one character per pixel: a palette key, '.' = transparent.
   ============================================================================= */

// Classic 8-bit home-computer palette: 8 colours, normal and bright.
const PAL = {
  K: '#000000', b: '#0000d7', r: '#d70000', m: '#d700d7', g: '#00d700', c: '#00d7d7', y: '#d7d700', w: '#d7d7d7',
  B: '#0000ff', R: '#ff0000', M: '#ff00ff', G: '#00ff00', C: '#00ffff', Y: '#ffff00', W: '#ffffff'
};

function newCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Pixel map (array of strings) -> canvas. `swap` remaps palette keys. */
function sprite(rows, swap) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = newCanvas(w, h), g = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      let ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      if (swap && swap[ch]) ch = swap[ch];
      g.fillStyle = PAL[ch];
      g.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

function mirrored(src) {
  const c = newCanvas(src.width, src.height), g = c.getContext('2d');
  g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
  return c;
}

/** Nearest-neighbour rotation onto a square canvas: stays crisp, no smoothing. */
function rotated(src, angle, size) {
  const out = newCanvas(size, size), og = out.getContext('2d');
  const sd = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
  const img = og.createImageData(size, size), d = img.data;
  const cos = Math.cos(-angle), sin = Math.sin(-angle);
  const scx = src.width / 2, scy = src.height / 2, dc = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - dc, dy = y + 0.5 - dc;
      const sx = Math.floor(dx * cos - dy * sin + scx), sy = Math.floor(dx * sin + dy * cos + scy);
      if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue;
      const si = (sy * src.width + sx) * 4, di = (y * size + x) * 4;
      d[di] = sd[si]; d[di + 1] = sd[si + 1]; d[di + 2] = sd[si + 2]; d[di + 3] = sd[si + 3];
    }
  }
  og.putImageData(img, 0, 0);
  return out;
}

// ---- Zizzy: a small glass valve with a glowing filament face (facing right) --
const ZIZZY_TOP = [
  '....CCCC....',
  '..CCWyyyCC..',
  '.CWyyYYYyyC.',
  '.CWyYYYYYyC.',
  'CWyYYKYYKYyC',
  'CyyYYKYYKYyC',
  'CyYYYYYYYYyC',
  'CyYYRYYYYRyC',
  '.CyYYKYYKYC.',
  '.CyyYYKKYyC.',
  '..CyyyyyyC..',
  '..CCCCCCCC..',
  '..wwwwwwww..',
  '..wKwKwKww..',
  '..wwwwwwww..'
];
const ZIZZY_LEGS = {
  stand: ['...Y....Y...', '...Y....Y...', '..WW....WW..'],
  stepA: ['...Y....Y...', '..Y......Y..', '.WW......WW.'],
  stepB: ['....Y..Y....', '....Y..Y....', '...WW..WW...']
};

const ROBOT = [
  '.......E........',
  '.......w........',
  '...wwwwwwwwww...',
  '...wKKKKKKKKw...',
  '...wKEEKKEEKw...',
  '...wKKKKKKKKw...',
  '...wKwKwKwKKw...',
  '...wwwwwwwwww...',
  '.....wwwwww.....',
  '.wwwwwwwwwwwwww.',
  '.wbbbbbbbbbbbbw.',
  '.wbYYbbbbbbbbbw.',
  '.wbbbbbbbbRRbbw.',
  'ww.bbbbbbbbbb.ww',
  'w..bbbbbbbbbb..w',
  'W..wwwwwwwwww..W',
  '...wKwKwKwKwK...',
  '..wwwwwwwwwwww..',
  '..wKKKKKKKKKKw..',
  '...wwwwwwwwww...'
];

const SPARK = [
  '....YYY.',
  '...YYY..',
  '..YYY...',
  '.YYYYYY.',
  '...YYY..',
  '..YYY...',
  '.YYY....',
  '.Y......'
];

const ITEM_ART = {
  oilcan: [
    '......Y...',
    '.....Y....',
    '...wwY....',
    '..rrrrrr..',
    '.rRRRRRRr.',
    '.rRWRRRRr.',
    '.rRRRRRRr.',
    '.rrrrrrrr.'
  ],
  wrench: [
    'W.W.........',
    'WWWWWWWWWW..',
    'W.W.....WWWW',
    '.........WW.'
  ],
  fuse: [
    'yyCCCCCCyy',
    'yyCWWWWCyy',
    'yyCCCCCCyy'
  ],
  magnet: [
    '.WW..WW.',
    '.RR..RR.',
    '.RR..RR.',
    '.RR..RR.',
    '.RRRRRR.',
    '..RRRR..'
  ],
  // level 2: things to try in a circuit's gap, and what the puzzles hand over
  stick: [
    'yy..........',
    '.yyyyyyyyyyy',
    '..........yy'
  ],
  duck: [
    '..YYY...',
    '.YYKYR..',
    '.YYYYRR.',
    '..YY....',
    'YYYYYYY.',
    'YYYYYYYY',
    '.YYYYYY.'
  ],
  spoon: [
    '.www........',
    'wWWWw.......',
    'wWWWwwwwwwww',
    '.www........'
  ],
  wire: [
    '..rRRr..',
    '.R....R.',
    'r.rRRr.r',
    '.R....R.',
    '..rRRrrr',
    '.......Y'
  ],
  battery: [
    '..ww..',
    'GGGGGG',
    'GWGGGG',
    'GGGGGG',
    'gggggg',
    'gggggg',
    'gggggg',
    'gggggg'
  ],
  gloves: [
    '.Y.Y.....Y.Y.',
    'YYYY....YYYY.',
    'YYYYY..YYYYY.',
    'YYYY....YYYY.',
    'yyy......yyy.'
  ]
};

const LIFE_ICON = [
  '.CCC.',
  'CWYYC',
  'CYYYC',
  'CYYYC',
  '.CCC.',
  '.www.',
  '.Y.Y.'
];

// ---- 8x8 tile patterns: '1' = ink, '0' = paper (attribute-cell style) ------
const PATTERNS = {
  bricks: ['11110111', '11110111', '11110111', '00000000', '01111111', '01111111', '01111111', '00000000'],
  stone: ['01111100', '11111110', '11111110', '11111100', '00000000', '11000111', '11101111', '11101110'],
  blocks: ['11111110', '10000010', '10000010', '10000010', '10000010', '10000010', '11111110', '00000000'],
  boards: ['11011101', '11011101', '11011101', '11011101', '10011001', '11011101', '11011101', '11011101'],
  panels: ['11111111', '10000001', '10111101', '10100101', '10100101', '10111101', '10000001', '11111111'],
  crate: ['11111111', '11000011', '10100101', '10011001', '10011001', '10100101', '11000011', '11111111'],
  plank: ['11111111', '10101011', '11111111', '00000000', '00000000', '00000000', '00000000', '00000000'],
  ladder: ['10000001', '10000001', '11111111', '10000001', '10000001', '10000001', '11111111', '10000001'],
  pipeH: ['00000000', '11111111', '10000000', '00000000', '00000000', '11111111', '00000000', '00000000'],
  pipeV: ['01000100', '01000100', '01000100', '01000100', '01000100', '01000100', '01000100', '01000100'],
  water0: ['00110000', '11001100', '00000011', '10000000', '00011000', '00000110', '01100000', '00000001'],
  water1: ['00001100', '00110011', '11000000', '00000001', '00011000', '01100000', '00000110', '10000000']
};

function tile(pattern, ink) {
  const c = newCanvas(8, 8), g = c.getContext('2d');
  g.fillStyle = PAL[ink];
  PATTERNS[pattern].forEach((row, y) => { for (let x = 0; x < 8; x++) if (row[x] === '1') g.fillRect(x, y, 1, 1); });
  return c;
}

/** Build every sprite once at start-up. */
function buildArt() {
  const zizzy = legs => sprite(ZIZZY_TOP.concat(ZIZZY_LEGS[legs]));
  const right = { stand: zizzy('stand'), stepA: zizzy('stepA'), stepB: zizzy('stepB') };
  const left = { stand: mirrored(right.stand), stepA: mirrored(right.stepA), stepB: mirrored(right.stepB) };
  const roll = { 1: [], '-1': [] };
  for (let i = 0; i < 16; i++) {
    roll[1].push(rotated(right.stand, (i / 16) * Math.PI * 2, 24));
    roll[-1].push(rotated(left.stand, -(i / 16) * Math.PI * 2, 24));
  }
  return {
    zizzy: { 1: right, '-1': left, roll },
    robotBroken: sprite(ROBOT, { E: 'R' }),
    robotFixed: sprite(ROBOT, { E: 'G' }),
    // Volta the teacher robot (level 2): magenta, dark until her battery is in
    voltaOff: sprite(ROBOT, { E: 'K', b: 'm', Y: 'w', R: 'K' }),
    voltaOn: sprite(ROBOT, { E: 'C', b: 'm', R: 'G' }),
    spark: [sprite(SPARK), sprite(SPARK, { Y: 'W' })],
    items: Object.fromEntries(Object.entries(ITEM_ART).map(([k, v]) => [k, sprite(v)])),
    life: sprite(LIFE_ICON)
  };
}
