import { describe, expect, it } from "vitest";
import { SnapshotAssembler } from "../src/main/snapshot-assembler";
import { DEFAULT_SETTINGS } from "../src/shared/settings";

describe("SnapshotAssembler", () => {
  it("maps internal cwd values to labels without exposing them to the renderer", () => {
    const projectRoot = "C:/Users/private/project";
    const result = new SnapshotAssembler().build({
      projectRoot,
      e2eRoot: projectRoot + "/tmp/e2e",
      currentCwd: projectRoot + "/tmp/e2e/approval",
      connectionStatus: "connected",
      petState: "idle",
      threadStates: [],
      activeThreadCount: 0,
      approvals: [
        {
          requestId: "approval",
          threadId: "thread-private",
          kind: "command",
          title: "Approval",
          command: "node " + projectRoot + "/script.js",
          cwd: projectRoot + "/tmp/e2e/approval",
          paths: [projectRoot + "/src/file.ts"],
          requestedPermissions: { fileSystem: { read: [projectRoot] } },
          availableDecisions: ["accept"],
          receivedAt: 1,
        },
      ],
      userInputs: [],
      rateLimits: null,
      dailyUsage: null,
      threadTokenUsage: [],
      selectedThreadId: "thread-private",
      selectedThread: {
        threadId: "thread-private",
        cwd: projectRoot + "/examples/demo",
        status: "idle",
        createdAt: 1,
        updatedAt: 1,
        source: "created-by-pet",
      },
      threads: [
        {
          threadId: "thread-private",
          cwd: projectRoot + "/examples/demo",
          status: "idle",
          createdAt: 1,
          updatedAt: 1,
          source: "created-by-pet",
        },
      ],
      e2eRecords: [],
      e2eSteps: [],
      currentThreadTokens: null,
      settings: DEFAULT_SETTINGS,
      protocolSource: "codex-app-server",
    });

    expect(result.currentCwdLabel).toBe("Disposable tmp/e2e");
    expect(result.selectedThread).toEqual(
      expect.objectContaining({ cwdLabel: "Project-relative folder" }),
    );
    expect(result.approvals[0]).toMatchObject({
      command: "node [Project root]/script.js",
      cwd: "Disposable tmp/e2e",
      paths: [expect.stringMatching(/^src[\\/]file\.ts$/)],
      requestedPermissions: undefined,
    });
    expect(JSON.stringify(result)).not.toContain("C:/Users/private");
    expect(result.selectedThread).not.toHaveProperty("cwd");
    expect(result.threads[0]).not.toHaveProperty("cwd");
  });
});
