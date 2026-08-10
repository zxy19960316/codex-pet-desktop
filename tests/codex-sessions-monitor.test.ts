import { appendFile, mkdir, mkdtemp, writeFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CodexSessionMonitor,
  MAX_MONITORED_SESSION_FILES,
  recentSessionFiles,
  sessionIdFromPath,
} from "../src/main/codex-session-monitor";

describe("Codex sessions monitor", () => {
  it("selects only the most recent bounded JSONL files from today and yesterday", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-sessions-"));
    const now = new Date(2026, 6, 22, 12);
    for (const [offset, date] of [
      [0, now],
      [1, new Date(2026, 6, 21, 12)],
    ] as const) {
      const directory = join(
        root,
        String(date.getFullYear()),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      );
      await mkdir(directory, { recursive: true });
      for (let index = 0; index < MAX_MONITORED_SESSION_FILES; index++) {
        const path = join(directory, `${offset}-${index}.jsonl`);
        await writeFile(path, "{}\n");
        await utimes(path, new Date(1_000), new Date(10_000 + offset * 100 + index));
      }
    }
    const files = await recentSessionFiles(root, now);
    expect(files).toHaveLength(MAX_MONITORED_SESSION_FILES);
    expect(files[0]!.modifiedAt).toBeGreaterThan(files.at(-1)!.modifiedAt);
  });

  it("derives only a trailing rollout UUID as the fallback session id", () => {
    expect(
      sessionIdFromPath(
        "D:/sessions/rollout-2026-08-09T12-00-00-019fe575-8843-7192-972f-f8adb995a1d4.jsonl",
      ),
    ).toBe("019fe575-8843-7192-972f-f8adb995a1d4");
    expect(sessionIdFromPath("D:/sessions/private-project.jsonl")).toBeUndefined();
  });

  it("publishes appended lifecycle observations without retaining private content", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-session-monitor-"));
    const now = new Date();
    const directory = join(
      root,
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    );
    await mkdir(directory, { recursive: true });
    const path = join(
      directory,
      "rollout-2026-08-09T12-00-00-019fe575-8843-7192-972f-f8adb995a1d4.jsonl",
    );
    await writeFile(
      path,
      `${JSON.stringify({
        type: "event_msg",
        timestamp: new Date(now.getTime() - 1_000).toISOString(),
        payload: { type: "task_started", turn_id: "turn-monitor", message: "PRIVATE" },
      })}\n`,
    );
    const batches: unknown[][] = [];
    const monitor = new CodexSessionMonitor({
      sessionsRoot: root,
      onTelemetry: () => undefined,
      onObservations: (observations) => batches.push([...observations]),
    });
    monitor.start(10);
    try {
      await vi.waitFor(() => expect(batches.flat()).toHaveLength(2));
      await appendFile(
        path,
        `${JSON.stringify({
          type: "event_msg",
          timestamp: now.toISOString(),
          payload: { type: "task_complete", turn_id: "turn-monitor", message: "PRIVATE" },
        })}\n`,
      );
      await vi.waitFor(() => expect(batches.flat()).toHaveLength(3));
    } finally {
      monitor.stop();
    }
    expect(JSON.stringify(batches)).not.toContain("PRIVATE");
    expect(batches.flat().at(-1)).toMatchObject({
      sessionId: "019fe575-8843-7192-972f-f8adb995a1d4",
      event: "turn_completed",
      state: "success",
    });
  });
});
