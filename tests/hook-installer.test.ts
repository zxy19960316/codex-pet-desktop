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

  it("replaces stale pet receiver paths without removing unrelated hooks", () => {
    const existing = mergeCodexPetHooks(
      { hooks: { Stop: [{ hooks: [{ type: "command", command: "keep-me" }] }] } },
      "C:\\old-app\\app.asar\\dist\\hook\\codex-pet-hook.cjs",
      "C:\\pet\\events.jsonl",
    );

    const upgraded = mergeCodexPetHooks(
      existing,
      "C:\\new-app\\resources\\codex-pet-hook.cjs",
      "C:\\pet\\events.jsonl",
    );
    const serialized = JSON.stringify(upgraded);

    expect(serialized).not.toContain("old-app");
    expect(serialized).toContain("new-app");
    expect(serialized).toContain("keep-me");
    expect(upgraded.hooks.SessionStart).toHaveLength(1);
  });
});
