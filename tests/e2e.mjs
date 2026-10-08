#!/usr/bin/env node
/**
 * End-to-end test in headless Chromium: a bot plays the whole game through the
 * same inputs a player uses (keys held tick by tick), then checks deaths,
 * respawns, game over and the fixed timestep.
 *
 *   node tests/e2e.mjs              # tests the source tree
 *   node tests/e2e.mjs dist/zizzy   # tests the packaged build
 *
 * Set CHROMIUM_PATH to use a specific browser binary.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { chromium } from "playwright";

const root = resolve(process.argv[2] || ".");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
const server = createServer(async (req, res) => {
  const path = join(root, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
  // the browser asks for /favicon.ico by itself (full Chrome does; the pages declare no icon): nothing to send
  if (/\/favicon\.ico$/.test(path)) { res.writeHead(204); return res.end(); }
  // read first, then answer: a missing file gets one 404, not a 200 header followed by a crash
  let body;
  try { body = await readFile(path); } catch { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream" }); res.end(body);
}).listen(0);
const url = `http://localhost:${server.address().port}/index.html`;

let failures = 0;
const check = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"} ${msg}`); if (!cond) failures++; };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errors = [], missing = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
page.on("response", r => { if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`); });
await page.goto(url);
await page.waitForFunction(() => window.zizzy);

// Bot helpers, installed in the page so a whole run is one synchronous call
await page.evaluate(() => {
  const Z = window.zizzy, S = () => Z.state, P = () => Z.state.p;
  const where = () => `room ${S().room} x=${P().x.toFixed(1)} y=${P().y.toFixed(1)} ground=${P().ground} climb=${P().climb}` +
    (S().dialog ? ` dialog="${S().dialog.text.slice(0, 50)}"` : "");
  const run = (keys, done, max, label) => {
    Z.setKeys(keys);
    for (let i = 0; i < max; i++) { if (done()) { Z.setKeys({}); return i; } Z.step(1); }
    Z.setKeys({});
    throw new Error(`stuck: ${label} (${where()})`);
  };
  const closeDialogs = () => { for (let i = 0; S().dialog && i < 20; i++) { Z.press("use"); Z.step(1); } };
  const settle = label => run({}, () => P().ground && !S().dialog, 400, `settle: ${label}`);
  const walkTo = (x, label) => {
    const d = x > P().x ? "right" : "left";
    run({ [d]: true }, () => (d === "right" ? P().x >= x : P().x <= x), 3000, label);
    settle(label);
  };
  /** Walk off an edge into the next room; position must carry over exactly. */
  const walkToRoom = (dir, room, label) => {
    let y = P().y, ground = P().ground;
    run({ [dir]: true }, () => { if (S().room === room) return true; y = P().y; ground = P().ground; return false; }, 3000, label);
    if (Math.abs(P().y - y) > 0.01 || P().ground !== ground) throw new Error(`${label}: changed floor on entering room ${room} (${where()})`);
  };
  const land = label => run({}, () => (P().ground || P().climb) && !S().dialog, 300, label);
  /** Jump; `steer` = [direction, ticks to hold it] for a controlled hop. */
  const hop = (steer, label) => {
    Z.setKeys({ up: true }); Z.step(1);
    if (steer) { Z.setKeys({ [steer[0]]: true }); for (let i = 0; i < steer[1] && !P().ground; i++) Z.step(1); }
    land(label);
  };
  const roll = (dir, label) => { Z.setKeys({ up: true, [dir]: true }); Z.step(1); land(label); };
  const act = a => { Z.press(a); Z.step(1); };
  window.bot = { Z, S, P, run, closeDialogs, settle, walkTo, walkToRoom, hop, roll, act, where };
});

const play = await page.evaluate(() => {
  const { Z, S, P, run, closeDialogs, settle, walkTo, walkToRoom, hop, roll, act, where } = window.bot;
  const log = [];
  const expect = (cond, what) => { if (!cond) throw new Error(`${what} (${where()})`); log.push(what); };
  Z.manual(true);
  try {
    expect(S().dialog && S().dialog.menu && S().dialog.choices.length === 2 && S().dialog.sel === 0, "the game opens on the level choice, level 1 picked");
    closeDialogs();
    expect(S().level === 0 && S().room === 0 && P().ground, "USE starts level 1 on the cellar floor");

    // --- Flooded tunnel: ride the raft, grab the wrench and the floating spark
    walkToRoom("right", 2, "cellar -> tunnel");
    walkTo(50, "edge of the left landing");
    run({}, () => S().crateX < 57, 1200, "raft at the left end");
    hop(["right", 18], "hop onto the raft");
    expect(P().support === "crate", "lands on the raft");
    run({}, () => P().x >= 126, 900, "ride to the spark");
    hop(null, "jump for the spark");
    expect(S().got.tunnel && P().support === "crate", "catches the tunnel spark and lands back on the raft");
    run({}, () => S().crateX > 175, 900, "ride to the right end");
    walkTo(228, "walk off the raft to the wrench");
    act("pick");
    expect(S().inv.includes("wrench"), "picks up the wrench");
    walkTo(206, "back to the landing edge");
    run({}, () => S().crateX > 175.5, 1200, "raft back at the right end");
    hop(["left", 12], "hop back onto the raft");
    expect(P().support === "crate", "boards the raft again");
    run({}, () => S().crateX < 56.5, 900, "ride back");
    walkToRoom("left", 0, "tunnel -> cellar");

    // --- Cellar: shut the steam valve, then the shelf spark
    walkTo(60, "to the valve");
    act("use"); closeDialogs();
    expect(S().flags.steamOff && !S().inv.includes("wrench"), "wrench shuts the steam valve");
    walkTo(100, "under the shelves");
    hop(null, "up to the low shelf");
    expect(P().y === 144 && P().support === "plank", "jumps up through the low shelf and lands on it");
    hop(null, "up to the high shelf");
    expect(P().y === 112, "reaches the high shelf");
    walkTo(124, "to the spark");
    expect(S().got.cellar, "collects the cellar spark");
    walkTo(152, "off the shelf"); settle("drop to the floor");
    expect(P().y === 176, "drops back to the floor");

    // --- Boiler room: oil can, fuse, boiler-top spark
    walkToRoom("left", 1, "cellar -> boiler room (through the old steam)");
    walkTo(188, "to the oil can"); act("pick");
    walkTo(156, "under the low shelf");
    hop(null, "onto the low shelf");
    hop(["right", 20], "onto the tool shelf");
    expect(P().y === 128, "reaches the tool shelf");
    walkTo(204, "to the fuse"); act("pick");
    expect(S().inv.includes("oilcan") && S().inv.includes("fuse"), "carries the oil can and the fuse");
    walkTo(150, "back onto the low shelf");
    expect(P().y === 152, "lands on the low shelf");
    roll("left", "roll onto the boiler");
    expect(P().y === 120, "lands on top of the boiler");
    walkTo(100, "to the boiler spark");
    expect(S().got.boiler, "collects the boiler spark");
    walkTo(136, "off the boiler");
    walkToRoom("right", 0, "boiler room -> cellar");

    // --- Up the ladder: oil the trapdoor, climb into the workshop
    walkTo(184, "to the ladder");
    run({ up: true }, () => P().climb && P().y < 51, 600, "climb to the trapdoor");
    expect(Math.abs(P().x - 184) < 0.01, "climbs centred on the ladder");
    act("use"); closeDialogs();
    expect(S().flags.trapOpen, "oil frees the trapdoor");
    run({ up: true }, () => S().room === 3 && P().ground, 600, "climb into the workshop");
    expect(Math.abs(P().x - 184) < 0.01 && P().y === 176, "comes up through the floor hatch in the same column");

    // --- Workshop: fix the robot, time the jump past the Tesla coil
    walkTo(206, "to the robot");
    act("use"); closeDialogs();
    expect(S().flags.robotFixed && S().inv.includes("magnet"), "fuse repairs Sprocket, who hands over a magnet");
    walkTo(124, "under the workshop shelf");
    hop(null, "onto the shelf");
    walkTo(108, "shelf edge");
    run({}, () => S().tick % 160 === 90, 200, "wait for the coil to rest");
    roll("left", "roll past the coil");
    expect(P().y === 112 && S().lives === 3, "clears the arc onto the high shelf");
    walkTo(60, "to the spark");
    expect(S().got.workshop, "collects the workshop spark");
    run({}, () => S().tick % 160 === 90, 200, "wait for the coil again");
    walkTo(110, "back past the coil");
    expect(S().lives === 3, "passes the coil while it rests");
    walkToRoom("right", 4, "workshop -> attic (past the robot)");

    // --- Attic: magnet the spark out of the grate, wake the wireless
    walkTo(46, "to the grate");
    act("use"); closeDialogs();
    expect(S().sparks === 5, "magnet pulls the last spark through the grate");
    walkTo(152, "under the step");
    hop(null, "onto the step");
    roll("right", "roll onto the wireless");
    expect(P().y === 120, "stands on top of the wireless");
    act("use");
    expect(S().flags.won, "the wireless sings: game won");
    closeDialogs();
    return { ok: true, log, lives: S().lives, seconds: Math.round(S().tick / 50) };
  } catch (e) {
    return { ok: false, log, error: e.message };
  }
});
for (const l of play.log) console.log(`  · ${l}`);
check(play.ok, play.ok ? `complete playthrough without losing a life (${play.lives} lives, ${play.seconds} s of game time)` : `playthrough: ${play.error}`);

// Deaths, respawn, game over
const deaths = await page.evaluate(() => {
  const { Z, S, P, run, closeDialogs, walkTo, act } = window.bot;
  const out = {};
  act("use");                       // after the ending: "USE: on to level 2"
  out.toLevel2 = S().level === 1 && S().room === 1 && /^LEVEL 2/.test((S().dialog || {}).text || "");
  Z.level(1);                       // back to level 1 for the hazards
  closeDialogs();
  walkTo(60, "towards the steam");
  run({ left: true }, () => !!S().dialog, 300, "into the steam");
  out.died = S().lives === 2 && /STEAM/.test(S().dialog.text);
  closeDialogs();
  out.respawned = S().room === 0 && P().ground && P().x > 46 && P().y === 176 && !S().dialog;
  for (let i = 0; i < 2; i++) { run({ left: true }, () => !!S().dialog, 400, "steam again"); closeDialogs(); }
  out.gameOver = /GAME OVER/.test((S().dialog || {}).text || "") || S().lives === 3;
  closeDialogs();
  out.restarted = S().lives === 3 && S().sparks === 0 && !S().flags.steamOff;
  return out;
});
check(deaths.toLevel2, "USE after the level 1 ending starts level 2");
check(deaths.died, "walking into the steam costs a life");
check(deaths.respawned, "respawns on safe ground beside the hazard");
check(deaths.gameOver && deaths.restarted, "losing all lives ends the game and USE starts a fresh one");

// Level 2, the power station: a bot plays it through, trying the wrong things first
const play2 = await page.evaluate(() => {
  const { Z, S, P, run, closeDialogs, walkTo, walkToRoom, hop, act, where } = window.bot;
  const log = [];
  const expect = (cond, what) => { if (!cond) throw new Error(`${what} (${where()})`); log.push(what); };
  const text = () => (S().dialog || {}).text || "";
  // a question: show it all, pick answer i, confirm
  const answer = i => {
    if (S().dialog.shown < S().dialog.text.length) act("use");
    act(i ? "slot1" : "slot0"); act("use");
  };
  // close texts up to the next question (closeDialogs would stop at it: USE alone never answers)
  const toQuestion = () => { for (let i = 0; S().dialog && !S().dialog.choices && i < 20; i++) act("use"); };
  const climbTo = (room, label) => run({ up: true }, () => S().room === room && P().ground && !P().climb, 900, label);
  const climbDown = (room, y, label) => run({ down: true }, () => S().room === room && P().ground && !P().climb && P().y === y, 900, label);
  Z.manual(true);
  try {
    Z.level(2);
    expect(S().level === 1 && S().room === 1 && /^LEVEL 2/.test(text()), "N / the level button starts level 2 with its intro");
    closeDialogs();

    // --- Storeroom: insulators don't close the gap, the metal spoon does
    walkToRoom("right", 2, "hall -> storeroom");
    walkTo(120, "to the stick"); act("pick");
    walkTo(60, "to the motor"); act("use");
    expect(/INSULATOR/.test(text()) && !S().flags.motorOn, "the wooden stick doesn't close the gap: wood is an insulator");
    closeDialogs(); walkTo(90, "aside"); act("pick");
    walkTo(152, "to the duck"); act("pick");
    walkTo(60, "back to the motor"); act("use");
    expect(/RUBBER IS AN INSULATOR/.test(text()) && !S().flags.motorOn, "the rubber duck doesn't either");
    closeDialogs(); walkTo(40, "aside"); act("pick");
    walkTo(184, "to the spoon"); act("pick");
    walkTo(60, "to the motor"); act("use");
    expect(S().flags.motorOn && /CONDUCTOR/.test(text()) && !S().inv.includes("spoon"), "the metal spoon closes it: the motor lowers the rope ladder");
    closeDialogs();
    walkTo(216, "to the rope ladder");
    run({ up: true }, () => P().ground && P().y === 96, 600, "climb the rope ladder");
    walkTo(184, "to the copper wire"); act("pick");
    walkTo(152, "to the shelf spark");
    expect(S().got.store && S().inv.includes("wire"), "takes the copper wire and the shelf spark");
    walkTo(216, "back to the ladder");
    climbDown(2, 176, "down the rope ladder");
    walkToRoom("left", 1, "storeroom -> hall");

    // --- Dark hall: the wire closes the loop, the light and the hatch lock come on
    walkTo(184, "to the ladder");
    run({ up: true }, () => P().climb && P().y < 51, 600, "climb to the hatch");
    expect(S().room === 1 && !S().flags.lit, "the hatch's electric lock holds while there is no power");
    climbDown(1, 176, "back down");
    walkTo(224, "to the light circuit"); act("use");
    expect(S().flags.lit && /CIRCUIT/.test(text()), "the copper wire closes the circuit: the bulb lights");
    closeDialogs();
    walkTo(60, "under the shelves");
    hop(null, "onto the low shelf"); hop(null, "onto the high shelf");
    walkTo(36, "to the hall spark");
    expect(S().got.hall, "the light shows the shelf spark");
    walkTo(120, "off the shelves");
    walkTo(184, "to the ladder");
    climbTo(3, "up through the hatch into the classroom");

    // --- Classroom: Volta's battery is flat
    walkTo(206, "to Volta"); act("use");
    expect(/BATTERY IS FLAT/.test(text()), "Volta asks for a charged battery");
    closeDialogs();
    walkTo(184, "to the hatch");
    climbDown(1, 176, "down to the hall");

    // --- Generator room: run on the dynamo's belt
    walkToRoom("left", 0, "hall -> generator room");
    walkTo(100, "onto the belt");
    const x0 = P().x;
    run({ right: true }, () => !!S().dialog, 600, "run on the belt");
    expect(S().flags.charged && Math.abs(P().x - x0) < 2, "running on the belt charges the dynamo without moving Zizzy");
    closeDialogs();
    hop(null, "jump for the dynamo spark");
    expect(S().got.dynamo, "the dynamo's spark");
    walkTo(192, "to the battery"); act("pick");
    expect(S().inv.includes("battery"), "takes the charged battery");
    walkToRoom("right", 1, "generator -> hall");
    walkTo(184, "to the ladder");
    climbTo(3, "back up to the classroom");

    // --- The quiz: a wrong answer explains and asks again
    walkTo(206, "to Volta"); act("use");
    expect(S().flags.voltaOn, "the battery wakes Volta");
    toQuestion();
    expect(S().dialog && S().dialog.choices, "Volta asks the first question");
    act("use"); act("use"); act("use");
    expect(S().dialog && S().dialog.choices, "USE alone doesn't answer: an answer has to be picked first");
    answer(1);
    expect(/INSULATOR/.test(text()) && !S().dialog.choices, "a wrong answer gets an explanation");
    toQuestion();
    expect(S().dialog && S().dialog.choices && /FLOW THROUGH/.test(text()), "and the same question again");
    for (const right of [0, 1, 0, 1]) { answer(right); toQuestion(); }
    expect(S().flags.quizDone && S().got.volta && S().inv.includes("gloves"), "four right answers: a spark and the rubber gloves");
    walkToRoom("right", 4, "classroom -> roof (Volta stepped aside)");

    // --- Roof: power off, fix the cable with gloves, power on
    walkTo(40, "to the main switch"); act("use");
    expect(!S().flags.powerOn, "the main switch turns the power off");
    closeDialogs();
    walkTo(190, "across the (now safe) puddle to the cable");
    act("use");
    expect(S().flags.cableFixed && S().sparks === 5, "with rubber gloves Zizzy fixes the cable: the fifth spark");
    closeDialogs();
    walkTo(40, "back to the switch"); act("use");
    expect(S().flags.won && S().flags.powerOn, "power on: the town lights up, level 2 won");
    closeDialogs();
    return { ok: true, log, lives: S().lives, seconds: Math.round(S().tick / 50) };
  } catch (e) {
    return { ok: false, log, error: e.message };
  }
});
for (const l of play2.log) console.log(`  · ${l}`);
check(play2.ok, play2.ok ? `level 2 played through without losing a life (${play2.lives} lives, ${play2.seconds} s of game time)` : `level 2: ${play2.error}`);

// Level 2 hazard: the puddle under the live cable
const puddle = await page.evaluate(() => {
  const { Z, S, P, run, closeDialogs, walkTo } = window.bot;
  Z.level(2); closeDialogs();
  Object.assign(S(), { room: 4 }); Object.assign(P(), { x: 40, y: 176 });
  run({ right: true }, () => !!S().dialog, 400, "into the puddle");
  const died = S().lives === 2 && /WATER/.test(S().dialog.text);
  closeDialogs();
  return { died, safe: S().room === 4 && P().x < 104 && P().ground };
});
check(puddle.died && puddle.safe, "the puddle under the live cable costs a life and Zizzy respawns before it");

// The level button: asks once while playing, remembered, ?level= in the address
{
  const lv = await page.evaluate(() => {
    const { Z, S, closeDialogs } = window.bot;
    closeDialogs(); Z.step(5);
    Z.press("level"); Z.step(1);
    const asked = S().level === 1 && /AGAIN FOR LEVEL 1/.test((S().speech || {}).text || "");
    Z.press("level"); Z.step(1);
    return { asked, switched: S().level === 0, stored: localStorage.getItem("zizzy-level") };
  });
  check(lv.asked && lv.switched && lv.stored === "1", "the level button asks once while playing, then switches level (and remembers it)");
  await page.goto(url + "?level=2"); await page.waitForFunction(() => window.zizzy);
  const q = await page.evaluate(() => ({ level: window.zizzy.state.level, on: document.querySelector('#level [data-v="1"]').classList.contains("on") }));
  check(q.level === 1 && q.on, "?level=2 in the address opens level 2, and the HUD shows it");
  await page.click("#lang"); await page.evaluate(() => window.zizzy.step(1));
  const ru = await page.evaluate(() => ({ d: window.zizzy.state.dialog.text, slot: document.getElementById("slot0").textContent }));
  check(/^УРОВЕНЬ 2: ЭЛЕКТРОСТАНЦИЯ/.test(ru.d), `level 2 in Russian ("${ru.d.slice(0, 25)}…")`);
  await page.click("#lang"); await page.evaluate(() => window.zizzy.step(1));

  // the start screen remembers the level played last, and a tap on a level starts it
  await page.evaluate(() => localStorage.setItem("zizzy-level", "2"));
  await page.goto(url); await page.waitForFunction(() => window.zizzy);
  const m = await page.evaluate(() => { const Z = window.zizzy; Z.manual(true); Z.step(80); const d = Z.state.dialog; return { menu: !!(d && d.menu), sel: d && d.sel, text: d && d.text }; });
  check(m.menu && m.sel === 1 && /CHOOSE A LEVEL/.test(m.text), "without ?level= the start screen offers both levels, the last one played picked");
  const box = await page.locator("#screen").boundingBox();
  const row = await page.evaluate(() => window.zizzy.state.dialog.rows[0]);
  await page.mouse.click(box.x + box.width / 2, box.y + (row[0] + row[1]) / 2 * box.height / 192);
  await page.evaluate(() => window.zizzy.step(2));
  const t = await page.evaluate(() => ({ level: window.zizzy.state.level, intro: (window.zizzy.state.dialog || {}).text || "" }));
  check(t.level === 0 && /^ZIZZY THE LITTLE VALVE/.test(t.intro), "tapping LEVEL 1 on the start screen starts level 1");
  await page.goto(url + "?level=1"); await page.waitForFunction(() => window.zizzy);
}

// English / Russian: the EN/RU button switches the page, the HUD and the canvas texts
{
  const read = () => page.evaluate(() => ({
    lang: document.documentElement.lang, title: document.title,
    slot: document.getElementById("slot0").textContent, mute: document.getElementById("mute").textContent,
    use: document.querySelector('[data-act="use"]').textContent, keys: document.querySelector(".keys").textContent,
    dialog: window.zizzy.state.dialog && window.zizzy.state.dialog.text, stored: localStorage.getItem("zizzy-lang")
  }));
  await page.evaluate(() => { window.zizzy.manual(true); window.zizzy.state.dialog = null; window.zizzy.state.inv = [null, null]; });
  // an open dialog switches with the page
  await page.evaluate(() => { window.zizzy.press("restart"); window.zizzy.press("restart"); window.zizzy.step(2); });
  const en = await read();
  await page.click("#lang");
  await page.evaluate(() => window.zizzy.step(1));
  const ru = await read();
  check(en.lang === "en" && /^ZIZZY THE LITTLE VALVE/.test(en.dialog || "") && en.slot === "EMPTY",
    `starts in English ("${en.slot}", dialog "${(en.dialog || "").slice(0, 24)}…")`);
  check(ru.lang === "ru" && ru.slot === "ПУСТО" && /^ЗВУК /.test(ru.mute) && ru.use === "ДЕЙСТВИЕ" && /идти/.test(ru.keys) && /Зиззи/.test(ru.title),
    `EN/RU switches the page to Russian (inventory "${ru.slot}", "${ru.mute}", "${ru.use}")`);
  check(/^МАЛЕНЬКАЯ РАДИОЛАМПА ЗИЗЗИ/.test(ru.dialog || ""), `the dialog on screen switches too ("${(ru.dialog || "").slice(0, 28)}…")`);
  check(ru.stored === "ru", "the choice is remembered");
  await page.reload(); await page.waitForFunction(() => window.zizzy);
  const again = await read();
  check(again.lang === "ru" && again.slot === "ПУСТО", "after a reload the game is still in Russian");
  await page.keyboard.press("KeyL");
  await page.waitForFunction(() => document.documentElement.lang === "en");
  const back = await read();
  check(back.slot === "EMPTY" && back.stored === "en", "the L key switches back to English");
  await page.goto(url + "?lang=ru"); await page.waitForFunction(() => window.zizzy);
  check((await read()).lang === "ru", "?lang=ru in the address opens the game in Russian (for embeds)");
  await page.goto(url); await page.waitForFunction(() => window.zizzy);
}

// Real-time loop: 50 updates per second regardless of display refresh
const rate = await page.evaluate(async () => {
  window.zizzy.manual(false);
  const t0 = window.zizzy.state.tick;
  await new Promise(r => setTimeout(r, 2000));
  return (window.zizzy.state.tick - t0) / 2;
});
check(Math.abs(rate - 50) < 4, `simulation runs at ${rate.toFixed(1)} updates/s (fixed 50 Hz)`);

const blank = await page.evaluate(() => {
  const c = document.getElementById("screen"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 0) lit++;
  return lit / (d.length / 4);
});
check(blank > 0.1, `screen is drawn (${(blank * 100).toFixed(0)}% lit pixels)`);
check(missing.length === 0, `every asset loads${missing.length ? `: ${missing.join(", ")}` : ""}`);
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);

await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
