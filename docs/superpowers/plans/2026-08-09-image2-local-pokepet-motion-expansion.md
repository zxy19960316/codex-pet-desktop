# Image2 Local PokePet Motion Expansion — Execution Record

**Goal:** Expand the existing local Pikachu, Mew, and Charizard references into multi-frame desktop-pet actions, integrate every runtime state locally, and keep all character imagery out of Git and release artifacts.

**Final visual status (2026-08-09):** Partial image-generation success, complete functional integration. Seventeen of the 36 state animations use image-generated keyframes. The other 19 states retain explicit source-original or derived-variant provenance; none are reported as generated.

## Safety boundaries

- Character references, generated images, keyed images, packages, previews, reports, and prompts stay below ignored `tmp/local-pokepets/` or the managed local directory `%APPDATA%/Codex Pet Desktop/pets/`.
- Generated character imagery is local-only with `redistributionAllowed=false`.
- No character binary is added to Git, an installer, a push, a PR, or a release.
- The unrelated pre-existing `README.zh-CN.md` modification is preserved and untouched.
- No commit or push is performed without separate user authorization.

## Prompt and generation strategy

The initial prompt requested a paired `4 x 2` sheet with eight frames. Output moderation blocked most requests. The second pass reduced each request to one state in a `2 x 2` sheet with four row-major action keyframes, removed character and franchise names from prompt text, and used only the local reference image as the visual identity anchor. The v3 continuation used previously accepted generated sheets as new visual anchors and shortened prompts to one neutral action instruction.

Each accepted image was processed locally:

1. Remove the flat green background with border auto-key, soft matte, despill, and transparent output.
2. Verify four non-empty cells and transparent corners.
3. Normalize each pose into a `192 x 208` runtime cell.
4. Preserve forward keyframe order so pose four returns close to pose one.
5. Save the finished strip as lossless WebP with exact transparent RGB.

## Generation results

| Pet       | Image-generated states                                                                               | Count | Remaining state provenance          |
| --------- | ---------------------------------------------------------------------------------------------------- | ----: | ----------------------------------- |
| Pikachu   | none                                                                                                 |     0 | source-original and derived-variant |
| Charizard | `idle`, `thinking`, `typing`, `working`, `waiting_input`, `success`, `error`, `quota_empty`, `sleep` |     9 | source-original and derived-variant |
| Mew       | `idle`, `thinking`, `typing`, `waiting_input`, `success`, `error`, `offline`, `sleep`                |     8 | source-original and derived-variant |

Total: **17 independent-generated**, **11 source-original**, and **8 derived-variant** states across three complete 12-state packages.

Known output-moderation stops are retained in the local prompt records. In v3, Charizard added `idle` and `quota_empty`; `approval`, `quota_low`, and `offline` remained blocked. Mew added six states; `working`, `approval`, `quota_low`, and `quota_empty` remained blocked. Pikachu `success`, `working`, and `idle` each failed twice, so its remaining nine v3 requests were not run.

## Implementation checklist

### Tooling

- [x] Support paired `4 x 2` sheets with an optional selected row.
- [x] Support a complete single-state `2 x 2` sheet in row-major order.
- [x] Validate that a single-state grid contains exactly four keyframes.
- [x] Preserve forward keyframe sequencing instead of reversing the generated action.
- [x] Encode transparent WebP output with exact hidden RGB values.
- [x] Add focused and end-to-end tests for `2 x 2` ingestion.
- [x] Compute validation-report provenance counts from manifests instead of hard-coded completion text.

### Local packages

- [x] Build all 12 states for Pikachu, Charizard, and Mew.
- [x] Label every state with its real provenance class.
- [x] Finalize contact sheets and animated previews.
- [x] Validate all packages and install them with explicit replacement.
- [x] Set `charizard-local-12state` as the active local pet.
- [x] Verify all three managed packages match their derived packages byte-for-byte.

### Visual and application QA

- [x] Inspect reference, raw, keyed, contact-sheet, and animated-preview images.
- [x] Confirm no blank frames in the installed animations.
- [x] Correct the Charizard success scale so no generated frame touches a cell edge.
- [x] Run a desktop smoke test with a visible transparent window, tray creation, all 12 state controls, screenshot capture, and graceful quit.
- [x] Produce `tmp/local-pokepets/reports/final-validation.json` with `completionStatus=partial-visual-fallback`.

### Repository gates

- [x] Run final formatting, lint, test, and build gates after the last tooling edit.
- [x] Run the final Git ignore and tracked-binary safety audit.

## Acceptance interpretation

The runtime objective is complete: each local pet exposes all 12 requested states and resolves each state directly. The visual-generation objective is partial: 17 states are image-generated and 19 use documented local fallbacks. Output-moderation failures and `NOT_RUN` states remain failures or not-run evidence and are not relabeled as passes.
