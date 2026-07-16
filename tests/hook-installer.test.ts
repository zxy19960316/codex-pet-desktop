import { describe, expect, it } from "vitest";
import { mergeCodexPetHooks } from "../src/main/hook-installer";

describe("Codex hook installer", () => {
  it("preserves existing hooks and installs each pet hook once", () => {
    const existing = {
      hooks: { Stop: [{ hooks: [{ type: "command", command: "existing-command" }] }] },
    };
    const installed = mergeCodexPetHooks(existing, "C:\\pet\\hook.cjs", "C:\\pet\\events.jsonl");
    const repeated = mergeCodexPetHooks(installed, "C:\\pet\\hook.cjs", "C:\\pet\\events.jsonl");
    expect(repeated.hooks.SessionStart).toHaveLength(1);
    expect(repeated.hooks.Stop).toHaveLength(2);
    expect(JSON.stringify(repeated)).toContain("existing-command");
  });
});
