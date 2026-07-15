import { isAbsolute, relative, resolve, sep } from "node:path";
import { mkdirSync } from "node:fs";
import type { CodexRpcClient, CodexThreadSnapshot, CreateThreadRequest } from "./control-types";

interface ThreadLike {
  id?: unknown;
  cwd?: unknown;
  name?: unknown;
  preview?: unknown;
  status?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function shortTitle(thread: ThreadLike): string | undefined {
  const candidate = typeof thread.name === "string" ? thread.name : thread.preview;
  return typeof candidate === "string" && candidate.trim() ? candidate.slice(0, 80) : undefined;
}

function statusFromServer(status: unknown): CodexThreadSnapshot["status"] {
  const type = typeof asObject(status)?.type === "string" ? asObject(status)?.type : undefined;
  if (type === "active") return "running";
  if (type === "systemError") return "error";
  return "idle";
}

export class ThreadController {
  readonly #projectRoot: string;
  readonly #e2eRoot: string;
  readonly #threads = new Map<string, CodexThreadSnapshot>();
  #selectedThreadId?: string;
  #lastActiveThreadId?: string;

  constructor(projectRoot: string) {
    this.#projectRoot = resolve(projectRoot);
    this.#e2eRoot = resolve(this.#projectRoot, "tmp", "e2e");
  }

  get selectedThreadId(): string | undefined {
    return this.#selectedThreadId;
  }

  get currentCwd(): string {
    return (
      this.#threadFor(this.#selectedThreadId)?.cwd ??
      this.#threadFor(this.#lastActiveThreadId)?.cwd ??
      this.#projectRoot
    );
  }

  snapshot(): CodexThreadSnapshot[] {
    return [...this.#threads.values()]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map((thread) => ({ ...thread }));
  }

  selected(): CodexThreadSnapshot | undefined {
    const thread = this.#threadFor(this.#selectedThreadId);
    return thread && { ...thread };
  }

  get(threadId: string): CodexThreadSnapshot | undefined {
    const thread = this.#threadFor(threadId);
    return thread && { ...thread };
  }

  validateCwd(candidate: string): string {
    if (!candidate || candidate.includes("\0") || !isAbsolute(candidate))
      throw new Error("A non-empty absolute cwd is required");
    const cwd = resolve(candidate);
    const permitted = [this.#projectRoot, this.#e2eRoot].some((root) => {
      const path = relative(root, cwd);
      return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
    });
    if (!permitted) throw new Error("Developer controls only allow the project or tmp/e2e cwd");
    return cwd;
  }

  async create(request: CreateThreadRequest, client: CodexRpcClient): Promise<CodexThreadSnapshot> {
    const cwd = this.validateCwd(request.cwd);
    if (cwd === this.#e2eRoot || cwd.startsWith(`${this.#e2eRoot}${sep}`))
      mkdirSync(cwd, { recursive: true });
    const result = await client.sendRequest<{ thread?: ThreadLike }>("thread/start", {
      cwd,
      ephemeral: true,
      approvalPolicy: "untrusted",
      approvalsReviewer: "user",
      sandbox: "workspace-write",
    });
    if (!result.thread || typeof result.thread.id !== "string")
      throw new Error("App Server did not return a thread ID");
    return this.#upsert(result.thread, "created-by-pet", cwd);
  }

  select(threadId: string): void {
    if (!this.#threads.has(threadId)) throw new Error("Unknown Codex thread");
    this.#selectedThreadId = threadId;
  }

  markTurnStarted(threadId: string, turnId: string): void {
    const thread = this.#require(threadId);
    thread.activeTurnId = turnId;
    thread.status = "running";
    thread.updatedAt = Date.now();
    this.#lastActiveThreadId = threadId;
  }

  touch(threadId: string): void {
    if (this.#threads.has(threadId)) return;
    const now = Date.now();
    this.#threads.set(threadId, {
      threadId,
      status: "idle",
      createdAt: now,
      updatedAt: now,
      source: "observed",
    });
    this.#lastActiveThreadId = threadId;
  }

  markTurnCompleted(threadId: string, turnId?: string): void {
    const thread = this.#threadFor(threadId);
    if (!thread) return;
    if (!turnId || thread.activeTurnId === turnId) thread.activeTurnId = undefined;
    thread.status = "completed";
    thread.updatedAt = Date.now();
  }

  markWaiting(threadId: string): void {
    const thread = this.#threadFor(threadId);
    if (!thread) return;
    thread.status = "waiting";
    thread.updatedAt = Date.now();
  }

  markError(threadId: string): void {
    const thread = this.#threadFor(threadId);
    if (!thread) return;
    thread.status = "error";
    thread.updatedAt = Date.now();
  }

  remove(threadId: string): void {
    this.#threads.delete(threadId);
    if (this.#selectedThreadId === threadId) this.#selectedThreadId = undefined;
    if (this.#lastActiveThreadId === threadId) this.#lastActiveThreadId = undefined;
  }

  observe(method: string, params: unknown): void {
    if (method === "thread/closed" || method === "thread/deleted") {
      const candidate = asObject(params)?.threadId;
      const threadId = typeof candidate === "string" ? candidate : undefined;
      if (threadId) this.remove(threadId);
      return;
    }
    const source = asObject(params);
    const candidate = asObject(source?.thread) ?? source;
    if (!candidate || typeof candidate.id !== "string") return;
    this.#upsert(candidate, "observed");
  }

  #upsert(
    thread: ThreadLike,
    source: CodexThreadSnapshot["source"],
    fallbackCwd?: string,
  ): CodexThreadSnapshot {
    const threadId = thread.id as string;
    const existing = this.#threads.get(threadId);
    const now = Date.now();
    const snapshot: CodexThreadSnapshot = {
      threadId,
      cwd: typeof thread.cwd === "string" ? thread.cwd : (existing?.cwd ?? fallbackCwd),
      title: shortTitle(thread) ?? existing?.title,
      status: statusFromServer(thread.status),
      activeTurnId: existing?.activeTurnId,
      createdAt:
        typeof thread.createdAt === "number"
          ? thread.createdAt * 1_000
          : (existing?.createdAt ?? now),
      updatedAt: typeof thread.updatedAt === "number" ? thread.updatedAt * 1_000 : now,
      source: existing?.source ?? source,
    };
    this.#threads.set(threadId, snapshot);
    this.#lastActiveThreadId = threadId;
    return { ...snapshot };
  }

  #threadFor(threadId?: string): CodexThreadSnapshot | undefined {
    return threadId ? this.#threads.get(threadId) : undefined;
  }

  #require(threadId: string): CodexThreadSnapshot {
    const thread = this.#threads.get(threadId);
    if (!thread) throw new Error("Unknown Codex thread");
    return thread;
  }
}
