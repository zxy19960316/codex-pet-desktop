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

Adapters for external sprite formats may convert independently lawful, user-provided local assets
to the canonical Pet Package schema. They must not download, bundle, or redistribute third-party
character packs. See [`docs/guides/PET_PACKAGE_SYSTEM.md`](docs/guides/PET_PACKAGE_SYSTEM.md).
