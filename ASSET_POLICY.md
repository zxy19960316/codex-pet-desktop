# Asset policy

The source code in this repository is licensed under MIT. Third-party pet assets do not
automatically receive that license, and users are responsible for confirming that they have the
right to use any locally imported asset.

This project does not bundle Pokémon artwork, official sounds, logos, fonts, or game resources.
Pokémon and its character assets are not distributed with this project. The only bundled package,
Pixel Sprout, is original procedural artwork covered by the repository's MIT license.

The M3.1 importer validates a folder selected by the user and copies it into Electron's local
user-data `pets/` directory. That directory is outside the repository and is never committed or
downloaded by the application. Import does not imply that the project authors reviewed or
relicensed the package. Users remain responsible for the copyright, trademark, attribution, and
license terms of every imported asset.

`CodexPokePetsAdapter` may convert one already-installed or explicitly selected local Codex
PokéPets package into the canonical format. It reads only local files, copies only into Electron
`userData/pets`, preserves source metadata, records `redistributionAllowed=false`, and labels the
result as outside the project's MIT license. It never modifies the source directory, imports all
discovered packages automatically, downloads assets, uploads them, or copies them into an
installer.

The project has no official relationship with Nintendo, Game Freak, Creatures Inc., The Pokémon
Company, or other Pokémon rights holders, and it uses none of their logos. See the
[`local import guide`](docs/guides/CODEX_POKEPETS_IMPORT.md) and
[`Pet Package guide`](docs/guides/PET_PACKAGE_SYSTEM.md).
