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
