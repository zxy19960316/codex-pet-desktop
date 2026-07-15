import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreadController } from "../src/core/codex/thread-controller";

const temporaryPaths: string[] = [];

function projectDirectory(): string {
  const path = mkdtempSync(join(tmpdir(), "codex-pet-thread-"));
  temporaryPaths.push(path);
  return path;
}

afterEach(() => {
  for (const path of temporaryPaths.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("ThreadController", () => {
  it("creates an ephemeral, approval-gated thread from an opaque cwd selection", async () => {
    const projectRoot = projectDirectory();
    const client = {
      sendRequest: vi.fn().mockResolvedValue({ thread: { id: "t1", cwd: projectRoot } }),
    };
    const controller = new ThreadController(projectRoot);
    const canonicalRoot = realpathSync.native(projectRoot);
    await expect(
      controller.create({ cwd: { kind: "project-root" } }, client),
    ).resolves.toMatchObject({
      threadId: "t1",
      source: "created-by-pet",
      cwd: projectRoot,
    });
    expect(client.sendRequest).toHaveBeenCalledWith(
      "thread/start",
      expect.objectContaining({
        cwd: canonicalRoot,
        ephemeral: true,
        approvalPolicy: "untrusted",
        approvalsReviewer: "user",
        sandbox: "workspace-write",
      }),
    );
  });

  it("rejects traversal and absolute cwd selections while forcing test threads into tmp/e2e", async () => {
    const projectRoot = projectDirectory();
    const client = {
      sendRequest: vi.fn().mockResolvedValue({ thread: { id: "test", cwd: projectRoot } }),
    };
    const controller = new ThreadController(projectRoot);
    const canonicalRoot = realpathSync.native(projectRoot);
    expect(() => controller.validateCwd({ kind: "project-relative", relativePath: ".." })).toThrow(
      "not allowed",
    );
    expect(() =>
      controller.validateCwd({
        kind: "project-relative",
        relativePath: resolve(projectRoot, ".."),
      }),
    ).toThrow("invalid");

    await controller.createE2eThread("approval-allow-run", client);
    expect(client.sendRequest).toHaveBeenCalledWith(
      "thread/start",
      expect.objectContaining({
        cwd: join(canonicalRoot, "tmp", "e2e", "approval-allow-run"),
      }),
    );
  });

  it("uses selected then recent thread cwd and removes closed thread metadata", async () => {
    const projectRoot = projectDirectory();
    const e2eRoot = join(projectRoot, "tmp", "e2e");
    const client = {
      sendRequest: vi
        .fn()
        .mockResolvedValueOnce({ thread: { id: "one", cwd: projectRoot } })
        .mockResolvedValueOnce({ thread: { id: "two", cwd: e2eRoot } }),
    };
    const controller = new ThreadController(projectRoot);
    await controller.create({ cwd: { kind: "project-root" } }, client);
    await controller.create({ cwd: { kind: "e2e-root" } }, client);
    expect(controller.currentCwd).toBe(e2eRoot);
    controller.select("one");
    expect(controller.currentCwd).toBe(projectRoot);
    controller.observe("thread/closed", { threadId: "one" });
    expect(controller.selected()).toBeUndefined();
    expect(controller.currentCwd).toBe(e2eRoot);
  });

  it("rejects a thread when the server reports weaker effective permissions", async () => {
    const projectRoot = projectDirectory();
    const controller = new ThreadController(projectRoot);
    const client = {
      sendRequest: vi.fn().mockResolvedValue({
        thread: { id: "unsafe", cwd: projectRoot },
        approvalPolicy: "never",
        approvalsReviewer: "user",
        sandbox: { type: "dangerFullAccess" },
      }),
    };

    await expect(controller.createE2eThread("unsafe", client)).rejects.toThrow(
      "required approval policy",
    );
  });

  it("adds a fixed escalation instruction only to approval verification threads", async () => {
    const projectRoot = projectDirectory();
    const client = {
      sendRequest: vi.fn().mockResolvedValue({ thread: { id: "approval", cwd: projectRoot } }),
    };
    const controller = new ThreadController(projectRoot);

    await controller.createE2eThread("approval", client, { forceHumanApproval: true });
    expect(client.sendRequest).toHaveBeenCalledWith(
      "thread/start",
      expect.objectContaining({
        developerInstructions: expect.stringContaining("sandbox_permissions to require_escalated"),
      }),
    );
  });
});
