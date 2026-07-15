import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeE2EResult } from "../src/main/e2e-result-writer";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("writeE2EResult", () => {
  it("writes only the redacted guided-verification summary", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codex-pet-e2e-result-"));
    temporaryDirectories.push(directory);
    const resultPath = join(directory, "nested", "latest.json");

    writeE2EResult(resultPath, {
      connectionStatus: "connected",
      protocolSource: "codex-app-server",
      e2eSteps: [{ kind: "approval-allow", state: "passed", recordId: "e2e-1" }],
      e2eRecords: [
        {
          id: "e2e-1",
          kind: "approval-allow",
          threadIdHash: "0123456789ab",
          startedAt: 1,
          completedAt: 2,
          result: "passed",
          protocolEvidence: ["serverRequest/resolved", "turn/completed"],
        },
      ],
    });

    const raw = readFileSync(resultPath, "utf8");
    const result = JSON.parse(raw) as Record<string, unknown>;
    expect(result).toMatchObject({
      schemaVersion: 1,
      connectionStatus: "connected",
      protocolSource: "codex-app-server",
    });
    expect(raw).not.toContain("connectionDetail");
    expect(raw).not.toContain("settings");
    expect(raw).not.toContain("cwd");
    expect(raw).not.toContain("answers");
  });
});
