import { isJsonRpcId, isObject } from "./protocol-guards";
import type { JsonRpcErrorObject, JsonRpcId, JsonRpcTransport } from "./protocol-types";

type NotificationListener = (params: unknown) => void;
type ServerRequestListener = (params: unknown, id: JsonRpcId) => unknown | Promise<unknown>;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface JsonRpcClientOptions {
  requestTimeoutMs?: number;
  onDiagnostic?: (code: string) => void;
}

export class JsonRpcError extends Error {
  readonly code: number;
  readonly data?: unknown;

  constructor(error: JsonRpcErrorObject) {
    super(error.message);
    this.name = "JsonRpcError";
    this.code = error.code;
    this.data = error.data;
  }
}

export class JsonRpcClient {
  readonly #transport: JsonRpcTransport;
  readonly #requestTimeoutMs: number;
  readonly #onDiagnostic: (code: string) => void;
  readonly #pending = new Map<JsonRpcId, PendingRequest>();
  readonly #notifications = new Map<string, Set<NotificationListener>>();
  readonly #serverRequests = new Map<string, ServerRequestListener>();
  #nextId = 1;
  #closed = false;

  constructor(transport: JsonRpcTransport, options: JsonRpcClientOptions = {}) {
    this.#transport = transport;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 15_000;
    this.#onDiagnostic = options.onDiagnostic ?? (() => undefined);
  }

  get pendingCount(): number {
    return this.#pending.size;
  }

  sendRequest<T = unknown>(
    method: string,
    params?: unknown,
    timeoutMs = this.#requestTimeoutMs,
  ): Promise<T> {
    if (this.#closed) return Promise.reject(new Error("JSON-RPC client is closed"));
    const id = this.#nextId++;
    const message: Record<string, unknown> = { jsonrpc: "2.0", id, method };
    if (params !== undefined) message.params = params;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`JSON-RPC request ${method} timed out`));
      }, timeoutMs);
      this.#pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      try {
        this.#transport.writeLine(JSON.stringify(message));
      } catch (error) {
        clearTimeout(timer);
        this.#pending.delete(id);
        reject(error);
      }
    });
  }

  sendNotification(method: string, params?: unknown): void {
    if (this.#closed) throw new Error("JSON-RPC client is closed");
    const message: Record<string, unknown> = { jsonrpc: "2.0", method };
    if (params !== undefined) message.params = params;
    this.#transport.writeLine(JSON.stringify(message));
  }

  onNotification(method: string, listener: NotificationListener): () => void {
    const listeners = this.#notifications.get(method) ?? new Set<NotificationListener>();
    listeners.add(listener);
    this.#notifications.set(method, listeners);
    return () => listeners.delete(listener);
  }

  onServerRequest(method: string, listener: ServerRequestListener): () => void {
    this.#serverRequests.set(method, listener);
    return () => this.#serverRequests.delete(method);
  }

  handleIncomingLine(line: string): void {
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      this.#onDiagnostic("invalid-json");
      return;
    }
    if (!isObject(message)) {
      this.#onDiagnostic("invalid-message");
      return;
    }
    const method = typeof message.method === "string" ? message.method : undefined;
    if (method && isJsonRpcId(message.id)) {
      void this.#handleServerRequest(method, message.id, message.params);
      return;
    }
    if (method) {
      for (const listener of this.#notifications.get(method) ?? []) listener(message.params);
      return;
    }
    if (!isJsonRpcId(message.id)) {
      this.#onDiagnostic("invalid-message");
      return;
    }
    const pending = this.#pending.get(message.id);
    if (!pending) {
      this.#onDiagnostic("unknown-response-id");
      return;
    }
    clearTimeout(pending.timer);
    this.#pending.delete(message.id);
    if (
      isObject(message.error) &&
      typeof message.error.code === "number" &&
      typeof message.error.message === "string"
    ) {
      pending.reject(
        new JsonRpcError({
          code: message.error.code,
          message: message.error.message,
          data: message.error.data,
        }),
      );
    } else {
      pending.resolve(message.result);
    }
  }

  async #handleServerRequest(method: string, id: JsonRpcId, params: unknown): Promise<void> {
    const listener = this.#serverRequests.get(method);
    if (!listener) {
      this.#transport.writeLine(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: "Method not supported" },
        }),
      );
      return;
    }
    try {
      const result = await listener(params, id);
      this.#transport.writeLine(JSON.stringify({ jsonrpc: "2.0", id, result }));
    } catch {
      this.#transport.writeLine(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          error: { code: -32000, message: "Request rejected" },
        }),
      );
    }
  }

  rejectPending(reason: Error): void {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(reason);
    }
    this.#pending.clear();
  }

  close(reason = new Error("JSON-RPC client closed")): void {
    this.#closed = true;
    this.rejectPending(reason);
    this.#notifications.clear();
    this.#serverRequests.clear();
  }
}
