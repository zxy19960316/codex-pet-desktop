# Changelog

All notable changes are recorded here. The project follows [Semantic Versioning](VERSIONING.md).

## [1.1.0] - 2026-08-10

### Added

- Privacy-bounded local session lifecycle parsing for recent Codex JSONL files, with normalized
  thinking, working, completed, failed, and interrupted state updates.
- A left-click current-session quick view and detailed Chinese session Hub with recent state,
  project label, elapsed/active time, quota, Token usage, and Settings Center access.
- Complete Simplified Chinese Settings Center copy and localized connection, diagnostics, pet
  package, and usage labels.
- Expanded local-only pet animation tooling for keyframe grids, existing strips, smoother loops,
  animation quality reports, and animated QA boards.

### Changed

- Terminal pet states now return to idle after a short presentation window, and inactive
  session-file-only work ages out without exposing raw session content.
- The public installer continues to bundle only the original Pixel Sprout package and project-owned
  branding; local Pokémon and other third-party character material remains excluded.
- Source code and bundled original assets in v1.1.0 now use the PolyForm Noncommercial License
  1.0.0. General commercial use is not licensed. The prior v1.0.0 release retains its published MIT
  terms.

### Privacy and distribution

- Session parsing ignores prompts, responses, command bodies, tool payloads, cwd values, and raw
  JSONL content; the renderer consumes normalized summaries only.
- Editing third-party art locally or adding a noncommercial notice does not grant redistribution
  rights, so local character packages are never added to Git, installers, or GitHub Releases.

## [1.0.0] - 2026-07-22

### Added

- Installable Windows tray application with an original cloud-cat terminal icon, Start menu and
  desktop shortcuts, optional launch at sign-in, and an NSIS installer checksum.
- Automatic monitoring of the newest local Codex session for model, reasoning effort, current
  token usage, context-window size, and available rate-limit windows.
- Game-style status card attached above the pet with dynamic `5H` and `WEEKLY` bars.
- Twelve normalized pet states with manifest fallbacks and local Codex lifecycle-hook integration.
- Pixel-shaped Windows hit testing so transparent sprite space does not block mouse input.
- Persistent 50–200% pet scaling, Ctrl+mouse-wheel resizing, multi-display bounds, always-on-top,
  click-through, and Settings Center controls.
- Validated local PNG/WebP pet packages, original Pixel Sprout starter assets, explicit local
  Codex PokéPets adaptation, active-pet persistence, and developer-only local 12-state tooling.
- Typed preload/IPC boundaries, sandboxed renderers, bounded/redacted diagnostics, and automated
  unit, packaging, and installer lifecycle verification.

### Privacy and distribution

- The app contains no cloud telemetry uploader, login emulation, browser-cookie access, bundled
  Pokémon artwork, or automatically downloaded character assets.
- The public Windows x64 installer is unsigned. Users should verify the published SHA-256 checksum.

[1.0.0]: https://github.com/zxy19960316/codex-pet-desktop/releases/tag/v1.0.0
[1.1.0]: https://github.com/zxy19960316/codex-pet-desktop/releases/tag/v1.1.0
