# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
