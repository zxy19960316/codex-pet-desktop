# Codex Pet Desktop

Codex Pet Desktop is an independent, open-source 2D pixel companion for local Codex activity. The
default view follows the product sketch: two compact quota rows, one expand button, and an
expressive creature. Approval, reply, quota details, and developer tools appear only when opened or
needed.

## Current product baseline

- Registry-backed Pet Packages with PNG sprite sheets, validated state fallbacks, active-pet
  switching, and user folder import.
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
```

## Privacy and local data

The app has no cloud account, telemetry uploader, browser-cookie access, or login emulation. The
hook receiver discards prompt text, tool inputs, tool outputs, transcript paths, and model details.
Its bounded local event file contains only lifecycle identifiers and timestamps. Window settings,
imported pet packages, active-pet selection, and event data stay in Electron's local user-data
directory.

## Pet assets

This repository does not bundle Pokémon artwork or other extracted game resources. The included
Pixel Sprout PNG package is original procedural pixel art. Open **Settings Center -> Pets** to
switch packages, import a local package folder, open the managed user-data directory, or rescan.
See the [Pet Package guide](docs/guides/PET_PACKAGE_SYSTEM.md) and
[`ASSET_POLICY.md`](ASSET_POLICY.md).

## Independence and license

Source code is MIT licensed. Product mechanisms were researched from public projects including
Clawd on Desk, but no AGPL source, artwork, tests, or assets were copied. This project is not
affiliated with or endorsed by OpenAI, Nintendo, Game Freak, Creatures Inc., The Pokémon Company,
Clawd on Desk, AgentPet, or Codex PokéPets.
