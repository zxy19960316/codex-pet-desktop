# Contributing

Thanks for helping improve Codex Pet Desktop. Keep every change focused, reviewable, and safe for a
public Windows desktop application.

## Before you start

- Search existing issues and describe the user-visible problem or proposal.
- Read `AGENTS.md`, `ASSET_POLICY.md`, and the relevant guide under `docs/`.
- Create a focused branch such as `feat/pet-preview`, `fix/window-shape`, or `docs/asset-guide`.
- Do not build integrations that bypass Codex trust prompts, imitate login, read browser cookies,
  or upload local session data.

## Development

Requirements: Windows 10/11, Node.js 24 LTS, npm 11, and Git.

```powershell
npm ci
npm run dev
```

Keep Electron filesystem and OS access in `src/main`, keep renderers sandboxed, put Codex protocol
logic under `src/core/codex`, and pass normalized domain data through typed preload/IPC contracts.
Keep pet state selection separate from sprite rendering.

Write or update focused tests for behavioral changes. Before opening a pull request, run:

```powershell
npm run format:check
npm run lint
npm test
npm run build
```

Packaging changes should also run `npm run package:dir`; installer changes should run
`npm run package:installer` and, where practical, `npm run verify:m3-3`.

## Commits and pull requests

- Use Conventional Commit titles such as `feat: add pet preview` or `fix: preserve window shape`.
- Do not mix unrelated cleanup into a feature or fix.
- Explain what changed, why, user/developer impact, and validation results in the pull request.
- Never force-push shared history or commit generated `dist/`, `release/`, coverage, logs, or temp
  output.
- Follow [VERSIONING.md](VERSIONING.md) for public release changes.

## Assets and private data

Pull requests must not contain credentials, tokens, cookies, Codex session JSONL, prompts,
transcripts, private logs, local settings, Electron user data, or imported pet packages.

Do not contribute Pokémon artwork, extracted game resources, official logos/fonts/sounds, or other
copyrighted character assets. A public pet contribution must be original or have a redistribution
license compatible with the repository; include its source, author, license, and attribution. The
maintainers may reject an asset when provenance is unclear. See [ASSET_POLICY.md](ASSET_POLICY.md)
and the [asset-authoring guide](docs/guides/PET_ASSET_AUTHORING.md).

Before committing, inspect both `git diff` and `git status --short`. If your work used local assets,
also confirm that ignored folders and generated images are not tracked.
