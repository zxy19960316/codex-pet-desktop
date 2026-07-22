# M3.4 implementation report

## Scope delivered

M3.4 adds signature-checked PNG/WebP assets, a real local-only Codex PokéPets provider/adapter,
12-state original overlays, Settings schema v3 with 50–200% sizing, frame-aware display bounds,
Ctrl+wheel adjustment, and one dynamic native-menu model shared by desktop and tray. Pixel Sprout
remains the only bundled pet.

The local discovery root existed during implementation but contained zero pet directories. No
real Pokémon character file was opened, copied, committed, packaged, or claimed as verified.

## Automated verified

- 49 Vitest files and 164 tests cover WebP signatures/dimensions, manifest geometry, adapter and
  provider safety/cleanup/redaction, all overlays, v2→v3 migration, scale clamping, wheel IPC,
  bounds/anchors, and dynamic menu conditions.
- `npm run format:check`, `npm run lint`, `npm test`, and `npm run build` passed before each focused
  feature/test commit.
- The adapter rejects missing metadata, missing/fake WebP, traversal, incompatible dimensions,
  duplicate IDs, and cleans its own temporary directory after failure.
- Discovery records contain no source path; generated manifests say the asset is third-party,
  outside project MIT, locally imported, and not redistributable.
- A controlled `npm run dev` smoke verified a visible frameless 300×360 window, tray creation,
  graceful quit, and a startup snapshot containing the active Registry pet.

## Packaged verified

`npm run verify:m3-2` passed against the unpacked Windows x64 application. Its runtime-only
Electron canvas fixture draws an original geometric robot into a 1536×1872 WebP; no image fixture
is tracked. The first packaged process imported/switched a canonical PNG package, adapted the
synthetic Codex package, selected it, and verified 200% then 100% Settings preview. The second
process reused isolated user data, restored that selected package, rescanned, and loaded all
previews.

Package inspection found only `pets/example-original-pet` beneath application resources. The
synthetic/imported WebP existed only in ignored verification and isolated user-data locations.

`npm run verify:m3-3` also passed after installing the unsigned NSIS artifact to an isolated
directory. The installed executable completed the same PNG plus synthetic WebP Settings flow,
produced a screenshot, exited, and was removed by the real uninstaller. The verifier confirmed the
installation directory and its own temporary source/user-data directories were gone. Authenticode
status was `NotSigned`, as expected without a release certificate.

## Human verified

The final development smoke screenshot was visually inspected and showed the complete Pixel Sprout
at 100% with its independent idle overlay and shadow, with no sprite crop. No claim is made for a
person manually importing a real Codex PokéPet in this run. No real local package was available.
Native right-click, tray interaction, Ctrl+wheel input, and physical appearance across real
monitors remain distinct from automated template/layout/protocol evidence.

## Not verified

- Real local Codex PokéPet character import: not run; local discovery contained zero packages.
- Real third-party art appearance/license: not inspected.
- Human visual comparison at 50%, 100%, and 200% across multiple physical DPI displays: not run.
- Signed installer and GitHub Release: outside scope; no Release was created.

## Safety and behavior boundaries

- No downloader, network adapter, bulk import, uploader, renderer filesystem API, or generic
  settings-write backdoor was added.
- Source directories are never modified; imports are copied atomically only into managed user
  data and duplicates never overwrite an existing ID.
- `electron-builder.json` still packages reviewed repository pets only and keeps
  `deleteAppDataOnUninstall=false`.
- Codex App Server, Hook, approval, reply, and quota protocol behavior was not changed.
- The MIT `LICENSE` and original Pixel Sprout assets were not modified.

## Commit sequence

1. `feat: add safe WebP pet assets`
2. `feat: add Codex PokéPets local adapter`
3. `feat: add generic pet state overlays`
4. `feat: add persistent pet size controls`
5. `feat: add dynamic pet context menu`
6. `test: verify adapted pet packages and layout`
7. `docs: document M3.4 local pet integration`
