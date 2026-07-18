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

  it("keeps Windows installer artifacts manual, unsigned, and non-publishing", async () => {
    const workflow = await readFile(
      join(process.cwd(), ".github", "workflows", "windows-installer.yml"),
      "utf8",
    );
    expect(workflow).toMatch(/on:\s*\r?\n\s+workflow_dispatch:/);
    expect(workflow).not.toMatch(/\r?\n\s+(push|pull_request|schedule):/);
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).toContain("actions/checkout@v7");
    expect(workflow).toContain("actions/setup-node@v6");
    expect(workflow).toContain("node-version: 24");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm run verify:m3-3");
    expect(workflow).toContain("actions/upload-artifact@v4");
    expect(workflow).toContain('CSC_IDENTITY_AUTO_DISCOVERY: "false"');
    expect(workflow).not.toContain("WIN_CSC_LINK");
    expect(workflow).not.toContain("WIN_CSC_KEY_PASSWORD");
    expect(workflow).not.toContain("gh release");
  });
});
