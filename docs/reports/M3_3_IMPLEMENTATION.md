# M3.3 Windows Distribution Report

Date: 2026-07-18
Branch: `feat/m3-0-settings-center`

## Outcome

M3.3 adds a Windows x64 NSIS installer without changing the desktop runtime. The installer carries
an original multi-size Pixel Sprout icon, explicit product/version metadata, `app.asar`, and the
reviewed built-in Pet Package tree. A repeatable verifier performs a real per-user silent install
to an isolated directory, launches the installed EXE through the packaged Settings import path,
invokes the generated uninstaller, and requires the installation directory to disappear.

Implementation commits:

- `fe2f804 feat: add original Windows app branding`
- `0a20762 feat: add Windows NSIS installer`
- `1f25e25 test: add Windows installer lifecycle e2e`
- `83be831 ci: add manual Windows installer verification`
- `docs: document M3.3 Windows distribution`

## Artifacts

`npm run package:installer` produced:

```text
release/m3-3/codex-pet-desktop-0.1.0-setup-x64.exe
release/m3-3/codex-pet-desktop-0.1.0-setup-x64.exe.sha256
```

Measured final local artifact:

| Field              | Value                                                              |
| ------------------ | ------------------------------------------------------------------ |
| Installer size     | `100,529,825` bytes                                                |
| SHA-256            | `7c55dafdf45d52c018182d268aba7c64137625a177a061d9ffe9ca8ecbce2524` |
| Authenticode       | `NotSigned`                                                        |
| Product/File name  | `Codex Pet Desktop` / `Codex Pet Desktop.exe`                      |
| Version            | `0.1.0`                                                            |
| Architecture       | Windows x64                                                        |
| Installation model | Assisted, per-user, changeable directory                           |

The unsigned status is intentional and explicit. M3.3 prepares signing but does not claim trusted
distribution without a real certificate.

## Original branding

`npm run assets:icons` reads only `pets/example-original-pet/preview.png`. It uses nearest-neighbor
scaling to create `16, 24, 32, 48, 64, 128, 256` pixel inputs and a Windows ICO. Generated files
remain ignored under `build/generated/`. No third-party or newly synthesized character artwork is
used.

## Signing preparation

Unsigned local verification remains:

```bash
npm run package:installer
```

A signed build requires both secrets and enables electron-builder's signing hard gate:

```powershell
$env:WIN_CSC_LINK = "<certificate path, URL, or base64>"
$env:WIN_CSC_KEY_PASSWORD = "<certificate password>"
npm run package:installer:signed
```

The preflight checks only whether both variables exist and never prints their values. Without
either variable it exits before building. Certificates and passwords are not stored in repository
configuration, reports, or workflow logs.

## Automated installer lifecycle evidence

`npm run verify:m3-3` completed the following sequence:

1. Build the unsigned NSIS installer and SHA-256 file.
2. Confirm checksum and Authenticode status.
3. Install silently for the current user to a unique directory below `%TEMP%`.
4. Confirm the installed EXE and `resources/pets/example-original-pet/manifest.json`.
5. Launch the installed EXE with the explicit M3.2 test gate.
6. Import `e2e-sprout`, switch to Pixel Sprout and back, and verify both previews.
7. Capture the installed Settings Pets section.
8. Invoke `Uninstall Codex Pet Desktop.exe /currentuser /S`.
9. Require uninstaller exit `0`, installation-directory removal, verifier-temp cleanup, and no
   remaining application process.

Evidence remains ignored at:

- `tmp/m3-3-e2e/report.json`
- `tmp/m3-3-e2e/settings-installed.png`

The final gate passed with 42 test files and 129 tests, plus format, lint, build, installer build,
real installed Settings UI, and uninstall verification.

## CI and evidence boundary

`.github/workflows/windows-installer.yml` runs only through manual `workflow_dispatch`. It has
`contents: read`, disables signing auto-discovery, runs `verify:m3-3`, and uploads the unsigned
installer, checksum, report, and screenshot for seven days. It cannot publish a GitHub Release.

Automated evidence proves the local unsigned installer lifecycle. It does not prove Authenticode
trust, SmartScreen reputation, elevated per-machine installation, auto-update, human installer UI
review, or release publication. Those require a certificate and explicit release authorization.
