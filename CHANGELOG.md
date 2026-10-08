# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.2.0] - 2026-10-08

### Added
- **Level 2, the Power Station**: five new rooms with first lessons in
  electricity for players of about 7 to 10, in English and Russian. Insulators
  and conductors (the stick and the duck fail, the metal spoon closes a
  motor's circuit), a circuit as a closed loop (a copper wire lights the dark
  hall), a dynamo that turns running into a charged battery, a quiz by Volta
  the teacher robot, and electrical safety on the roof (switch off before
  fixing, rubber gloves, never step in water near a live cable). Wrong tries
  explain why instead of costing a life.
- Questions with answers to choose: arrows (or a tap) pick an answer, USE
  confirms. Nothing is picked at first, so pressing USE to hurry the text
  never answers by accident.
- The LEVEL button and the N key switch between the levels (asking once while
  you play); `?level=2` in the address opens level 2; the last level played is
  remembered. Finishing level 1 leads on to level 2.
- Six new items (stick, rubber duck, spoon, copper wire, battery, rubber
  gloves), Volta, a darkened hall lit only by Zizzy's own glow, a moving
  dynamo belt.

### Changed
- The engine is level-agnostic: each level is a world (map) plus a logic file
  of hooks; level 1 plays exactly as before.

## [1.1.0] - 2026-10-07

### Added
- Russian translation with an EN / RU switch in the panel under the screen
  (key L). Everything changes at once, including a dialog already on screen,
  the room names, the items and the painted signs. The first visit follows the
  browser's language; the choice is remembered; `?lang=ru` / `?lang=en` in the
  address picks one (for embeds).
- Cyrillic capitals in the game's 8-px font, in the same chunky style, plus
  « » quotes.

### Fixed
- The "DEEP" sign's first letter overlapped the sign's border.

## [1.0.0] - 2026-10-07

First release.

### Added
- Five-room adventure: the Dusty Cellar, Boiler Room, Flooded Tunnel,
  Workshop and Radio Attic, with five sparks to find and a puzzle chain
  (steam valve, oiled trapdoor, raft crossing, Tesla coil, robot Sprocket,
  magnet and grate, the grand wireless).
- Original pixel art, font, sound effects and victory tune, all generated in
  code.
- Tile engine where one map per room drives drawing and collision; rooms join
  on a grid and keep the player's exact position across edges, ceilings and
  floors.
- Fixed 50 Hz simulation, cached scenery and glyphs, crisp pre-rotated
  somersault frames.
- Two-hand inventory, lives with respawn on the last safe spot, game over and
  restart (R twice), sound toggle remembered between visits.
- Keyboard and touch controls (pointer events; keys released when the page
  loses focus).
- Tests: world consistency checks and a bot that plays the whole game in
  headless Chromium; CI and tag-driven releases with reproducible archives.

[Unreleased]: https://github.com/kothf/zizzy/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/kothf/zizzy/releases/tag/v1.0.0
