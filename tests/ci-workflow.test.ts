import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("CI workflow", () => {
  it("pins the repository-approved action majors and Node runtime", async () => {
    const workflow = await readFile(join(process.cwd(), ".github", "workflows", "ci.yml"), "utf8");
    expect(workflow).toContain("actions/checkout@v7");
    expect(workflow).toContain("actions/setup-node@v6");
    expect(workflow).toContain("node-version: 24");
    expect(workflow).not.toContain("actions/setup-node@v7");
  });
});
