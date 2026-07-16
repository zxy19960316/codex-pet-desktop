# Product Reset Audit: Pixel Pet First

Date: 2026-07-16

## Decision

The previous milestone order is no longer the product baseline. The project will prioritize a
small, expressive, pixel-art desktop pet that reflects the user's real Codex activity. Approval,
reply, and turn-control work remains useful infrastructure, but it must not dominate the default
window or block pet rendering and real activity observation.

The paper sketch is the visual source of truth:

- two compact quota rows at the top (`5h` and `weekly`),
- one small expand/collapse control,
- a large central 2D pixel creature,
- no permanent developer console,
- extra UI appears only when requested or when Codex needs a human decision.

## First-principles requirements

1. **It must behave like a desktop pet.** The resting footprint is small, transparent, always on
   top, movable, and visually centered on the creature.
2. **State must be legible without text.** Idle, thinking, working, waiting, success, and error need
   distinct animation or pose treatment. A state label is secondary, not the primary signal.
3. **It must observe the Codex the user is already using.** Starting a private App Server child is
   not sufficient for observing unrelated Codex app or CLI sessions.
4. **Interaction must be progressive.** Quota summary is always available; details, approval, reply,
   diagnostics, and developer controls expand only when needed.
5. **Character art and runtime code are separate.** A declarative manifest maps normalized states
   to sprite animations and fallbacks. User-owned packs stay outside Git.
6. **Security remains structural.** The renderer stays sandboxed, IPC stays typed and allowlisted,
   and external theme paths are never accepted directly from the renderer.

## Findings

### P0: the current event source cannot observe the user's normal Codex activity

`AppServerProcess` starts an App Server owned by this application. `RuntimeController` receives
notifications from that one client and creates its own ephemeral threads for developer controls.
It does not automatically subscribe to sessions already running in another Codex app or CLI
process. This makes the protocol loop technically valid but product-incomplete.

Codex lifecycle hooks are the correct primary observation surface. Official hook events include
`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `SubagentStart`,
`SubagentStop`, and `Stop`. App Server can remain an optional action/control integration.

### P0: the window is a developer panel, not a pet

The fixed `420 x 700` BrowserWindow is much larger than the sketch. The renderer lays out a drag
bar, a 190 px CSS pet, a full HUD, approval/reply cards, developer controls, and debug controls in
one vertical document. Transparent unused space still belongs to the window and can obstruct the
desktop.

The default window should be approximately `300 x 360`; an expanded mode can grow only when the
user opens details or a request needs attention.

### P0: the pet-pack interface is dead code

`PetManifest` and `AnimationDefinition` exist but have no consumer. The visible pet is drawn from
CSS gradients and divs. There is no asset loader, animation selection, state fallback, pixel-perfect
scaling, or manifest validation. M4 therefore contains the actual product core and was scheduled
too late.

### P1: completed turns can visually return to working

`turn/completed` maps to transient `success`. `PetStateMachine` restores the previous stable state
after three seconds. If that previous state was `working`, the pet can return to working even though
the turn is complete. Terminal events need an explicit idle target after the success/error hold.

### P1: production runtime and verification runtime are mixed

`RuntimeController` owns connection, usage, state aggregation, approvals, replies, thread control,
mock data, and the five-path M2.6 verifier. The default renderer contract also exposes developer
verification actions. This increases regression risk and pulled product work toward the verifier.
Verification should be a development-only adapter, not a product-domain responsibility.

### P1: quota settings do not affect pet state

`quotaWarningPercent` is persisted but is not used to derive `quota_low` or `quota_exhausted`.
`soundEnabled` is also persisted without a sound runtime. These are declared features rather than
working behavior.

### P1: click-through is all or nothing

The single BrowserWindow toggles `setIgnoreMouseEvents` for the entire 420 x 700 area. A compact
window reduces the immediate impact. A later Windows hardening pass should separate the visual
surface from a shaped input surface, following the architectural lesson (not source code) from
Clawd on Desk.

### P2: the current visual language is not pixel art

The CSS pet uses gradients, blur, rounded geometry, and continuous transforms. It cannot read as a
2D pixel creature. The renderer also includes corrupted glyph-like button text in the current
source display. The replacement should use raster sprites, `image-rendering: pixelated`, integer
scale, and CSS-drawn controls without font-dependent symbols.

## What stays

- Electron security preferences: context isolation, renderer sandbox, no Node integration.
- Typed preload API and renderer boundary tests.
- Normalized domain events instead of raw JSON-RPC in React.
- Per-session state aggregation and explicit priority ordering.
- Approval and user-input routers, redaction, safe path handling, and lifecycle cleanup.
- Mock data as a clearly labeled development tool.

## What changes first

1. Replace the CSS placeholder with a manifest-driven original pixel sprite.
2. Replace the fixed large shell with compact and expanded window modes.
3. Add an always-visible two-row quota strip matching the sketch.
4. Hide diagnostic and developer controls from the normal product surface.
5. Fix terminal-state restoration.
6. Implement a separate official-hook state bridge and installer/health check.

## Implemented evidence

- Compact desktop capture: `300 x 360`, frameless, transparent, always on top, with no debug,
  developer, approval, or reply panel in the DOM.
- Expanded desktop capture: `420 x 700`; the pet scales down and the approval card remains directly
  reachable without the prior glow artifact.
- The bundled `pixel-sprout.svg` is an original code-drawn `256 x 256` sprite sheet. The image
  generation service timed out, so no generated or third-party bitmap was used.
- Terminal state tests prove `working -> success -> idle` and zero active threads after the hold.
- Hook receiver proof retained `sessionId`, `turnId`, `name`, and `timestamp` while dropping an
  injected secret prompt field.
- App Server auto-start and expanded HUD are both disabled in migrated/default settings.

## Clawd on Desk research boundary

The public project was reviewed at commit `4317b5afbd2eb5c9fc9488f07cb114c107d3dca5`.
Its AGPL-3.0 code and artwork will not be copied into this MIT repository. Only general mechanisms
are adopted independently:

- lifecycle hooks as primary state sensors,
- declarative themes with required states and fallback chains,
- minimum display durations and one-shot return behavior,
- separate compact pet and expanded interaction surfaces,
- optional separation of visual and pointer-hit windows on Windows.

Sources: [Clawd on Desk](https://github.com/rullerzhou-afk/clawd-on-desk),
[Codex hooks](https://learn.chatgpt.com/docs/hooks.md).
