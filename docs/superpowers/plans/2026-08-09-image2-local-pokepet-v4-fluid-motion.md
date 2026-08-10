# Image2 Local PokePet V4 Fluid Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the remaining fallback states with locally generated action sheets where the built-in image service permits it, and make every accepted action loop smoother and more visibly expressive.

**Architecture:** Keep the existing manifest and renderer contract, but allow a single-state action sheet to contain either four key poses or the state's complete runtime frame count. Generate `3 x 2` sheets for six-frame states, `4 x 2` sheets for eight-frame states, and `2 x 2` sheets for four-frame states so accepted full-frame sheets play without duplicated poses. Retain the current four-keyframe path as a safe fallback and preserve truthful provenance when generation is blocked.

**Tech Stack:** Built-in ImageGen, local chroma-key removal, Python 3/Pillow, Node.js ESM workflow scripts, Vitest, Electron smoke validation.

## Global Constraints

- Work only from local reference or previously accepted generated images.
- Keep all character images, prompts, backups, packages, previews, and reports under ignored `tmp/local-pokepets/` or `%APPDATA%/Codex Pet Desktop/pets/`.
- Do not use the CLI/API path and do not request `OPENAI_API_KEY`.
- Never overwrite the v3 evidence; write raw and alpha outputs under `raw-v4/` and `alpha-v4/`.
- Treat every output-moderation failure and every unrun request as failure evidence, not success.
- Preserve the user's unrelated `README.zh-CN.md` modification.
- Do not commit or push without separate authorization.

## Execution outcome

The v4 built-in ImageGen gate closed after six output-stage `moderation_blocked/other` results spanning all three characters, single-frame and accepted-sheet references, long and short prompts, and full-frame and four-keyframe layouts. No v4 image output was accepted, no raw or alpha v4 file was created, and no CLI/API fallback was used. Exact prompts and request IDs are retained locally in `tmp/local-pokepets/prompts/v4-fluid-motion.json`.

To complete the user's motion-quality goal without mislabeling fallback art, execution continued with a `fluid-v4` local motion pass over all 36 already accepted state strips. The pass extracts old strips frame by frame, closes the transform seam, adds state-specific secondary motion and pixel accents, and creates a simultaneous animated QA board.

---

### Task 1: Accept full-frame single-state action grids

**Files:**

- Modify: `scripts/local-pokepets/build-animation-strip.mjs`
- Test: `tests/local-pokepets-workflow.test.ts`

**Interfaces:**

- Consumes: `--grid-columns`, `--grid-rows`, and the selected state's `STATE_SPECS[state].frames`.
- Produces: a valid strip from either four key poses or exactly `STATE_SPECS[state].frames` poses.

- [x] **Step 1: Add failing six-frame and eight-frame tests.**

```ts
await writeFile(sixFrameInput, transparentKeyframeGrid(3, 2));
await execFileAsync("node", [
  buildAnimationStrip,
  "--workspace",
  root,
  "--pet",
  "mew",
  "--state",
  "thinking",
  "--source-atlas",
  sourceAtlas,
  "--input",
  sixFrameInput,
  "--classification",
  "independent-generated",
  "--grid-columns",
  "3",
  "--grid-rows",
  "2",
]);
expect(await readImageMetadata(join(root, "derived/mew-local-12state/thinking.webp"))).toEqual({
  format: "webp",
  width: 1152,
  height: 208,
});
```

Repeat with `working`, a `4 x 2` input, and expected width `1536`.

- [x] **Step 2: Run the focused test and require failure.**

Run: `npx vitest run tests/local-pokepets-workflow.test.ts`

Expected: FAIL with `Single-state action sheets must contain exactly four grid cells`.

- [x] **Step 3: Validate four-keyframe or full-frame grids.**

Move state parsing before grid validation and replace the fixed four-cell check with:

```js
const spec = STATE_SPECS[state];
const keyframeCount = gridColumns * gridRows;
if (gridRow === undefined && !new Set([4, spec.frames]).has(keyframeCount)) {
  throw new Error(
    `Single-state action sheets must contain four keyframes or ${spec.frames} full frames`,
  );
}
```

Keep paired sheets restricted to `4 x 2` with an explicit selected row.

- [x] **Step 4: Run the focused test and require PASS.**

Run: `npx vitest run tests/local-pokepets-workflow.test.ts`

Expected: all local PokePet workflow tests pass.

### Task 2: Prepare focused single-frame anchors and v4 prompts

**Files:**

- Local only: `tmp/local-pokepets/references-v4/<pet>/*.webp`
- Local only: `tmp/local-pokepets/prompts/<pet>-v4.json`

**Interfaces:**

- Consumes: current installed strips and accepted v3 sheets.
- Produces: one uncluttered visual anchor per character plus one exact prompt record per attempted state.

- [x] **Step 1: Extract or reuse one uncluttered frame per character.**

Use `preview.webp` or a successful generated sheet already viewed in the conversation. Do not use labeled contact sheets when a single-frame asset exists.

- [x] **Step 2: Define action beats with a closed loop.**

Every prompt must name each sequential beat and require the final pose to return near the first. Active states must include body, limb, face, and tail or wing motion where the character has those features.

- [x] **Step 3: Record each attempt and request ID.**

Each v4 JSON state entry contains `state`, `layout`, `reference`, `attempts`, `status`, `output`, and `qa_notes`.

### Task 3: Generate the remaining 19 states

**Files:**

- Local only: `tmp/local-pokepets/image2/<pet>/raw-v4/*.png`
- Local only: `tmp/local-pokepets/image2/<pet>/alpha-v4/*.png`

**Interfaces:**

- Consumes: v4 anchors and per-state action beats.
- Produces: full-frame sheets when accepted; four-keyframe sheets as the second strategy.

- [ ] **Step 1: Complete Charizard's three missing states.**

Attempt `approval`, `quota_low`, and `offline` with six, six, and four frames respectively.

- [ ] **Step 2: Complete Mew's four missing states.**

Attempt `working`, `approval`, `quota_low`, and `quota_empty` with eight, six, six, and six frames respectively.

- [ ] **Step 3: Pilot Pikachu with single-frame anchors.**

Attempt `idle`, `working`, and `success` first. If one succeeds, use it as the accepted visual anchor for the other nine states. If all three are output-blocked twice, retain the complete functional package and stop the character without relabeling it.

- [x] **Step 4: Apply one-variable retries.**

Retry only by changing one of: full-frame grid to four-keyframe grid, action wording to shorter beats, or multi-frame reference to a single-frame reference. Do not change execution mode.

### Task 3A: Complete the fluid local fallback after the generation gate

**Files:**

- Modify: `scripts/local-pokepets/image-tools.py`
- Modify: `scripts/local-pokepets/build-animation-strip.mjs`
- Test: `tests/local-pokepets-workflow.test.ts`

- [x] **Step 1: Add red tests for pixel-identical loop transforms and frame-by-frame strip input.**

- [x] **Step 2: Implement seam-closed state motion, horizontal and vertical squash-and-stretch, and semantic pixel accents.**

- [x] **Step 3: Add an animated 12-state QA board and per-strip motion statistics.**

- [x] **Step 4: Rebuild all 36 states from the pre-v4 backup while preserving provenance classifications.**

### Task 4: Build, assess, and install accepted loops

**Files:**

- Local only: `tmp/local-pokepets/derived/<pet>-local-12state/*.webp`
- Local only: `tmp/local-pokepets/qa/<pet>-local-12state/`
- Local only: `%APPDATA%/Codex Pet Desktop/pets/<pet>-local-12state/`

**Interfaces:**

- Consumes: accepted alpha sheets.
- Produces: installed state strips with truthful `independent-generated` provenance.

- [ ] **Step 1: Remove chroma and validate every cell.**

Run the installed `remove_chroma_key.py` helper with border auto-key, soft matte, threshold `12`, opaque threshold `220`, and despill. Require transparent corners and plausible coverage in every cell.

- [ ] **Step 2: Build strips with exact grid geometry.**

Use `--grid-columns 3 --grid-rows 2` for six-frame sheets, `4 x 2` for eight-frame sheets, and `2 x 2` for four-frame sheets. Use `classification=independent-generated` only for accepted generated imagery.

- [x] **Step 3: Enforce motion QA.**

For every rebuilt state require `blankFrames=0`, `edgeTouches=0`, and `loopCenterDelta <= 3`. Allow intentional `success` jumps but require `maxCenterStep <= 20`. Reject an action if its contact sheet does not show visibly distinct sequential beats.

- [x] **Step 4: Back up, validate, install, and hash-compare.**

Create a new pre-v4 backup, run `validate-derived-pet.mjs`, install with explicit `--replace`, and require zero SHA-256 mismatches between derived and managed packages.

### Task 5: Final application and repository gates

**Files:**

- Local only: `tmp/local-pokepets/reports/final-validation.json`
- Verify: tracked source, tests, and plans.

**Interfaces:**

- Produces: final visual evidence, truthful state counts, and a clean local-only boundary.

- [x] **Step 1: Run one desktop smoke per updated pet.**

Require visible, frameless, transparent, always-on-top window; tray creation; 12-state contract; screenshot capture; and graceful quit.

- [x] **Step 2: Run repository gates.**

Run: `npm run format:check`, `npm run lint`, `npm test`, and `npm run build`.

Expected: all commands pass.

- [x] **Step 3: Run Git safety audit.**

Run: `git diff --check`, `git status --short`, `git diff --cached --name-only`, `git check-ignore -v tmp/local-pokepets/...`, and inspect tracked PNG/WebP/GIF files.

Expected: no local character asset, prompt, package, backup, or report is tracked or staged.

## Execution choice

The user has already requested continued execution in this session, so this plan uses inline execution with checkpoints. No new task or subagent dispatch is required.
