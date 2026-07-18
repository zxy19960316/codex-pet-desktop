# Codex Pet Desktop M3.0 Settings Center Implementation Plan

> **For agentic workers:** Implement this plan task-by-task in the current session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, versioned, independently rendered Settings Center that migrates existing local settings and synchronizes supported changes to the pet window immediately.

**Architecture:** A main-process `SettingsStore` owns atomic JSON I/O, `MigrationRegistry` owns deterministic schema upgrades, and `SettingsService` owns the current v2 document plus runtime-facing flat settings. A separate sandboxed BrowserWindow uses a dedicated preload and typed IPC contract; its renderer receives only settings-safe status data and validated patch operations.

**Tech Stack:** Electron 43, React 19, TypeScript 6, Vite 8 multi-page build, Vitest 4, Node.js filesystem promises.

## Global Constraints

- Baseline commit is `a91e93030f7067f5ad3bed89d28a6f6bc4c6d41e` on clean `main`.
- Work on `feat/m3-0-settings-center`; never force-push or rewrite history.
- Main-process code belongs under `src/main`; renderer code cannot import Electron, Node.js, or filesystem APIs.
- Settings Window has a dedicated preload and cannot expose the existing development `DesktopApi`.
- Settings IPC validates the sender and every field at runtime, rejecting unknown keys and invalid booleans or numbers.
- Settings persistence uses a temporary file followed by atomic rename.
- Unknown future schema versions and corrupt JSON start with safe defaults but are never overwritten automatically.
- Device-local state and future-syncable preferences remain separate in the v2 schema.
- Every BrowserWindow retains `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- Preserve pet rendering, Codex Hook, App Server, approvals, user input, and M2.6 verification behavior.
- Do not implement M3.1 pet registry, third-party pet import, cloud sync, mobile, marketplace, auto-update, or copyrighted assets.

---

## File Map

- `src/shared/settings.ts`: v2 document types, defaults, and flat runtime conversion helpers.
- `src/main/settings/settings-migrations.ts`: strict v2 parsing plus legacy-to-v2 migration registry.
- `src/main/settings/settings-store.ts`: non-destructive reads and atomic v2 writes.
- `src/main/settings/settings-service.ts`: initialization, serialized patching, load diagnostics, and change subscriptions.
- `src/shared/ipc/settings-ipc.ts`: dedicated settings channels, safe snapshot, patch, and preload API types.
- `src/main/settings/settings-ipc-handlers.ts`: sender authorization and field-level patch parsing.
- `src/main/windows/settings-window-manager.ts`: secure single-instance Settings Window ownership.
- `src/preload/settings.ts`: frozen, narrow Settings API bridge.
- `src/renderer/settings/*` and `settings.html`: six-section Settings Center renderer.
- `src/main/index.ts`, `src/main/window-manager.ts`, `src/main/tray-manager.ts`: composition, live synchronization, and tray entry.
- `vite.config.ts`, `package.json`, `src/renderer/env.d.ts`: multi-page renderer and second preload build/type wiring.
- `tests/settings-migrations.test.ts`, `tests/settings-service.test.ts`: migration, protection, atomicity, defaults, and live change behavior.
- `tests/settings-ipc-validation.test.ts`, `tests/settings-renderer-boundary.test.ts`: patch/sender validation, single-instance window reuse, and renderer isolation.
- `docs/architecture/ARCHITECTURE.md`: M3 storage, migration, window, IPC, and implemented-scope documentation.

### Task 1: Versioned settings domain, migration, storage, and service

**Files:**

- Create: `src/main/settings/settings-migrations.ts`
- Create: `src/main/settings/settings-store.ts`
- Create: `src/main/settings/settings-service.ts`
- Modify: `src/shared/settings.ts`
- Test: `tests/settings-migrations.test.ts`
- Test: `tests/settings-service.test.ts`

**Interfaces:**

```ts
interface SettingsDocumentV2 {
  schemaVersion: 2;
  preferences: {
    alwaysOnTop: boolean;
    clickThrough: boolean;
    soundEnabled: boolean;
    quotaWarningPercent: number;
  };
  device: {
    layoutVersion: number;
    petPosition?: WindowPosition;
    hudVisible: boolean;
    debugVisible: boolean;
    useMockData: boolean;
    autoStartAppServer: boolean;
  };
}

class MigrationRegistry {
  migrate(input: unknown): SettingsDocumentV2;
}

class SettingsService {
  initialize(): Promise<LocalSettings>;
  getSettings(): LocalSettings;
  getDocument(): SettingsDocumentV2;
  getLoadState(): SettingsLoadState;
  patch(patch: Partial<LocalSettings>): Promise<LocalSettings>;
  subscribe(listener: (settings: LocalSettings) => void): () => void;
}
```

- [ ] Add migration tests proving legacy flat fields map into the correct `preferences` and `device` partitions, missing fields use defaults, and the output is always `schemaVersion: 2`.
- [ ] Run `npm test -- tests/settings-migrations.test.ts`; expect failure because migration modules do not exist.
- [ ] Implement strict v2 parsing and a `MigrationRegistry` whose v1 entry maps only known legacy fields and defaults invalid/missing legacy values deterministically.
- [ ] Re-run `npm test -- tests/settings-migrations.test.ts`; expect all migration tests to pass.
- [ ] Add service/store tests for missing files, corrupt JSON, future `schemaVersion`, atomic replacement, failed rename preserving the previous file, serialized patches, and change notifications for `alwaysOnTop`, `clickThrough`, and `quotaWarningPercent`.
- [ ] Run `npm test -- tests/settings-service.test.ts`; expect failure because the store and service do not exist.
- [ ] Implement `SettingsStore.read()` so a present v2 file is authoritative, corrupt/future files return protected diagnostics without deletion or rewrite, and a valid legacy `settings.json` is migrated once to `settings.v2.json`.
- [ ] Implement `SettingsStore.write()` with a same-directory unique temporary file, mode `0o600`, newline-terminated JSON, atomic `rename`, and best-effort temporary-file cleanup on failure.
- [ ] Implement `SettingsService` with in-memory defaults, serialized writes, non-persistent in-memory patches while a corrupt/future file is protected, and subscriptions after successful in-memory state changes.
- [ ] Run `npm test -- tests/settings-migrations.test.ts tests/settings-service.test.ts`; expect all focused tests to pass.
- [ ] Run the repository quality gates, inspect the diff/status, stage only Task 1 files, and commit `feat: add versioned settings service`.

### Task 2: Dedicated Settings Window, IPC, preload, renderer, and live synchronization

**Files:**

- Create: `settings.html`
- Create: `src/shared/ipc/settings-ipc.ts`
- Create: `src/main/settings/settings-ipc-handlers.ts`
- Create: `src/main/windows/settings-window-manager.ts`
- Create: `src/preload/settings.ts`
- Create: `src/renderer/settings/main.tsx`
- Create: `src/renderer/settings/SettingsApp.tsx`
- Create: `src/renderer/settings/settings.css`
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/window-manager.ts`
- Modify: `src/main/tray-manager.ts`
- Modify: `src/renderer/env.d.ts`
- Test: `tests/settings-ipc-validation.test.ts`
- Test: `tests/settings-renderer-boundary.test.ts`

**Interfaces:**

```ts
interface SettingsApi {
  getSnapshot(): Promise<SettingsWindowSnapshot>;
  subscribe(listener: (snapshot: SettingsWindowSnapshot) => void): () => void;
  patch(patch: SettingsPatch): Promise<void>;
}

interface SettingsPatch {
  preferences?: Partial<
    Pick<
      SettingsPreferences,
      "alwaysOnTop" | "clickThrough" | "soundEnabled" | "quotaWarningPercent"
    >
  >;
  device?: Partial<Pick<DeviceSettings, "useMockData" | "autoStartAppServer">>;
}
```

- [ ] Add failing validation tests for legal patches, non-boolean values, out-of-range/non-finite quota values, unknown top-level/nested keys, and unauthorized sender IDs.
- [ ] Add a failing fake-window test proving repeated `open()` calls reuse, show, and focus the same Settings Window.
- [ ] Add a failing boundary test scanning only `src/renderer/settings` and asserting no Electron, Node, filesystem, `process`, `require`, hard-coded local path, or `DesktopApi` access.
- [ ] Run `npm test -- tests/settings-ipc-validation.test.ts tests/settings-renderer-boundary.test.ts`; expect failures for missing modules/files.
- [ ] Implement fixed settings IPC channels, safe runtime/status snapshot types, exact-key validation, sender ownership checks, and handler disposal.
- [ ] Implement a single-instance `SettingsWindowManager` with a normal framed window, dedicated preload, `settings.html`, and secure BrowserWindow preferences.
- [ ] Implement the dedicated frozen preload API with only get/subscribe/patch methods.
- [ ] Configure Vite multi-page output and esbuild output for `dist/preload/settings.cjs` without changing the pet renderer entry.
- [ ] Wire `SettingsService` into runtime persistence and pet-position persistence; route Settings patches through `RuntimeController.patchSettings()` so existing `onSettingsChanged` applies always-on-top/click-through/tray changes immediately.
- [ ] Publish settings-safe snapshots whenever the existing runtime snapshot changes, including quota warning changes, while preserving existing pet snapshot publication and M2.6 result writing.
- [ ] Add a tray `Settings...` action and keep all existing tray actions unchanged.
- [ ] Build the six visible sections: Status, General, Codex Connection, Quota, Diagnostics, and About; show pending/error feedback without importing system APIs.
- [ ] Re-run `npm test -- tests/settings-ipc-validation.test.ts tests/settings-renderer-boundary.test.ts`; expect all focused tests to pass.
- [ ] Run focused existing regression tests for settings, runtime controller, renderer boundary, window layout, IPC validation, Hook/App Server, approvals, input, and E2E verification.
- [ ] Run the repository quality gates, inspect the diff/status, stage only Task 2 files, and commit `feat: add settings center window and ipc`.

### Task 3: Architecture documentation

**Files:**

- Modify: `docs/architecture/ARCHITECTURE.md`
- Include: `docs/superpowers/plans/2026-07-18-m3-0-settings-center.md`

- [ ] Document v2 partitions, legacy field mapping, migration timing, atomic write behavior, and corrupt/future-version protection.
- [ ] Document the independent Settings Window, dedicated preload, sender validation, patch allowlist, and renderer sandbox.
- [ ] Document live synchronization through existing RuntimeController hooks without adding Settings Window responsibilities to RuntimeController.
- [ ] Explicitly state implemented M3.0 scope and defer pet registry/import, cloud sync, marketplace, mobile, auto-update, and packaging work.
- [ ] Run documentation-inclusive quality gates, inspect the diff/status, stage only documentation, and commit `docs: document M3 settings architecture`.

### Task 4: Final verification and publish

- [ ] Run in order: `npm run format:check`, `npm run lint`, `npm test`, `npm run build`, `git diff --check`, and `git status --short`; require exit code 0 for every command.
- [ ] Record the final Vitest file/test totals and confirm the original 83 tests remain represented with no regressions.
- [ ] Inspect tracked and staged paths/content for `settings.json`, `settings.v2.json`, user pets, logs, tokens, credentials, local absolute paths, `tmp`, `dist`, and other generated artifacts.
- [ ] Confirm exactly the intended focused commits, clean worktree, branch name, local HEAD, and origin URL.
- [ ] Run `git push -u origin feat/m3-0-settings-center` once; on failure preserve local commits and report the exact command/error without force-push.

## Self-Review

- Spec coverage: schema/migration/store/service, dedicated window/preload/IPC, six UI sections, immediate pet sync, sender/field validation, atomic writes, protected reads, isolation, commits, gates, and push all map to explicit tasks.
- Placeholder scan: every task names exact files, interfaces, commands, expected fail/pass behavior, and commit boundaries.
- Type consistency: `SettingsDocumentV2` is the persisted form, `LocalSettings` remains RuntimeController's compatibility form, and `SettingsPatch` is the only renderer mutation form.
