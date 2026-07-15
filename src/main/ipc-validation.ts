import { isAbsolute, win32 } from "node:path";
import type { DeveloperCwdSelection, E2EVerificationKind } from "../core/codex/control-types";

const VERIFICATION_KINDS = new Set<E2EVerificationKind>([
  "approval-allow",
  "approval-deny",
  "user-input",
  "steer",
  "interrupt",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseDeveloperCwdSelection(value: unknown): DeveloperCwdSelection {
  if (!isRecord(value)) throw new Error("Invalid developer cwd selection");
  if (value.kind === "project-root" || value.kind === "e2e-root") return { kind: value.kind };
  if (value.kind !== "project-relative" || typeof value.relativePath !== "string")
    throw new Error("Invalid developer cwd selection");
  const relativePath = value.relativePath.trim();
  if (
    !relativePath ||
    relativePath.includes("\0") ||
    isAbsolute(relativePath) ||
    win32.isAbsolute(relativePath)
  )
    throw new Error("Invalid project-relative cwd");
  return { kind: "project-relative", relativePath };
}

export function parseVerificationKind(value: unknown): E2EVerificationKind {
  if (!VERIFICATION_KINDS.has(value as E2EVerificationKind))
    throw new Error("Invalid verification kind");
  return value as E2EVerificationKind;
}
