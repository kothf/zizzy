/**
 * Static checks of the world data (node --test). These guarantee that room
 * edges line up, so walking or climbing between rooms always keeps Zizzy on
 * the same floor.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";

runInThisContext(readFileSync(new URL("../js/world.js", import.meta.url), "utf8"), { filename: "world.js" });
const { COLS, ROWS, TILE, TOP, rooms, sparks, items, start } = globalThis.ZIZZY_WORLD;
const solid = ch => ch === "#" || ch === "X";
const at = (gx, gy) => rooms.find(r => r.gx === gx && r.gy === gy);
const name = r => `${r.name} (room ${r.id})`;

test("every room is a 32x22 grid of known tiles", () => {
  assert.equal(rooms.length, 5);
  rooms.forEach((r, i) => {
    assert.equal(r.id, i);
    assert.equal(r.grid.length, ROWS, name(r));
    for (const row of r.grid) {
      assert.equal(row.length, COLS, name(r));
      assert.match(row, /^[#X=H~pi.]+$/, name(r));
    }
  });
});

test("side edges match their neighbour row for row, at the same floor height", () => {
  for (const r of rooms) {
    for (const [dx, mine, theirs] of [[-1, 0, COLS - 1], [1, COLS - 1, 0]]) {
      const n = at(r.gx + dx, r.gy);
      const open = r.grid.map(row => !solid(row[mine]));
      if (!n) { assert.ok(open.every(o => !o), `${name(r)}: open ${dx < 0 ? "left" : "right"} edge leads nowhere`); continue; }
      const nOpen = n.grid.map(row => !solid(row[theirs]));
      assert.deepEqual(open, nOpen, `${name(r)} and ${name(n)} doorways differ`);
      // every doorway has a floor directly below on both sides and fits a standing Zizzy (3+ tiles)
      for (let row = 0; row < ROWS; row++) {
        if (!open[row] || (row + 1 < ROWS && open[row + 1])) continue;
        let h = 0; while (row - h >= 0 && open[row - h]) h++;
        assert.ok(h >= 3, `${name(r)}: doorway ending at row ${row} is only ${h} tiles tall`);
        assert.ok(solid(r.grid[row + 1][mine]) && solid(n.grid[row + 1][theirs]), `${name(r)}: doorway has no floor`);
      }
    }
  }
});

test("ceiling and floor openings match the room above/below column for column", () => {
  for (const r of rooms) {
    for (const [dy, mine, theirs] of [[-1, 0, ROWS - 1], [1, ROWS - 1, 0]]) {
      const n = at(r.gx, r.gy + dy);
      const open = [...r.grid[mine]].map(ch => !solid(ch));
      if (!n) { assert.ok(open.every(o => !o), `${name(r)}: open ${dy < 0 ? "ceiling" : "floor"} leads nowhere`); continue; }
      assert.deepEqual(open, [...n.grid[theirs]].map(ch => !solid(ch)), `${name(r)} / ${name(n)}`);
      // vertical passages are ladders on both sides
      [...r.grid[mine]].forEach((ch, c) => { if (!solid(ch)) assert.equal(ch, "H", `${name(r)} col ${c}`); });
    }
  }
});

test("every room is reachable from the start room", () => {
  const seen = new Set([start.room]), queue = [rooms[start.room]];
  while (queue.length) {
    const r = queue.shift();
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const n = at(r.gx + dx, r.gy + dy);
      if (n && !seen.has(n.id)) { seen.add(n.id); queue.push(n); }
    }
  }
  assert.equal(seen.size, rooms.length);
});

test("items rest on a surface; sparks float in open space", () => {
  const cell = (rid, x, y) => rooms[rid].grid[Math.floor((y - TOP) / TILE)][Math.floor(x / TILE)];
  for (const it of [...items, { ...start, id: "start" }]) {
    assert.equal((it.y - TOP) % TILE, 0, `${it.id} is not on a tile boundary`);
    assert.ok(!solid(cell(it.room, it.x, it.y - 1)), `${it.id} is inside a wall`);
    assert.ok(["#", "X", "=", "H"].includes(cell(it.room, it.x, it.y)), `${it.id} is floating`);
  }
  assert.equal(sparks.length, 5);
  for (const s of sparks) assert.ok(!solid(cell(s.room, s.x, s.y)), `spark ${s.id} is inside a wall`);
});

// ---- English / Russian texts ------------------------------------------------
runInThisContext(readFileSync(new URL("../js/i18n.js", import.meta.url), "utf8"), { filename: "i18n.js" });
runInThisContext(readFileSync(new URL("../js/font.js", import.meta.url), "utf8"), { filename: "font.js" });
const { STRINGS } = globalThis.ZIZZY_I18N;
const GLYPHS = runInThisContext("GLYPHS"), ALIAS = runInThisContext("GLYPH_ALIAS"), wrap = runInThisContext("wrapText");
// every on-screen text with its placeholders filled at their longest
const longestItem = lang => Object.keys(STRINGS[lang]).filter(k => k.startsWith("item.")).map(k => STRINGS[lang][k]).sort((a, b) => b.length - a.length)[0];
const filled = (lang, key) => STRINGS[lang][key].replace(/\{n\}/g, "5").replace(/\{t\}/g, "12:34").replace(/\{item\}/g, longestItem(lang));
const canvasKeys = lang => Object.keys(STRINGS[lang]).filter(k => !k.startsWith("html."));

test("English and Russian have the same texts", () => {
  assert.deepEqual(Object.keys(STRINGS.ru).sort(), Object.keys(STRINGS.en).sort());
});

test("every character on the canvas exists in the 8-px font, in both languages", () => {
  for (const lang of ["en", "ru"]) for (const k of canvasKeys(lang)) {
    const missing = [...new Set([...filled(lang, k).toUpperCase()].filter(ch => ch !== " " && ch !== "\n" && !GLYPHS[ch] && !GLYPHS[ALIAS[ch]]))];
    assert.deepEqual(missing, [], `${lang} ${k}: no glyph for ${missing.join(" ")}`);
  }
});

test("texts fit their boxes in both languages", () => {
  for (const lang of ["en", "ru"]) {
    const S = STRINGS[lang];
    for (let i = 0; i < 5; i++) assert.ok(S[`room.${i}`].length <= 22, `${lang} room ${i} name fits the status line between lives and sparks`);
    for (const k of ["sign.deep", "sign.stop"]) assert.ok(S[k].length <= 4, `${lang} ${k} fits the painted sign`);
    assert.ok(S.playAgain.length <= 25, `${lang} playAgain fits its 200 px banner`);
    for (const k of canvasKeys(lang)) {
      const text = filled(lang, k);
      // dialogs: 28 characters a line, at most 17 lines on the 192 px screen
      const lines = wrap(text, 28);
      assert.ok(lines.every(l => l.length <= 28) && lines.length <= 17, `${lang} ${k}: ${lines.length} dialog lines`);
      // speech bubbles: 22 characters a line
      assert.ok(wrap(text, 22).every(l => l.length <= 22), `${lang} ${k}: a word longer than a speech bubble`);
    }
  }
});
