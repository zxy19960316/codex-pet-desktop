# Importing local Codex PokéPets

Codex Pet Desktop can adapt a compatible pet that is already present on your computer. It never
downloads the Codex PokéPets repository or character assets, never imports every discovered pet
automatically, and never uploads local files.

## Prepare a local source

Install or prepare Codex PokéPets yourself according to that project's instructions. A compatible
pet directory contains:

```text
<local-pet-id>/
├── pet.json
└── spritesheet.webp
```

`pet.json` supplies `id`, `displayName`, optional `description`, and a safe relative
`spritesheetPath`. The current adapter requires the static 1536×1872 WebP atlas layout. The app
checks the real WebP signature, dimensions, safe path boundary, regular-file status, and size
limit; changing only a file extension is insufficient.

## Scan and import

1. Open **Settings Center → Pets**.
2. Choose **Scan installed Codex PokéPets**. The app scans the local `.codex/pets` directory and
   displays only name, local ID, compatibility, and whether it was already imported.
3. Review the third-party-rights notice.
4. Choose **Import** on one compatible source. Nothing is imported until this explicit click.

Alternatively, choose **Import Codex PokéPet** and select one compatible local pet directory with
the native folder picker. The source directory is read-only to the adapter and remains unchanged.

## Managed files and removal

Successful imports are copied below Electron's per-user application-data `pets` directory. Use
**Open managed pet directory** to reach the correct location without exposing an absolute home
path to the renderer. The generated directory is named `codex-pokepets-<local-id>` and contains a
canonical `manifest.json` plus the locally copied WebP.

To remove an imported pet, first switch to Pixel Sprout, close the app, delete only that imported
directory from the managed location, restart, and choose **Rescan**. Do not delete `.codex/pets`;
that is the independent source installation. Application uninstall is configured not to delete
the managed user-data directory.

## Rights and repository safety

- Pixel Sprout is the only character package distributed by this project and its installers.
- Locally imported third-party character assets are not covered by this project's MIT license.
- You are responsible for confirming that you have the right to use the selected files.
- Generated manifests retain a third-party source notice and `redistributionAllowed=false`.
- This project is not affiliated with or endorsed by Pokémon rights holders.
- Never add `.codex/pets`, Electron user data, imported WebP files, or generated local manifests to
  Git. The application does not make them distributable merely by adapting them.

No Nintendo, Pokémon, Game Freak, Creatures Inc., or other company logo is used by the import UI.
