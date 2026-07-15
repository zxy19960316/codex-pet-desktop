import { isObject, stringField } from "./protocol-guards";

export type ApprovalKind = "command" | "file_change" | "permissions" | "unknown";
export type ApprovalDecision = "accept" | "acceptForSession" | "decline" | "cancel";

export interface ApprovalRequest {
  requestId: string;
  threadId: string;
  turnId?: string;
  itemId?: string;
  kind: ApprovalKind;
  title: string;
  reason?: string;
  command?: string;
  cwd?: string;
  paths?: string[];
  networkTargets?: string[];
  requestedPermissions?: unknown;
  availableDecisions: ApprovalDecision[];
  receivedAt: number;
  autoResolutionMs?: number | null;
}

export function buildApprovalResponse(
  decision: ApprovalDecision,
  request: ApprovalRequest,
): unknown {
  if (request.kind !== "permissions") return { decision };
  const requested = isObject(request.requestedPermissions) ? request.requestedPermissions : {};
  const permissions: Record<string, unknown> = {};
  if (decision === "accept" || decision === "acceptForSession") {
    if (isObject(requested.network)) permissions.network = requested.network;
    if (isObject(requested.fileSystem)) permissions.fileSystem = requested.fileSystem;
  }
  return {
    permissions,
    scope: decision === "acceptForSession" ? "session" : "turn",
  };
}

interface ApprovalRouterOptions {
  respond?: (
    requestId: string,
    decision: ApprovalDecision,
    request: ApprovalRequest,
  ) => Promise<void>;
  onChange?: (queue: ApprovalRequest[]) => void;
}

const METHOD_KIND: Record<string, ApprovalKind> = {
  "item/commandExecution/requestApproval": "command",
  "item/fileChange/requestApproval": "file_change",
  "item/permissions/requestApproval": "permissions",
};

function strings(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
}

function decisions(value: unknown): ApprovalDecision[] {
  const allowed = new Set<ApprovalDecision>(["accept", "acceptForSession", "decline", "cancel"]);
  return (strings(value) ?? []).filter((item): item is ApprovalDecision =>
    allowed.has(item as ApprovalDecision),
  );
}

function permissionTargets(params: Record<string, unknown>): {
  paths?: string[];
  networkTargets?: string[];
} {
  const permissions = isObject(params.permissions)
    ? params.permissions
    : isObject(params.additionalPermissions)
      ? params.additionalPermissions
      : {};
  const fileSystem = isObject(permissions.fileSystem) ? permissions.fileSystem : {};
  const network = isObject(permissions.network) ? permissions.network : {};
  const paths = [
    ...(strings(fileSystem.read) ?? strings(fileSystem.readOnly) ?? []),
    ...(strings(fileSystem.write) ?? strings(fileSystem.readWrite) ?? []),
  ];
  const context = isObject(params.networkApprovalContext) ? params.networkApprovalContext : {};
  const explicit =
    typeof context.host === "string"
      ? [`${typeof context.protocol === "string" ? `${context.protocol}://` : ""}${context.host}`]
      : [];
  const networkTargets = [
    ...explicit,
    ...(strings(network.hosts) ?? strings(network.domains) ?? []),
  ];
  return {
    paths: paths.length ? [...new Set(paths)] : undefined,
    networkTargets: networkTargets.length ? [...new Set(networkTargets)] : undefined,
  };
}

export class ApprovalRouter {
  readonly #queue: ApprovalRequest[] = [];
  readonly #timers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly #respond?: ApprovalRouterOptions["respond"];
  readonly #onChange?: ApprovalRouterOptions["onChange"];

  constructor(options: ApprovalRouterOptions = {}) {
    this.#respond = options.respond;
    this.#onChange = options.onChange;
  }

  enqueue(requestId: string | number, method: string, rawParams: unknown): ApprovalRequest {
    const params = isObject(rawParams) ? rawParams : {};
    const kind = METHOD_KIND[method] ?? "unknown";
    const offered = decisions(params.availableDecisions);
    const defaults: ApprovalDecision[] = ["accept", "decline", "cancel"];
    const targets = permissionTargets(params);
    const request: ApprovalRequest = {
      requestId: String(requestId),
      threadId: stringField(params, ["threadId"]) ?? "unknown",
      turnId: stringField(params, ["turnId"]),
      itemId: stringField(params, ["itemId"]),
      kind,
      title:
        kind === "command"
          ? "Command approval"
          : kind === "file_change"
            ? "File change approval"
            : kind === "permissions"
              ? "Permission approval"
              : "Approval required",
      reason: stringField(params, ["reason"]),
      command: stringField(params, ["command"]),
      cwd: stringField(params, ["cwd"]),
      paths:
        strings(params.paths) ??
        (typeof params.grantRoot === "string" ? [params.grantRoot] : targets.paths),
      networkTargets: strings(params.networkTargets) ?? targets.networkTargets,
      requestedPermissions: params.permissions,
      availableDecisions: offered.length ? offered : defaults,
      receivedAt: Date.now(),
      autoResolutionMs:
        typeof params.autoResolutionMs === "number" ? params.autoResolutionMs : null,
    };
    this.#queue.push(request);
    if (request.autoResolutionMs && request.autoResolutionMs > 0) {
      this.#timers.set(
        request.requestId,
        setTimeout(() => this.resolve(request.requestId), request.autoResolutionMs),
      );
    }
    this.#emit();
    return { ...request };
  }

  resolve(requestId: string | number): void {
    const id = String(requestId);
    const index = this.#queue.findIndex((request) => request.requestId === id);
    if (index >= 0) this.#queue.splice(index, 1);
    const timer = this.#timers.get(id);
    if (timer) clearTimeout(timer);
    this.#timers.delete(id);
    this.#emit();
  }

  async respond(requestId: string, decision: ApprovalDecision): Promise<void> {
    const request = this.#queue.find((candidate) => candidate.requestId === requestId);
    if (!request) throw new Error("Approval request not found");
    if (!request.availableDecisions.includes(decision))
      throw new Error("Decision was not offered by the server");
    await this.#respond?.(requestId, decision, request);
    this.resolve(requestId);
  }

  getQueue(): ApprovalRequest[] {
    return this.#queue.map((request) => ({
      ...request,
      availableDecisions: [...request.availableDecisions],
    }));
  }

  dispose(): void {
    for (const timer of this.#timers.values()) clearTimeout(timer);
    this.#timers.clear();
    this.#queue.length = 0;
  }

  #emit(): void {
    this.#onChange?.(this.getQueue());
  }
}
