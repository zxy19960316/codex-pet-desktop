# Codex Pet Desktop

Codex Pet Desktop is an independent, open-source Electron desktop companion for visualizing local
Codex activity. The current development build provides a secure desktop shell, a normalized
pet-state model, a Codex App Server connection, approval cards, structured reply cards, and a
compact usage HUD.

> Screenshot placeholder — a project screenshot will be added after the M1 visual baseline is
> finalized.

## Current features

- Frameless, transparent, always-on-top pet window with drag, position persistence, click-through,
  multi-display clamping, tray controls, and a CSS-only original placeholder pet.
- Per-thread state tracking with priority aggregation and transient success/error restoration.
- Line-buffered JSON-RPC client with timeouts, notifications, server requests, safe diagnostics,
  graceful shutdown, and bounded reconnects.
- Codex approval routing for command execution, file changes, and permission requests, including a
  queued desktop card that only shows supported decisions.
- Dynamic rate-limit windows, reset countdowns, daily tokens, and thread-aware current-thread
  tokens when the installed App Server exposes those values.
- Structured Codex user-input reply cards with typed, allowlisted IPC. Mock cards cover a choice,
  multiple choices, and free text and are visibly labeled.
- Clearly labeled Mock usage and approval data for deterministic UI development.
- Debug controls that can trigger every supported pet state.
- Debug-only Developer controls for ephemeral threads, real turns, steer, interrupt, and safe real
  approval/user-input test entry points.

## Status and roadmap

- **M0 — Project and desktop shell:** complete for the current development baseline.
- **M1 — App Server technical loop:** complete for the current development baseline.
- **M1.5 — Runtime closure, thread tokens, and approval evidence:** implemented; human approval
  confirmation remains a guided manual check.
- **M2 — User input and replies:** implemented through request/reply routing and UI; human real
  App Server confirmation remains a guided manual check.
- **M2.5 — Thread and turn control:** implemented with explicit thread/turn ownership, restricted
  developer-test cwd, and real-request entry points; human desktop E2E remains guided/manual.
- **M3 — Complete quota and token HUD:** planned.
- **M4 — Pet packs and animation system:** planned.
- **M5 — Multiple sessions and productization:** planned.
- **M6 — Installers, updates, and releases:** planned.

The milestone details and acceptance boundaries are in
[`docs/plans/PROJECT_PLAN.md`](docs/plans/PROJECT_PLAN.md).

## Run locally

Requirements:

- Windows 10 or 11 is the primary target. Low-cost macOS and Linux compatibility is retained.
- Node.js 24 LTS and npm 11.
- A local `codex` CLI with `codex app-server --listen stdio://` support for real integration.

```bash
npm ci
npm run dev
```

Quality and build commands:

```bash
npm run format
npm run format:check
npm run lint
npm test
npm run build
```

On Windows, the app safely invokes an installed npm `codex.cmd` through `cmd.exe` because Node.js
cannot directly spawn command shims. Set `CODEX_PET_CODEX_PATH` to a trusted Codex executable or
command shim when an explicit local path is required.

## Privacy and local data

The app has no cloud account of its own, uploads no telemetry or usage data, reads no browser
cookies, and does not simulate login. Window settings are stored in Electron's local user-data
directory. Logs redact credential-like values and do not include full user messages, command
output, file contents, access tokens, or session files.

When real account usage endpoints are unavailable, the HUD says that data is unavailable. Mock
values are opt-in and visibly labeled; they are never represented as real Codex account data.

Real protocol, mock, and manual verification status are deliberately separate. See
[`docs/reports/M1_5_M2_IMPLEMENTATION.md`](docs/reports/M1_5_M2_IMPLEMENTATION.md),
[`docs/reports/M2_5_IMPLEMENTATION.md`](docs/reports/M2_5_IMPLEMENTATION.md), and the manual
guides under `docs/guides/` before treating an approval or user-input flow as human
end-to-end verified.

## Pet assets

This project does not bundle Pokémon artwork.

Only the CSS-drawn original example under `themes/example-original-pet/` is included. User pet
packs belong in the Git-ignored `user-pets/` directory; a future version may scan `~/.codex/pets/`
without downloading or copying content. Users are responsible for confirming that they have the
right to use imported assets. See [`ASSET_POLICY.md`](ASSET_POLICY.md).

## License

Source code is available under the [MIT License](LICENSE). Third-party assets retain their own
terms and are not automatically relicensed under MIT.

## Inspiration

Product experience and interaction ideas were inspired by Clawd on Desk, AgentPet, and Codex
PokéPets. No source code, tests, artwork, sounds, animations, icons, logos, fonts, or UI files from
those projects are included.

This is an independent open-source project and is not affiliated with or endorsed by OpenAI,
Nintendo, Game Freak, Creatures Inc., The Pokémon Company, Clawd on Desk, AgentPet, or Codex
PokéPets.
