# Pet Session Quick View and Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a left click on the pet show a compact current-session summary, and make a right click open a detailed Chinese session Hub with a direct Settings Center action.

**Architecture:** Continue using the privacy-filtered `DesktopSnapshot.sessionOverview` as the only renderer data source. Keep the quick view as renderer-local transient state, reuse persisted `hudVisible` for the full Hub so the existing window relayout remains authoritative, and route Settings through one new narrow main-process IPC action. Replace the pet-window native context popup with the existing `open-status` command while leaving the tray menu intact.

**Tech Stack:** TypeScript 6, React 19, Electron 43, Vitest 4, CSS.

## Global Constraints

- Preserve all pre-existing worktree changes and the current user profile.
- Do not read or render raw prompt, response, command, cwd, JSON-RPC, or JSONL content.
- Use only normalized `DesktopSnapshot` session summaries in the renderer.
- Keep `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true` unchanged.
- Do not modify Pokémon or other pet animation assets.
- Do not commit or push without explicit user authorization.

---

### Task 1: Build a privacy-safe session presentation model

**Files:**

- Create: `src/renderer/sessions/session-view-model.ts`
- Create: `tests/session-ui-view-model.test.ts`

**Interfaces:**

- Consumes: `DesktopSnapshot` and `DesktopSessionSummary` from `src/shared/ipc-contract.ts`.
- Produces: `buildSessionPresentation(snapshot, limit)` with total count, active count, sorted summary items, Chinese state labels, and bounded duration text.

- [x] **Step 1: Write the failing view-model tests**

```ts
expect(buildSessionPresentation(snapshot, 3)).toMatchObject({
  totalCount: 4,
  activeCount: 2,
  items: [
    { title: "需要确认的任务", stateLabel: "等待确认", requiresAttention: true },
    { title: "正在实现会话 Hub", stateLabel: "工作中" },
    { title: "最近完成的任务", stateLabel: "已完成" },
  ],
});
expect(formatSessionDuration(0)).toBe("<1 分钟");
expect(formatSessionDuration(3_660_000)).toBe("1 小时 1 分钟");
```

- [x] **Step 2: Run the focused test and require the missing-module failure**

Run: `npx vitest run tests/session-ui-view-model.test.ts`

Expected: FAIL because `session-view-model.ts` does not exist.

- [x] **Step 3: Implement deterministic sorting and formatting**

```ts
const ACTIVE_STATES = new Set(["thinking", "working", "approval", "waiting_input"]);

export function buildSessionPresentation(snapshot: DesktopSnapshot, limit = 6) {
  const sessions = [...(snapshot.sessionOverview?.sessions ?? [])].sort(
    (left, right) =>
      Number(right.requiresAttention) - Number(left.requiresAttention) ||
      Number(ACTIVE_STATES.has(right.state)) - Number(ACTIVE_STATES.has(left.state)) ||
      right.lastActivityAt - left.lastActivityAt,
  );
  return {
    totalCount: sessions.length,
    activeCount: snapshot.activeThreadCount,
    items: sessions.slice(0, Math.max(0, limit)).map(toSessionPresentationItem),
  };
}
```

- [x] **Step 4: Rerun the focused test and require PASS**

Run: `npx vitest run tests/session-ui-view-model.test.ts`

Expected: the new test file passes.

### Task 2: Add the left-click session quick view

**Files:**

- Create: `src/renderer/sessions/SessionQuickView.tsx`
- Modify: `src/renderer/app/App.tsx`
- Modify: `src/renderer/pet/Pet.tsx`
- Modify: `src/renderer/pet/window-shape-reporter.ts`
- Modify: `src/renderer/styles/pet.css`
- Modify: `tests/pet-state-overlay.test.ts`

**Interfaces:**

- Consumes: `buildSessionPresentation(snapshot, 3)`.
- Produces: a keyboard-accessible `.pet-primary-action` and a shaped `.session-quick-view` overlay.

- [x] **Step 1: Add failing markup and shape assertions**

```ts
expect(markup).toContain('class="pet-sprite-slot pet-primary-action"');
expect(markup).toContain('aria-label="查看当前会话速览"');
expect(reporter).toContain(".session-quick-view");
```

- [x] **Step 2: Run the focused tests and require failure**

Run: `npx vitest run tests/pet-state-overlay.test.ts tests/session-ui-view-model.test.ts`

Expected: FAIL because the pet is not yet clickable and the quick-view shape is absent.

- [x] **Step 3: Render a compact Chinese session card from local state**

```tsx
const [quickViewVisible, setQuickViewVisible] = useState(false);
useEffect(() => {
  if (snapshot?.settings.hudVisible) setQuickViewVisible(false);
}, [snapshot?.settings.hudVisible]);

<Pet
  onPrimaryAction={() => setQuickViewVisible((visible) => !visible)}
  primaryActionExpanded={quickViewVisible}
  interactionOverlay={quickViewVisible ? <SessionQuickView snapshot={snapshot} /> : undefined}
/>;
```

```tsx
<button
  type="button"
  className="pet-sprite-slot pet-primary-action"
  aria-label="查看当前会话速览"
  aria-expanded={primaryActionExpanded}
  onClick={onPrimaryAction}
>
  {sprite}
</button>
```

- [x] **Step 4: Include the quick card in transparent-window shaping and style it without resizing compact mode**

```ts
document.querySelectorAll<HTMLElement>(
  ".pet-resources, .session-quick-view, .panel, .approval-card, .reply-card",
);
```

The card is absolute-positioned inside `.pet-stage`, uses `-webkit-app-region: no-drag`, shows at most three titles, and remains within the compact window bounds.

- [x] **Step 5: Rerun focused tests and require PASS**

Run: `npx vitest run tests/pet-state-overlay.test.ts tests/session-ui-view-model.test.ts tests/pet-window-shape.test.ts`

Expected: all focused tests pass.

### Task 3: Open the detailed Hub on right click and expose Settings safely

**Files:**

- Modify: `src/main/menu/pet-context-menu.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/shared/ipc-contract.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/hud/Hud.tsx`
- Modify: `src/renderer/styles/base.css`
- Modify: `tests/pet-context-menu.test.ts`
- Modify: `tests/ipc-validation.test.ts`

**Interfaces:**

- Produces: `PET_CONTEXT_ACTION = { type: "open-status" }`, `DesktopApi.openSettings(): Promise<void>`, and a detailed Chinese Hub backed only by `DesktopSnapshot`.
- Consumes: the existing `executePetMenuAction({ type: "open-status" })`, `SettingsWindowManager.open()`, `window.codexPet.selectThread()`, and `window.codexPet.toggleHud()`.

- [x] **Step 1: Add failing context-action and IPC registration tests**

```ts
expect(PET_CONTEXT_ACTION).toEqual({ type: "open-status" });
expect(handlers.has(IPC_CHANNELS.openSettings)).toBe(true);
```

- [x] **Step 2: Run focused tests and require failure**

Run: `npx vitest run tests/pet-context-menu.test.ts tests/ipc-validation.test.ts`

Expected: FAIL because the direct context action and Settings IPC do not exist.

- [x] **Step 3: Route pet-window right click directly to the existing Hub action**

```ts
export const PET_CONTEXT_ACTION: PetMenuAction = { type: "open-status" };

window.webContents.on("context-menu", () => execute(PET_CONTEXT_ACTION));
```

The tray keeps using `buildPetMenuTemplate`; only the pet window stops showing the native popup.

- [x] **Step 4: Add a parameter-free Settings IPC method**

```ts
openSettings: "desktop:open-settings",
```

```ts
ipcMain.handle(IPC_CHANNELS.openSettings, () => actions.openSettings());
```

```ts
openSettings: () => ipcRenderer.invoke(IPC_CHANNELS.openSettings),
```

The main action calls `settingsWindowManager.open()` and does not expose paths or BrowserWindow access to the renderer.

- [x] **Step 5: Upgrade `Hud` into a detailed Chinese session Hub**

The Hub header reads `会话 Hub`, shows total and active counts, lists up to six sorted sessions with state, project label, active duration, elapsed duration, and attention status, keeps quota/token details, and includes these actions:

```tsx
<button onClick={() => void window.codexPet.openSettings()}>打开设置中心</button>
<button onClick={() => void window.codexPet.toggleHud()}>关闭</button>
```

Selectable sessions call `window.codexPet.selectThread(session.sessionId)`; unavailable actions remain disabled.

- [x] **Step 6: Rerun focused tests and require PASS**

Run: `npx vitest run tests/pet-context-menu.test.ts tests/ipc-validation.test.ts tests/session-ui-view-model.test.ts`

Expected: all focused tests pass.

### Task 4: Verify and replace the running package

**Files:**

- Modify only previously listed files if verification finds a defect.
- Rebuild ignored output: `release/Codex Pet Desktop-win32-x64/**`.
- Preserve: `%APPDATA%/Codex Pet Desktop/**` and `tmp/local-pokepets/**`.

**Interfaces:**

- Consumes: repository quality gates, `npm run package:dir`, and the existing packaged-app read-only diagnostic method.
- Produces: a relaunched package with verified left-click quick view, right-click Hub, Settings action, and unchanged pet assets.

- [x] **Step 1: Format and run all automated gates**

Run in order:

```text
npx prettier --write <only touched files>
npm run format:check
npm run lint
npm test
npm run build
```

Expected: exit code `0` for every command.

- [x] **Step 2: Audit the worktree**

Confirm no files under Pokémon/pet asset directories changed, preserve every pre-existing modification, and scan changed paths for credentials, session files, and private logs.

- [x] **Step 3: Stop only the exact repository release process and rebuild**

Verify every target process has executable path `release/Codex Pet Desktop-win32-x64/Codex Pet Desktop.exe`, stop only those processes, then run `npm run package:dir` and require exit code `0`.

- [x] **Step 4: Perform packaged interaction verification**

Launch the package temporarily with a loopback-only diagnostic port. Verify read-only DOM facts after dispatching pointer interactions: left click changes the quick-view visibility and displays session counts/titles; right-click changes `snapshot.settings.hudVisible` to `true`; the Hub contains detailed session rows and `打开设置中心`; invoking that button opens the one reused Chinese Settings window.

- [x] **Step 5: Restore ordinary launch**

Close the diagnostic instance, confirm its loopback port is closed, relaunch the same executable without diagnostic flags using the existing user profile, and report packaged versus automated evidence separately.
