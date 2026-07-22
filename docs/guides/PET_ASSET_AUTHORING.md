# Pet asset authoring and integration

This guide is the visitor-facing path for creating a redistributable pet package or installing a
personal local package. For the complete validator contract, see
[Pet Package System](PET_PACKAGE_SYSTEM.md).

## 1. Confirm your rights first

Use artwork that you created or have explicit permission to use and redistribute. Importing a file
locally does not grant a new license. Do not commit or publish Pokémon artwork, extracted game
resources, logos, fonts, sounds, or another artist's work without a compatible license.

Personal local packages can remain outside Git. Public packages should include a `LICENSE` file,
author attribution, and a manifest license field. Read the repository [asset policy](../../ASSET_POLICY.md).

## 2. Create the package directory

```text
my-original-pet/
|-- manifest.json
|-- LICENSE
|-- preview.png
`-- sprites/
    |-- idle.png
    |-- thinking.png
    |-- typing.webp
    |-- working.webp
    |-- approval.png
    |-- waiting-input.png
    |-- success.png
    |-- error.png
    |-- quota-low.png
    |-- quota-empty.png
    |-- offline.png
    `-- sleep.png
```

Accepted previews and sprite sheets are real PNG or WebP files. Renaming another format is not
enough: the importer checks file signatures and dimensions. SVG, HTML, archives, scripts, remote
URLs, symbolic links, and automatic downloads are rejected.

Each animation is a sprite sheet. The simplest layout is one horizontal row of equally sized
frames. For example, eight `64 x 64` frames produce a `512 x 64` image. Multi-row atlases may set
`frameRow` and `frames` explicitly.

## 3. Map runtime states

| State           | Suggested visual                          |
| --------------- | ----------------------------------------- |
| `idle`          | Calm breathing or blinking; required      |
| `thinking`      | Looking up, pondering, or a slow pulse    |
| `typing`        | Fast hand/paw movement or focused motion  |
| `working`       | Tool use or sustained active motion       |
| `approval`      | Alert pose waiting for permission         |
| `waiting_input` | Listening or expectant pose               |
| `success`       | Celebration or positive reaction          |
| `error`         | Startled, frustrated, or damaged reaction |
| `quota_low`     | Tired or low-energy motion                |
| `quota_empty`   | Exhausted or resting pose                 |
| `offline`       | Disconnected, dimmed, or sleeping pose    |
| `sleep`         | Looping sleep animation                   |

Only `idle` is mandatory. Missing states follow validated fallbacks such as
`typing → working → thinking → idle` and `quota_empty → sleep → idle`. A complete twelve-state
package avoids visible fallback reuse.

## 4. Write `manifest.json`

```json
{
  "id": "my-original-pet",
  "name": "My Original Pet",
  "version": "1.0.0",
  "author": "Your name",
  "license": "CC0-1.0",
  "preview": "preview.png",
  "assets": {
    "sprites": [
      "sprites/idle.png",
      "sprites/thinking.png",
      "sprites/working.webp",
      "sprites/success.png"
    ]
  },
  "animations": {
    "idle": {
      "name": "idle",
      "sprite": "sprites/idle.png",
      "frameWidth": 64,
      "frameHeight": 64,
      "fps": 4,
      "loop": true
    },
    "thinking": {
      "name": "thinking",
      "sprite": "sprites/thinking.png",
      "frameWidth": 64,
      "frameHeight": 64,
      "fps": 6,
      "loop": true
    },
    "working": {
      "name": "working",
      "sprite": "sprites/working.webp",
      "frameWidth": 64,
      "frameHeight": 64,
      "fps": 8,
      "loop": true
    },
    "success": {
      "name": "success",
      "sprite": "sprites/success.png",
      "frameWidth": 64,
      "frameHeight": 64,
      "fps": 8,
      "loop": false
    }
  },
  "fallbacks": {
    "typing": "working",
    "approval": "thinking"
  },
  "capabilities": {
    "spriteSheet": true,
    "sounds": false
  },
  "metadata": {
    "description": "An original local sprite package",
    "pixelArt": true
  }
}
```

`id` uses lowercase letters, numbers, and single hyphens. Every sprite referenced by an animation
must also appear in `assets.sprites`. Package-relative paths use `/`, never drive letters,
backslashes, `.` or `..` segments.

Limits: manifest 1 MB, each asset 20 MB, imported tree 2,000 entries and 100 MB. Frame geometry must
divide the real image dimensions exactly, and the declared frame row/count must fit.

## 5. Test and import

1. Start the app and open **Settings Center → Pets**.
2. Choose **Import package** and select the package directory, not an individual image.
3. Fix any specific validation error shown by the importer.
4. Select the new pet, exercise Codex states, and test several sizes (50%, 100%, 150%, 200%).
5. Use **Open managed pet directory** to inspect the installed copy or **Rescan** after local edits.

The importer validates before copying, copies through a temporary directory, validates again, and
renames atomically. A failed import does not replace an existing valid package.

## 6. Compatible Codex PokéPets

If a compatible pet is already installed locally, choose **Scan installed Codex PokéPets** or
**Import Codex PokéPet**. The adapter currently accepts the local `pet.json` plus
`spritesheet.webp` format with a `1536 x 1872`, `8 x 9` atlas of `192 x 208` cells. It imports only
after an explicit click and records `redistributionAllowed=false`.

See [Importing local Codex PokéPets](CODEX_POKEPETS_IMPORT.md). This route is for local use; do not
copy adapted third-party assets into a fork, pull request, installer, or GitHub Release.

## 7. Local twelve-state production tools

The repository includes developer utilities under `scripts/local-pokepets/` for a personal,
Git-ignored workflow. They validate source geometry, build deterministic state strips, validate a
derived twelve-state directory, create QA previews, and atomically install into the managed pet
directory. All source and generated images must stay under `tmp/local-pokepets/` or another ignored
local path.

The utilities intentionally do not make third-party assets redistributable. Before running any
fetch or conversion step, review its allow-list and upstream terms. Never stage the generated
source atlas, poses, previews, manifests, or derived packages. Confirm isolation with:

```powershell
git status --short
git check-ignore -v tmp/local-pokepets/
git ls-files "*.png" "*.webp"
```

For a public contribution, use a fully original package instead. The bundled procedural example
can be regenerated with `node scripts/generate-original-pet-assets.mjs` and is the safest reference
implementation.
