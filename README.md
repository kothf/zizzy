# Zizzy

A flip-screen 8-bit adventure for the browser. Zizzy, a little glowing radio
valve, has rolled out of the grand old wireless and into the cellar of an
abandoned radio station. Find five sparks and climb back up to the attic to
make the radio sing again.

**Play:** [kothf.github.io/zizzy](https://kothf.github.io/zizzy/) ·
also on [aerocat.tech/games](https://aerocat.tech/games/)

![Zizzy grabbing a spark mid-somersault in the Dusty Cellar](screenshot.png)

## The game

**Level 1, the Radio Station.** Five rooms: the Dusty Cellar, the Boiler Room,
the Flooded Tunnel, the Workshop and the Radio Attic. Each one has a puzzle: a
scalding steam leak, a rusted trapdoor, a raft across deep water, a crackling
Tesla coil and a robot called Sprocket who won't let anyone pass. Zizzy can
carry two things at once, so think about what to take where.

**Level 2, the Power Station** — first lessons in electricity for players of
about 7 to 10. The lights have gone out, and every puzzle is one idea:

- *Storeroom:* a motor's wire has a gap. The wooden stick and the rubber duck
  don't close it (insulators); the metal spoon does (a conductor).
- *Dark Hall:* a battery, a bulb and a broken wire. A long copper wire closes
  the loop, the bulb lights, and the same power opens the hatch's electric lock.
- *Generator Room:* run on the dynamo's belt to turn running into electricity
  and charge a battery.
- *Volta's Classroom:* the battery wakes Volta, the teacher robot, who asks four
  questions (conductors, circuits, switches, wet hands). A wrong answer gets an
  explanation and the question again.
- *Roof Substation:* a broken cable sparks over a puddle. Switch the power off
  first, fix the cable wearing rubber gloves, then switch on and light up the town.

Wrong tries explain instead of punishing; only the live puddle costs a life.
Finishing level 1 leads on to level 2, and the LEVEL button (key N) or
`?level=2` in the address starts either one directly.

| | Keyboard | Touch |
|---|---|---|
| Walk | ← → or A D (O P) | ◀ ▶ |
| Jump (somersault while moving) / climb up | ↑ or W (Q) | ▲ |
| Climb down | ↓ or S | ▼ |
| Use / talk / next | Space or Enter | USE |
| Pick up / drop | E (G) | PICK / DROP |
| Choose hand | Tab, 1, 2 | tap a hand |
| Sound on/off | M | SOUND |
| Choose an answer (quiz) | ← → or ↑ ↓, then Space | tap it |
| Level 1 / 2 | N | LEVEL |
| Language: English / Russian | L | EN / RU |
| Restart | R twice | — |

The game is in English and Russian. The first visit follows the browser's
language and the choice is remembered; `?lang=ru` or `?lang=en` in the address
picks one, e.g. for an embed.

## How it's built

Plain JavaScript and a 256×192 canvas, no libraries and no image files: every
sprite, tile, the font and the music are drawn or synthesised in code.

- **One map per room drives both drawing and collision**, so the scenery you
  see is exactly what Zizzy stands on. Rooms join on a grid; walking or
  climbing between them keeps Zizzy's exact position, and a test checks that
  every doorway lines up with its neighbour at the same floor height.
- **Fixed 50 Hz simulation** with an accumulator, so the game runs at the same
  speed on 60, 120 or 144 Hz displays. Frames are drawn only after the state
  changes; static room scenery is drawn once and cached, text glyphs are
  pre-rendered.
- Tile physics with one-way planks, ladders (including one that continues
  through a trapdoor into the room above), a moving raft that carries Zizzy,
  an 8 px auto-step and mid-air ledge forgiveness.
- The somersault uses pre-rotated sprite frames with nearest-neighbour
  sampling, so it stays pixel-crisp.
- Sound effects and the victory tune come from a small Web Audio "beeper".

## Run it locally

```sh
python3 -m http.server 8080   # then open http://localhost:8080/
```

## Development

```sh
npm ci
npx playwright install chromium
npm test            # world consistency tests + a bot that plays the whole game
npm run package     # dist/zizzy/ and a versioned .tar.gz
```

The end-to-end test drives the game through the same inputs a player uses
(keys held tick by tick): it rides the raft, catches the floating spark, opens
the trapdoor, times the jump past the Tesla coil and wins; then it plays level 2,
trying the insulators before the spoon, running the dynamo and answering one
quiz question wrong first; then it checks deaths, respawning, game over, the
level switch and the 50 Hz timing.

Each level is a world (`js/world.js`, `js/world2.js`: the tile maps, items and
sparks) plus its logic (`js/level1.js`, `js/level2.js`: puzzles, hazards and
scenery as hooks); `js/game.js` is the engine they share.

Pages load their scripts with `?v=dev`; packaging stamps the release version
into every asset URL so browsers and CDNs never mix two versions.

### Releasing

1. Add the changes under a new version in `CHANGELOG.md`.
2. Bump `version` in `package.json`.
3. `git tag vX.Y.Z && git push origin main vX.Y.Z`

The Release workflow tests the source and the packaged build, publishes a
GitHub release with `zizzy-X.Y.Z.tar.gz` and its SHA-256 (byte-for-byte
reproducible), and deploys GitHub Pages. [aerocat.tech](https://aerocat.tech)
embeds released versions only, pinned by version and checksum.

## Credits

Inspired by the flip-screen puzzle adventures of the 8-bit era. All code,
characters, artwork, text and music are original.

## License

[MIT](LICENSE) © Andrey Dumchin
