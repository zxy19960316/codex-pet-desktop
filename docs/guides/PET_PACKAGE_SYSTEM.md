# Pet Package System

M3.1 separates three concepts that were previously coupled in the renderer:

- a **Pet** is a versioned character resource package;
- a **Theme** is the Settings or desktop UI style and contains no character identity;
- an **Animation** maps one normalized runtime state to a PNG sprite sheet.

The data path is:

```text
Pet Package -> Pet Registry -> Pet Runtime Snapshot -> Animation Resolver -> Renderer
```

The main process owns every filesystem operation. Sandboxed renderers receive only validated
metadata and concrete asset URLs through typed IPC.

## Package layout

Each package is one directory with one `manifest.json`. The built-in original example is
`pets/example-original-pet/`:

```text
example-original-pet/
|-- manifest.json
|-- LICENSE
|-- preview.png
`-- sprites/
    |-- idle.png
    |-- thinking.png
    |-- working.png
    |-- success.png
    `-- error.png
```

M3.1 supports horizontal PNG sprite sheets only. Every sheet contains equal-width frames in one
row. Frame count is inferred as `PNG width / frameWidth`; the PNG height must equal `frameHeight`.
The total CSS animation duration is `frames / fps` seconds. Skeletal animation, archives, remote
URLs, scripts, and automatic downloads are not supported.

## Complete manifest example

```json
{
  "id": "my-original-pet",
  "name": "My Original Pet",
  "version": "1.0.0",
  "author": "Your name",
  "license": "CC0-1.0",
  "preview": "preview.png",
  "assets": {
    "sprites": ["sprites/idle.png", "sprites/work.png"]
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
    "working": {
      "name": "working",
      "sprite": "sprites/work.png",
      "frameWidth": 64,
      "frameHeight": 64,
      "fps": 8,
      "loop": true
    }
  },
  "fallbacks": {
    "typing": "working"
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

### Fields

| Field                      | Requirement                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `id`                       | Unique lowercase identifier using letters, numbers, and single hyphen-separated segments.                  |
| `name`                     | Non-empty display name.                                                                                    |
| `version`                  | Non-empty package version string.                                                                          |
| `author`                   | Non-empty attribution shown in Settings.                                                                   |
| `license`                  | Non-empty license identifier or description shown in Settings.                                             |
| `preview`                  | Safe package-relative `.png` path.                                                                         |
| `assets.sprites`           | Non-empty, duplicate-free list of safe package-relative `.png` paths.                                      |
| `assets.sounds`            | Optional non-empty list of safe package-relative `.wav` paths. M3.1 validates but does not play sounds.    |
| `animations`               | State-to-sprite definitions. `idle` is mandatory. Every referenced sprite must appear in `assets.sprites`. |
| `capabilities.spriteSheet` | Must be `true` in M3.1.                                                                                    |
| `capabilities.sounds`      | Optional boolean declaration.                                                                              |
| `metadata`                 | Extension map containing only string, number, boolean, or null values.                                     |
| `fallbacks`                | Optional state-to-state overrides. Cycles are bounded and end at `idle`.                                   |

Absolute paths, Windows drive paths, backslashes, empty path segments, `.` and `..` segments are
rejected. Package directories and referenced resources must be regular files/directories rather
than symbolic links. A manifest is limited to 1 MB, one asset to 20 MB, and one imported tree to
2,000 entries and 100 MB.

## Runtime states and fallback

The normalized state vocabulary is:

```text
idle thinking typing working approval waiting_input success error
quota_low quota_empty offline sleep
```

An exact animation wins. If it is absent, a manifest fallback wins; otherwise the resolver uses
the built-in chain. Important defaults include:

```text
typing        -> working -> thinking -> idle
working       -> thinking -> idle
approval      -> thinking -> idle
waiting_input -> thinking -> idle
quota_empty   -> sleep -> idle
offline       -> sleep -> idle
```

Invalid referenced files make the package invalid and the Registry ignores that package without
stopping the application. A valid package may omit `working`; the Animation Resolver then follows
the chain above. Even a corrupted in-memory package without `idle` produces no animation instead
of throwing through the renderer.

## Discovery, selection, and import

The Registry scans two roots:

- `pets/` under the application path contains reviewed built-in packages;
- `pets/` under Electron's user-data directory contains user imports and remains outside Git.

Built-in packages are loaded first. Duplicate IDs are reported and ignored rather than silently
overriding a reviewed package. The selected ID is stored in `.active-pet.json` in the managed user
pet directory. If it is missing, damaged, or references an unavailable package, the Registry uses
the configured built-in fallback and then the first valid package.

In **Settings Center -> Pets**:

1. **Import package** opens a native directory picker.
2. The source tree, manifest, preview, and sprite sheets are validated before any copy.
3. A valid source is copied into a temporary directory under user-data `pets/`.
4. The copy is validated again and atomically renamed to its package ID.
5. The Registry rescans and makes the imported package active.

Duplicate IDs, unsafe filesystem entries, missing resources, malformed JSON, invalid PNG headers,
and incompatible geometry return a specific error. A failed import removes its temporary copy and
does not replace an installed package. **Open directory** opens the managed user directory;
**Rescan** refreshes the cache after local authoring changes.

## External sprite projects

`ExternalPetAdapter<TSource>` is a neutral future extension contract with `canAdapt()` and
`adapt()`. An adapter must convert a user-selected local source into this canonical package
layout; it does not grant network access, change validation, bind the app to one external project,
or permit redistribution of third-party assets. Clawd pets, user-created sprites, and
Pokemon-like art styles can be supported only through independently lawful user-provided assets;
no copyrighted character pack is bundled here.

## Original example assets

Pixel Sprout is procedural original artwork under MIT. Its committed PNGs can be reproduced with:

```bash
node scripts/generate-original-pet-assets.mjs
```

The generator and output contain no third-party character, game, logo, font, or sound resource.
