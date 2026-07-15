import { isAbsolute, relative, sep, win32 } from "node:path";
import type { CodexThreadSnapshot } from "../core/codex/control-types";
import type { CwdLabel, DesktopSnapshot, DesktopThreadSnapshot } from "../shared/ipc-contract";
import type { ApprovalRequest } from "../core/codex/approval-router";

function isWithin(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith(".." + sep) && path !== ".." && !isAbsolute(path));
}

function cwdLabel(projectRoot: string, e2eRoot: string, cwd: string): CwdLabel {
  if (isWithin(e2eRoot, cwd)) return "Disposable tmp/e2e";
  if (cwd === projectRoot) return "Project root";
  return "Project-relative folder";
}

function publicThread(
  thread: CodexThreadSnapshot,
  projectRoot: string,
  e2eRoot: string,
): DesktopThreadSnapshot {
  const { cwd, ...safeThread } = thread;
  return {
    ...safeThread,
    cwdLabel: cwdLabel(projectRoot, e2eRoot, cwd ?? projectRoot),
  };
}

function replaceProjectRoot(value: string | undefined, projectRoot: string): string | undefined {
  if (!value) return value;
  return value
    .split(projectRoot)
    .join("[Project root]")
    .split(projectRoot.replaceAll("\\", "/"))
    .join("[Project root]");
}

function publicPath(path: string, projectRoot: string, e2eRoot: string): string {
  if (!isAbsolute(path) && !win32.isAbsolute(path))
    return replaceProjectRoot(path, projectRoot) ?? path;
  if (isWithin(e2eRoot, path)) return "Disposable tmp/e2e";
  if (isWithin(projectRoot, path)) return relative(projectRoot, path) || ".";
  return "Outside project";
}

function publicApproval(
  request: ApprovalRequest,
  projectRoot: string,
  e2eRoot: string,
): ApprovalRequest {
  return {
    ...request,
    cwd: request.cwd ? cwdLabel(projectRoot, e2eRoot, request.cwd) : undefined,
    command: replaceProjectRoot(request.command, projectRoot),
    reason: replaceProjectRoot(request.reason, projectRoot),
    paths: request.paths?.map((path) => publicPath(path, projectRoot, e2eRoot)),
    requestedPermissions: undefined,
  };
}

export type SnapshotAssemblyInput = Omit<
  DesktopSnapshot,
  "currentCwdLabel" | "selectedThread" | "threads"
> & {
  projectRoot: string;
  e2eRoot: string;
  currentCwd: string;
  selectedThread?: CodexThreadSnapshot;
  threads: CodexThreadSnapshot[];
};

export class SnapshotAssembler {
  build(input: SnapshotAssemblyInput): DesktopSnapshot {
    const { projectRoot, e2eRoot, currentCwd, selectedThread, threads, approvals, ...snapshot } =
      input;
    return {
      ...snapshot,
      approvals: approvals.map((request) => publicApproval(request, projectRoot, e2eRoot)),
      currentCwdLabel: cwdLabel(projectRoot, e2eRoot, currentCwd),
      selectedThread: selectedThread
        ? publicThread(selectedThread, projectRoot, e2eRoot)
        : undefined,
      threads: threads.map((thread) => publicThread(thread, projectRoot, e2eRoot)),
    };
  }
}
