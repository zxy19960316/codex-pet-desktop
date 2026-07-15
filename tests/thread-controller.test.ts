import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ThreadController } from "../src/core/codex/thread-controller";

const projectRoot = resolve("C:/work/codex-pet");

describe("ThreadController", () => {
  it("creates an ephemeral, approval-gated thread in a permitted cwd", async () => {
    const client = {
      sendRequest: vi.fn().mockResolvedValue({ thread: { id: "t1", cwd: projectRoot } }),
    };
    const controller = new ThreadController(projectRoot);
    await expect(controller.create({ cwd: projectRoot }, client)).resolves.toMatchObject({
      threadId: "t1",
      source: "created-by-pet",
      cwd: projectRoot,
    });
    expect(client.sendRequest).toHaveBeenCalledWith(
      "thread/start",
      expect.objectContaining({
        cwd: projectRoot,
        ephemeral: true,
        approvalPolicy: "untrusted",
        approvalsReviewer: "user",
        sandbox: "workspace-write",
      }),
    );
  });

  it("rejects home-like, relative, and path-traversal cwd values", () => {
    const controller = new ThreadController(projectRoot);
    expect(() => controller.validateCwd("relative")).toThrow("absolute cwd");
    expect(() => controller.validateCwd("C:/Users/example")).toThrow("only allow");
    expect(() => controller.validateCwd(`${projectRoot}/../outside`)).toThrow("only allow");
    expect(() => controller.validateCwd(`${projectRoot}/tmp/e2e/run`)).not.toThrow();
  });

  it("uses selected then recent thread cwd and removes closed thread metadata", async () => {
    const client = {
      sendRequest: vi
        .fn()
        .mockResolvedValueOnce({ thread: { id: "one", cwd: projectRoot } })
        .mockResolvedValueOnce({ thread: { id: "two", cwd: `${projectRoot}/tmp/e2e` } }),
    };
    const controller = new ThreadController(projectRoot);
    await controller.create({ cwd: projectRoot }, client);
    await controller.create({ cwd: `${projectRoot}/tmp/e2e` }, client);
    expect(controller.currentCwd).toBe(`${projectRoot}/tmp/e2e`);
    controller.select("one");
    expect(controller.currentCwd).toBe(projectRoot);
    controller.observe("thread/closed", { threadId: "one" });
    expect(controller.selected()).toBeUndefined();
    expect(controller.currentCwd).toBe(`${projectRoot}/tmp/e2e`);
  });
});
