# M3.2 Packaged Pet Verification Report

Date: 2026-07-18
Branch: `feat/m3-0-settings-center`

## Outcome

M3.2 closes the first productization gap after the Pet Package system. The Windows unpacked
application now ships reviewed built-in packages under `resources/pets/`, resolves that directory
through `process.resourcesPath` when packaged, and has a repeatable packaged-application Settings
E2E covering import, switching, restart persistence, rescan, preview loading, and graceful exit.

Implementation commits:

- `8d88035 feat: package built-in pet resources`
- `b749a7a test: add packaged pet settings e2e`
- `docs: document M3.2 packaged pet verification`

## Package layout

`npm run package:dir` builds an unpacked Windows x64 application at:

```text
release/Codex Pet Desktop-win32-x64/
|-- Codex Pet Desktop.exe
`-- resources/
    |-- app.asar
    `-- pets/example-original-pet/manifest.json
```

Development still resolves `<appPath>/pets`. A packaged process resolves
`<process.resourcesPath>/pets`; the Registry and renderer receive the same validated package model
in both modes. The package script stages only runtime output and a minimal package manifest before
creating `app.asar`; user pet packages remain outside the application bundle.

## Automated packaged UI evidence

Run the complete verifier with:

```bash
npm run verify:m3-2
```

The runner creates a temporary import fixture from the repository's original Pixel Sprout package,
changes only its test ID/name/version, and launches the packaged EXE twice with one isolated local
user-data directory:

1. **Import phase:** starts from `pixel-sprout`, drives the real sandboxed Settings renderer through
   typed IPC, imports `e2e-sprout`, switches to the built-in package and back, confirms both preview
   images, captures the Pets section, and exits.
2. **Restart phase:** starts a new packaged process with the same user-data, requires
   `e2e-sprout` to already be active, rescans, confirms both packages and previews, captures the
   Pets section again, and exits.

The ignored evidence is written to `tmp/m3-2-e2e/results/`:

- `combined.json`
- `import/report.json` and `import/settings-import.png`
- `restart/report.json` and `restart/settings-restart.png`

The final local run passed with `packaged=true`, `currentPetId=e2e-sprout`, both expected package
IDs, loaded previews, successful import/switch-back/rescan flags, visible Settings windows, and
two clean process exits. The full repository gates passed with 39 test files and 123 tests.

## Evidence boundary

This is automated proof against the real packaged EXE, real Settings BrowserWindow, sandboxed
renderer, preload IPC, Registry, filesystem import, and a real process restart. The explicit
`--m3-2-e2e` gate substitutes a known folder for the operating-system directory picker so the run
is deterministic; it does not claim a human clicked the native picker. Installer creation, code
signing, auto-update, macOS/Linux packages, and human native-picker verification remain outside
M3.2.

## Asset and subsystem audit

- No third-party character, game, sound, logo, or font asset was added.
- The temporary E2E package is derived only from the repository's original procedural asset.
- Renderer filesystem isolation remains intact; test paths stay in the main process.
- Codex communication, App Server, Hook handling, quota logic, and `RuntimeController` behavior were
  not changed for M3.2.
