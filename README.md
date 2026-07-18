# Codex Pet Desktop

Codex Pet Desktop is an independent, open-source 2D pixel companion for local Codex activity. The
default view follows the product sketch: two compact quota rows, one expand button, and an
expressive creature. Approval, reply, quota details, and developer tools appear only when opened or
needed.

## Current product baseline

- Registry-backed Pet Packages with signature-checked PNG/WebP sprite sheets, validated state
  fallbacks, active-pet switching, and local-only user folder import.
- Optional local discovery and explicit one-at-a-time import of already-installed Codex PokéPets;
  no character asset is downloaded, uploaded, bundled, or relicensed.
- Persistent 50–200% sizing, Ctrl+wheel adjustment, display-aware bounds, original CSS state
  overlays, and shared dynamic desktop/tray menus.
- Packaged Windows resource discovery plus a two-process Settings E2E for import, switching,
  restart persistence, rescan, and preview rendering.
- An original-branded Windows x64 NSIS installer with SHA-256 output and isolated
  install/launch/uninstall verification.
- Compact `300 x 360` transparent window; details and human requests expand it to `420 x 700` while
  preserving the lower-right anchor.
- Two-row `5h` / `weekly` quota strip with unavailable placeholders instead of invented data.
- Official Codex lifecycle hooks as the primary activity sensor. Only session ID, turn ID, event
  name, and timestamp are retained; prompt text and transcripts are not read.
- Optional App Server integration for explicit bidirectional developer actions. It is no longer
  auto-started or presented as proof that the user's existing Codex session is connected.
- Typed preload/IPC, sandboxed renderer, redacted diagnostics, local settings, approval and
  structured-input routing, and a guided development-only M2.6 verifier.

The audit that reset the project direction is in
[`docs/reports/2026-07-16_PRODUCT_RESET_AUDIT.md`](docs/reports/2026-07-16_PRODUCT_RESET_AUDIT.md).

## Run locally

Requirements: Windows 10/11, Node.js 24 LTS, npm 11, and a local Codex installation.

```bash
npm ci
npm run dev
```

From the tray, choose **Connect Codex activity…** to install the local lifecycle-hook entries. Codex
requires a separate trust review: open `/hooks`, inspect the commands, and choose **Trust**. The
installer preserves unrelated hook entries and never bypasses Codex's trust gate.

Developer verification remains explicit:

```bash
npm run dev:e2e
npm run format:check
npm run lint
npm test
npm run build
npm run package:dir
npm run verify:m3-2
npm run package:installer
npm run verify:m3-3
```

`package:dir` creates an ignored unpacked application under `release/`. `verify:m3-2` packages the
app, launches that EXE twice with isolated temporary user-data, imports a canonical PNG fixture and
a runtime-generated original geometric WebP Codex-format fixture, then verifies switching, scale
preview, restart persistence, and ignored reports/screenshots under `tmp/m3-2-e2e/results/`.

`package:installer` creates an ignored unsigned installer and checksum under `release/m3-3/`.
`verify:m3-3` installs it to a unique temporary directory, validates the installed Settings/Pet
path, runs the real uninstaller, and preserves only the ignored report and screenshot under
`tmp/m3-3-e2e/`. See the
[`M3.3 Windows distribution report`](docs/reports/M3_3_IMPLEMENTATION.md) for signing preparation
and evidence limits.

## Privacy and local data

The app has no cloud account, telemetry uploader, browser-cookie access, or login emulation. The
hook receiver discards prompt text, tool inputs, tool outputs, transcript paths, and model details.
Its bounded local event file contains only lifecycle identifiers and timestamps. Window settings,
imported pet packages, active-pet selection, and event data stay in Electron's local user-data
directory.

## Pet assets

This repository does not bundle Pokémon artwork or other extracted game resources. The included
Pixel Sprout PNG package is original procedural pixel art. Open **Settings Center -> Pets** to
switch packages, scan local `~/.codex/pets`, explicitly import one compatible source, open the
managed user-data directory, or rescan. See the
[Codex PokéPets import guide](docs/guides/CODEX_POKEPETS_IMPORT.md),
[Pet Package guide](docs/guides/PET_PACKAGE_SYSTEM.md), and
[`ASSET_POLICY.md`](ASSET_POLICY.md). Packaged verification details are recorded in
[`docs/reports/M3_2_IMPLEMENTATION.md`](docs/reports/M3_2_IMPLEMENTATION.md).

## Independence and license

Source code is MIT licensed. Product mechanisms were researched from public projects including
Clawd on Desk, but no AGPL source, artwork, tests, or assets were copied. This project is not
affiliated with or endorsed by OpenAI, Nintendo, Game Freak, Creatures Inc., The Pokémon Company,
Clawd on Desk, AgentPet, or Codex PokéPets.
