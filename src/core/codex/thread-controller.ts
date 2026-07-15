import { SafePathResolver } from "../security/safe-path";
import type {
  CodexRpcClient,
  CodexThreadSnapshot,
  CreateThreadRequest,
  DeveloperCwdSelection,
} from "./control-types";

interface ThreadLike {
  id?: unknown;
  cwd?: unknown;
  name?: unknown;
  preview?: unknown;
  status?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

interface ThreadStartLike {
  thread?: ThreadLike;
  approvalPolicy?: unknown;
  approvalsReviewer?: unknown;
  sandbox?: unknown;
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
  readonly #safePaths: SafePathResolver;
  readonly #threads = new Map<string, CodexThreadSnapshot>();
  #selectedThreadId?: string;
  #lastActiveThreadId?: string;

  constructor(projectRoot: string) {
    this.#safePaths = new SafePathResolver(projectRoot);
    this.#projectRoot = this.#safePaths.projectRoot;
  }

  get selectedThreadId(): string | undefined {
    return this.#selectedThreadId;
  }

  get projectRoot(): string {
    return this.#projectRoot;
  }

  get e2eRoot(): string {
    return this.#safePaths.resolve({ kind: "e2e-root" });
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

  validateCwd(selection: DeveloperCwdSelection): string {
    return this.#safePaths.resolve(selection);
  }

  async create(request: CreateThreadRequest, client: CodexRpcClient): Promise<CodexThreadSnapshot> {
    return this.#create(this.validateCwd(request.cwd), client);
  }

  async createE2eThread(
    directoryName: string,
    client: CodexRpcClient,
  ): Promise<CodexThreadSnapshot> {
    return this.#create(this.#safePaths.resolveE2eChild(directoryName), client);
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

  clearTransient(): void {
    for (const thread of this.#threads.values()) {
      if (thread.status === "running" || thread.status === "waiting") thread.status = "idle";
      thread.activeTurnId = undefined;
      thread.updatedAt = Date.now();
    }
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

  async #create(cwd: string, client: CodexRpcClient): Promise<CodexThreadSnapshot> {
    const result = await client.sendRequest<ThreadStartLike>("thread/start", {
      cwd,
      ephemeral: true,
      approvalPolicy: "untrusted",
      approvalsReviewer: "user",
      sandbox: "workspace-write",
    });
    if (result.approvalPolicy !== undefined && result.approvalPolicy !== "untrusted")
      throw new Error("App Server did not apply the required approval policy");
    if (result.approvalsReviewer !== undefined && result.approvalsReviewer !== "user")
      throw new Error("App Server did not route approvals to the human reviewer");
    const sandboxType = asObject(result.sandbox)?.type;
    if (sandboxType !== undefined && sandboxType !== "workspaceWrite")
      throw new Error("App Server did not apply the required workspace sandbox");
    if (!result.thread || typeof result.thread.id !== "string")
      throw new Error("App Server did not return a thread ID");
    return this.#upsert(result.thread, "created-by-pet", cwd);
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
