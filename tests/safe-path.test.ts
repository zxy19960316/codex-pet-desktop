import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { SafePathResolver } from "../src/core/security/safe-path";

const temporaryPaths: string[] = [];

function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  temporaryPaths.push(directory);
  return directory;
}

afterEach(() => {
  for (const path of temporaryPaths.splice(0)) rmSync(path, { force: true, recursive: true });
});

describe("SafePathResolver", () => {
  it("rejects traversal, NUL, and renderer-provided absolute paths without leaking a path", () => {
    const projectRoot = temporaryDirectory("codex-pet-safe-path-");
    const resolver = new SafePathResolver(projectRoot);
    const attempts = [
      () => resolver.resolve({ kind: "project-relative", relativePath: ".." }),
      () => resolver.resolve({ kind: "project-relative", relativePath: "folder\0name" }),
      () =>
        resolver.resolve({ kind: "project-relative", relativePath: resolve(projectRoot, "..") }),
    ];

    for (const attempt of attempts) {
      expect(attempt).toThrow(/Selected folder (is invalid|is not allowed)/);
      expect(() => attempt()).not.toThrow(projectRoot);
    }
  });

  it("creates a missing safe child and forces test mode into tmp/e2e", () => {
    const projectRoot = temporaryDirectory("codex-pet-safe-path-");
    const resolver = new SafePathResolver(projectRoot);

    expect(resolver.resolve({ kind: "project-relative", relativePath: "examples/demo" })).toBe(
      join(projectRoot, "examples", "demo"),
    );
    expect(resolver.resolve({ kind: "e2e-root" })).toBe(join(projectRoot, "tmp", "e2e"));
    expect(() => resolver.resolve({ kind: "project-root" }, { testOnly: true })).toThrow(
      "Verification must use the disposable folder",
    );
    expect(resolver.resolve({ kind: "e2e-root" }, { testOnly: true })).toBe(
      join(projectRoot, "tmp", "e2e"),
    );
  });

  it("rejects an in-root symlink or junction that points outside the project", () => {
    const projectRoot = temporaryDirectory("codex-pet-safe-path-");
    const outside = temporaryDirectory("codex-pet-outside-");
    const link = join(projectRoot, "escape");
    mkdirSync(outside, { recursive: true });
    symlinkSync(outside, link, process.platform === "win32" ? "junction" : "dir");

    const resolver = new SafePathResolver(projectRoot);
    expect(() =>
      resolver.resolve({ kind: "project-relative", relativePath: "escape/child" }),
    ).toThrow("Selected folder is not allowed");
  });

  it("canonicalizes a trusted project beneath an aliased temporary-directory ancestor", () => {
    const realParent = temporaryDirectory("codex-pet-real-parent-");
    const aliasParent = temporaryDirectory("codex-pet-alias-parent-");
    const alias = join(aliasParent, "trusted-alias");
    const projectRoot = join(realParent, "project");
    mkdirSync(projectRoot);
    symlinkSync(realParent, alias, process.platform === "win32" ? "junction" : "dir");

    const resolver = new SafePathResolver(join(alias, "project"));
    expect(resolver.projectRoot).toBe(projectRoot);
    expect(resolver.resolve({ kind: "project-relative", relativePath: "safe-child" })).toBe(
      join(projectRoot, "safe-child"),
    );
  });
});
