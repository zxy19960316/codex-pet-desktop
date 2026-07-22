import { mkdir, mkdtemp, writeFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_MONITORED_SESSION_FILES, recentSessionFiles } from "../src/main/codex-session-monitor";

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
});
