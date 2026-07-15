import { createHash } from "node:crypto";
import type { InputRouter } from "../input/input-router";
import type { UserInputRequest } from "../input/input-types";
import {
  buildApprovalResponse,
  type ApprovalDecision,
  type ApprovalRequest,
  type ApprovalRouter,
} from "./approval-router";
import type { JsonRpcClient } from "./json-rpc-client";

const APPROVAL_METHODS = [
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
  "item/permissions/requestApproval",
] as const;

interface PendingApproval {
  request: ApprovalRequest;
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export interface ApprovalDiagnostic {
  method: string;
  requestIdHash: string;
  hasThreadId: boolean;
  hasTurnId: boolean;
  hasItemId: boolean;
  availableDecisions: ApprovalDecision[];
  response?: "success" | "failure";
}

export interface ServerRequestRegistryOptions {
  approvalRouter: ApprovalRouter;
  inputRouter: InputRouter;
  onApprovalQueued?: (request: ApprovalRequest) => void;
  onInputQueued?: (request: UserInputRequest) => void;
  onApprovalDiagnostic?: (diagnostic: ApprovalDiagnostic) => void;
}

export class ServerRequestRegistry {
  readonly #approvalRouter: ApprovalRouter;
  readonly #inputRouter: InputRouter;
  readonly #pendingApprovals = new Map<string, PendingApproval>();
  readonly #onApprovalQueued?: ServerRequestRegistryOptions["onApprovalQueued"];
  readonly #onInputQueued?: ServerRequestRegistryOptions["onInputQueued"];
  readonly #onApprovalDiagnostic?: ServerRequestRegistryOptions["onApprovalDiagnostic"];
  #unregister: Array<() => void> = [];

  constructor(options: ServerRequestRegistryOptions) {
    this.#approvalRouter = options.approvalRouter;
    this.#inputRouter = options.inputRouter;
    this.#onApprovalQueued = options.onApprovalQueued;
    this.#onInputQueued = options.onInputQueued;
    this.#onApprovalDiagnostic = options.onApprovalDiagnostic;
  }

  register(client: JsonRpcClient): void {
    this.unregister();
    for (const method of APPROVAL_METHODS) {
      this.#unregister.push(
        client.onServerRequest(method, (params, id) => this.#enqueueApproval(method, id, params)),
      );
    }
    this.#unregister.push(
      client.onServerRequest("item/tool/requestUserInput", (params, id) =>
        this.#enqueueInput("item/tool/requestUserInput", id, params),
      ),
    );
  }

  respondApproval(requestId: string, decision: ApprovalDecision, request: ApprovalRequest): void {
    const pending = this.#pendingApprovals.get(requestId);
    if (requestId.startsWith("mock-")) return;
    if (!pending || pending.request.requestId !== request.requestId) {
      this.#emitApprovalDiagnostic("unknown", request, "failure");
      throw new Error("The App Server approval is no longer pending");
    }
    this.#pendingApprovals.delete(requestId);
    this.#emitApprovalDiagnostic(pending.method, request, "success");
    pending.resolve(buildApprovalResponse(decision, request));
  }

  resolveFromServer(requestId: string | number): void {
    const id = String(requestId);
    const approval = this.#pendingApprovals.get(id);
    if (approval) {
      this.#pendingApprovals.delete(id);
      approval.resolve(buildApprovalResponse("cancel", approval.request));
    }
    this.#approvalRouter.resolve(id);
    this.#inputRouter.resolveFromServer(id);
  }

  clearByThread(threadId: string): void {
    for (const [id, pending] of this.#pendingApprovals)
      if (pending.request.threadId === threadId) this.#rejectApproval(id, "Thread closed");
    this.#inputRouter.clearByThread(threadId);
  }

  clearByTurn(threadId: string, turnId: string): void {
    this.#inputRouter.clearByTurn(threadId, turnId);
  }

  clearAll(reason: string): void {
    for (const id of [...this.#pendingApprovals.keys()]) this.#rejectApproval(id, reason);
    this.#inputRouter.clearAll(reason);
  }

  unregister(): void {
    for (const dispose of this.#unregister) dispose();
    this.#unregister = [];
  }

  #enqueueApproval(method: string, id: string | number, params: unknown): Promise<unknown> {
    const request = this.#approvalRouter.enqueue(id, method, params);
    this.#emitApprovalDiagnostic(method, request);
    this.#onApprovalQueued?.(request);
    return new Promise((resolve, reject) => {
      this.#pendingApprovals.set(request.requestId, { request, method, resolve, reject });
    });
  }

  #enqueueInput(method: string, id: string | number, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      try {
        const request = this.#inputRouter.enqueue(id, method, params, resolve, reject);
        this.#onInputQueued?.(request);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Invalid user-input request"));
      }
    });
  }

  #rejectApproval(id: string, reason: string): void {
    const pending = this.#pendingApprovals.get(id);
    if (!pending) return;
    this.#pendingApprovals.delete(id);
    this.#approvalRouter.resolve(id);
    pending.reject(new Error(reason));
  }

  #emitApprovalDiagnostic(
    method: string,
    request: ApprovalRequest,
    response?: ApprovalDiagnostic["response"],
  ): void {
    this.#onApprovalDiagnostic?.({
      method,
      requestIdHash: createHash("sha256").update(request.requestId).digest("hex").slice(0, 12),
      hasThreadId: request.threadId !== "unknown",
      hasTurnId: Boolean(request.turnId),
      hasItemId: Boolean(request.itemId),
      availableDecisions: [...request.availableDecisions],
      response,
    });
  }
}
