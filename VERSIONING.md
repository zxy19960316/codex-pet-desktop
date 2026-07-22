# Versioning and release policy

Codex Pet Desktop uses [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

- **MAJOR** changes may alter pet package, settings, IPC, or supported-platform compatibility.
- **MINOR** changes add backward-compatible features, states, integrations, or settings.
- **PATCH** changes fix behavior without intentionally changing public compatibility.

Pre-release versions append a SemVer identifier such as `1.1.0-beta.1`. Development milestones
may use internal names in plans and reports, but public releases use only SemVer.

## Source control

- `main` is the public stable branch and must stay buildable.
- Work happens on focused branches such as `feat/...`, `fix/...`, or `docs/...`.
- Commits use Conventional Commit titles (`feat:`, `fix:`, `docs:`, `test:`, `build:`, `ci:`).
- Published history is never force-pushed or rewritten.
- Pull requests must pass formatting, lint, tests, and build checks before merge.
- User assets, credentials, Codex session data, logs, imported pet packages, and generated release
  output are never committed.

## Release checklist

1. Update `package.json` and `package-lock.json` to the same version.
2. Add a dated `CHANGELOG.md` section and update version-specific download documentation.
3. Run `npm run format:check`, `npm run lint`, `npm test`, and `npm run build`.
4. Build the installer with `npm run package:installer` and verify its generated SHA-256 file.
5. Audit `git diff`, `git status`, tracked binaries, and ignored local asset directories.
6. Merge or fast-forward the tested commit to `main` without rewriting history.
7. Create an annotated `vMAJOR.MINOR.PATCH` tag at that exact commit and push it.
8. Create a GitHub Release from the tag and attach the installer plus `.sha256` checksum.
9. Confirm GitHub Actions and the public download links correspond to the tagged commit.

The Git tag, GitHub Release, changelog, package metadata, installer filename, and installer metadata
must identify the same version. Hotfixes branch from the current `main` and produce a new patch
version; a published tag or installer is never silently replaced.
