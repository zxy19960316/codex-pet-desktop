import {
  normalizeUserInputRequest,
  validateAndSerializeUserInputAnswers,
} from "./input-normalizer";
import type { UserInputAnswers, UserInputRequest } from "./input-types";

interface PendingInput {
  request: UserInputRequest;
  resolve: (value: unknown) => void;
  reject?: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
  submitting: boolean;
}

export interface InputRouterOptions {
  onChange?: (requests: UserInputRequest[]) => void;
  now?: () => number;
}

export class InputRouter {
  readonly #pending = new Map<string, PendingInput>();
  readonly #onChange?: InputRouterOptions["onChange"];
  readonly #now: () => number;

  constructor(options: InputRouterOptions = {}) {
    this.#onChange = options.onChange;
    this.#now = options.now ?? Date.now;
  }

  enqueue(
    requestId: string | number,
    method: string,
    params: unknown,
    resolve: (value: unknown) => void,
    reject?: (error: Error) => void,
  ): UserInputRequest {
    const id = String(requestId);
    if (this.#pending.has(id)) throw new Error("User-input request ID is already pending");
    const request = normalizeUserInputRequest(id, method, params, this.#now());
    const pending: PendingInput = { request, resolve, reject, submitting: false };
    if (request.expiresAt) {
      pending.timer = setTimeout(
        () => this.#clear(id, new Error("User-input request expired")),
        Math.max(0, request.expiresAt - this.#now()),
      );
    }
    this.#pending.set(id, pending);
    this.#emit();
    return structuredClone(request);
  }

  enqueueMock(request: UserInputRequest): UserInputRequest {
    if (this.#pending.has(request.requestId))
      throw new Error("User-input request ID is already pending");
    const pending: PendingInput = {
      request: { ...structuredClone(request), isMock: true },
      resolve: () => undefined,
      submitting: false,
    };
    this.#pending.set(request.requestId, pending);
    this.#emit();
    return structuredClone(pending.request);
  }

  async respond(requestId: string, answers: UserInputAnswers): Promise<void> {
    const pending = this.#pending.get(requestId);
    if (!pending) throw new Error("User-input request not found");
    if (pending.submitting) throw new Error("User-input response is already being sent");
    if (pending.request.expiresAt && pending.request.expiresAt <= this.#now()) {
      this.#clear(requestId, new Error("User-input request expired"));
      throw new Error("User-input request expired");
    }
    pending.submitting = true;
    this.#emit();
    try {
      // Validation happens before resolving the JSON-RPC server-request promise.
      const response = validateAndSerializeUserInputAnswers(pending.request, answers);
      pending.resolve(response);
      this.#clear(requestId);
    } catch (error) {
      pending.submitting = false;
      this.#emit();
      throw error;
    }
  }

  async cancel(requestId: string): Promise<void> {
    const pending = this.#pending.get(requestId);
    if (!pending) throw new Error("User-input request not found");
    pending.resolve({ answers: {} });
    this.#clear(requestId);
  }

  resolveFromServer(requestId: string | number): void {
    this.#clear(String(requestId));
  }

  clearByTurn(threadId: string, turnId: string): void {
    for (const [id, pending] of this.#pending)
      if (pending.request.threadId === threadId && pending.request.turnId === turnId)
        this.#clear(id, new Error("The turn completed before input was submitted"));
  }

  clearByThread(threadId: string): void {
    for (const [id, pending] of this.#pending)
      if (pending.request.threadId === threadId)
        this.#clear(id, new Error("The thread ended before input was submitted"));
  }

  clearAll(reason: string): void {
    for (const id of [...this.#pending.keys()]) this.#clear(id, new Error(reason));
  }

  snapshot(): UserInputRequest[] {
    return [...this.#pending.values()].map(({ request, submitting }) => ({
      ...structuredClone(request),
      submitting,
    }));
  }

  #clear(requestId: string, error?: Error): void {
    const pending = this.#pending.get(requestId);
    if (!pending) return;
    if (pending.timer) clearTimeout(pending.timer);
    this.#pending.delete(requestId);
    if (error) pending.reject?.(error);
    this.#emit();
  }

  #emit(): void {
    this.#onChange?.(this.snapshot());
  }
}
