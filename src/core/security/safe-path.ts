import { existsSync, lstatSync, mkdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { DeveloperCwdSelection } from "../codex/control-types";

interface DirectoryStat {
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
}

export interface SafePathOperations {
  existsSync(path: string): boolean;
  lstatSync(path: string): DirectoryStat;
  mkdirSync(path: string, options: { recursive: true }): string | undefined;
  realpath(path: string): string;
}

function defaultOperations(): SafePathOperations {
  return {
    existsSync,
    lstatSync,
    mkdirSync,
    realpath: realpathSync.native,
  };
}

function isWithin(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith(".." + sep) && path !== ".." && !isAbsolute(path));
}

function invalidFolder(): Error {
  return new Error("Selected folder is invalid");
}

function disallowedFolder(): Error {
  return new Error("Selected folder is not allowed");
}

function e2eOnly(): Error {
  return new Error("Verification must use the disposable folder");
}

export class SafePathResolver {
  readonly #operations: SafePathOperations;
  readonly #projectRoot: string;
  readonly #e2eRoot: string;

  constructor(projectRoot: string, operations: SafePathOperations = defaultOperations()) {
    this.#operations = operations;
    if (!projectRoot || projectRoot.includes("\0") || !isAbsolute(projectRoot))
      throw invalidFolder();
    const candidate = resolve(projectRoot);
    if (!this.#operations.existsSync(candidate)) throw invalidFolder();
    this.#assertSafeDirectory(candidate, candidate);
    const canonicalRoot = this.#canonical(candidate);
    this.#assertNotSensitiveRoot(canonicalRoot);
    this.#projectRoot = canonicalRoot;
    this.#e2eRoot = resolve(canonicalRoot, "tmp", "e2e");
  }

  get projectRoot(): string {
    return this.#projectRoot;
  }

  resolve(selection: DeveloperCwdSelection, options: { testOnly?: boolean } = {}): string {
    if (!selection || typeof selection !== "object" || !("kind" in selection))
      throw invalidFolder();
    if (options.testOnly && selection.kind !== "e2e-root") throw e2eOnly();
    if (selection.kind === "project-root") return this.#projectRoot;
    if (selection.kind === "e2e-root") return this.#ensureE2eRoot();
    if (selection.kind !== "project-relative" || typeof selection.relativePath !== "string")
      throw invalidFolder();
    const relativePath = selection.relativePath.trim();
    if (!relativePath || relativePath.includes("\0") || isAbsolute(relativePath))
      throw invalidFolder();
    const candidate = resolve(this.#projectRoot, relativePath);
    if (!isWithin(this.#projectRoot, candidate)) throw disallowedFolder();
    return this.#ensureSafePath(this.#projectRoot, candidate);
  }

  resolveE2eChild(relativePath: string): string {
    if (!relativePath || relativePath.includes("\0") || isAbsolute(relativePath))
      throw invalidFolder();
    const e2eRoot = this.#ensureE2eRoot();
    const candidate = resolve(e2eRoot, relativePath);
    if (!isWithin(e2eRoot, candidate)) throw disallowedFolder();
    return this.#ensureSafePath(e2eRoot, candidate);
  }

  #ensureE2eRoot(): string {
    return this.#ensureSafePath(this.#projectRoot, this.#e2eRoot);
  }

  #ensureSafePath(root: string, candidate: string): string {
    if (!isWithin(root, candidate)) throw disallowedFolder();
    this.#assertExistingAncestors(root, candidate);
    try {
      this.#operations.mkdirSync(candidate, { recursive: true });
    } catch {
      throw invalidFolder();
    }
    this.#assertExistingAncestors(root, candidate);
    const canonical = this.#canonical(candidate);
    if (!isWithin(root, canonical)) throw disallowedFolder();
    return canonical;
  }

  #assertExistingAncestors(root: string, candidate: string): void {
    this.#assertSafeDirectory(root, root);
    const path = relative(root, candidate);
    if (!path) return;
    let current = root;
    for (const segment of path.split(sep)) {
      current = join(current, segment);
      if (!this.#operations.existsSync(current)) return;
      this.#assertSafeDirectory(current, root);
    }
  }

  #assertSafeDirectory(candidate: string, root: string): void {
    let stat: DirectoryStat;
    try {
      stat = this.#operations.lstatSync(candidate);
    } catch {
      throw invalidFolder();
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw disallowedFolder();
    const canonical = this.#canonical(candidate);
    if (!isWithin(root, canonical)) throw disallowedFolder();
  }

  #canonical(candidate: string): string {
    try {
      return this.#operations.realpath(candidate);
    } catch {
      throw invalidFolder();
    }
  }

  #assertNotSensitiveRoot(candidate: string): void {
    const forbidden = [homedir(), process.env.SystemRoot, process.env.windir].filter(
      (path): path is string => Boolean(path && this.#operations.existsSync(path)),
    );
    for (const path of forbidden) {
      if (candidate === this.#canonical(path)) throw disallowedFolder();
    }
  }
}
