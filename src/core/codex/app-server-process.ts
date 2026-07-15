import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { JsonLineBuffer } from "./jsonl-buffer";
import { JsonRpcClient } from "./json-rpc-client";
import type { JsonRpcTransport } from "./protocol-types";

export type AppServerStatus =
  "stopped" | "starting" | "initializing" | "connected" | "reconnecting" | "error";

export interface AppServerProcessOptions {
  command?: string;
  args?: string[];
  requestTimeoutMs?: number;
  maxReconnectAttempts?: number;
  reconnectBaseMs?: number;
  spawnProcess?: typeof spawn;
  onStatus?: (status: AppServerStatus, detail?: string) => void;
  onNotification?: (method: string, params: unknown) => void;
  onClient?: (client: JsonRpcClient) => void;
  onDiagnostic?: (code: string) => void;
}

export interface AppServerLaunch {
  command: string;
  args: string[];
}

export function resolveAppServerLaunch(
  platform = process.platform,
  environment: NodeJS.ProcessEnv = process.env,
  pathExists: (path: string) => boolean = existsSync,
): AppServerLaunch {
  const args = ["app-server", "--listen", "stdio://"];
  const override = environment.CODEX_PET_CODEX_PATH?.trim();
  if (override && !/\.(?:cmd|bat)$/i.test(override)) return { command: override, args };
  if (platform !== "win32") return { command: override || "codex", args };

  const npmShim =
    override || (environment.APPDATA ? join(environment.APPDATA, "npm", "codex.cmd") : "");
  if (npmShim && pathExists(npmShim)) {
    return {
      command: environment.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", `"${npmShim}" app-server --listen stdio://`],
    };
  }
  return { command: "codex.exe", args };
}

export function shouldUseWindowsVerbatimArguments(platform: string, command: string): boolean {
  return platform === "win32" && /(?:^|[\\/])cmd(?:\.exe)?$/i.test(command);
}

class ProcessTransport implements JsonRpcTransport {
  #child: ChildProcessWithoutNullStreams;
  constructor(child: ChildProcessWithoutNullStreams) {
    this.#child = child;
  }
  writeLine(line: string): void {
    if (!this.#child.stdin.writable) throw new Error("App Server stdin is not writable");
    this.#child.stdin.write(`${line}\n`, "utf8");
  }
}

const NOTIFICATIONS = [
  "error",
  "thread/started",
  "thread/status/changed",
  "thread/closed",
  "thread/deleted",
  "thread/tokenUsage/updated",
  "turn/started",
  "turn/completed",
  "item/started",
  "item/completed",
  "serverRequest/resolved",
  "account/rateLimits/updated",
] as const;

const APP_SERVER_ARGS = ["app-server", "--listen", "stdio://"];

export class AppServerProcess {
  readonly #options: Required<
    Pick<
      AppServerProcessOptions,
      "command" | "args" | "requestTimeoutMs" | "maxReconnectAttempts" | "reconnectBaseMs"
    >
  > &
    AppServerProcessOptions;
  #child?: ChildProcessWithoutNullStreams;
  #client?: JsonRpcClient;
  #starting?: Promise<JsonRpcClient>;
  #stopping = false;
  #reconnectAttempts = 0;
  #reconnectTimer?: ReturnType<typeof setTimeout>;

  constructor(options: AppServerProcessOptions = {}) {
    const launch = resolveAppServerLaunch();
    this.#options = {
      command: options.command ?? launch.command,
      args: options.args ?? (options.command ? APP_SERVER_ARGS : launch.args),
      requestTimeoutMs: options.requestTimeoutMs ?? 15_000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 3,
      reconnectBaseMs: options.reconnectBaseMs ?? 500,
      ...options,
    };
  }

  get client(): JsonRpcClient | undefined {
    return this.#client;
  }

  get isRunning(): boolean {
    return Boolean(this.#child && this.#child.exitCode === null);
  }

  start(): Promise<JsonRpcClient> {
    if (this.#client && this.isRunning) return Promise.resolve(this.#client);
    if (this.#starting) return this.#starting;
    this.#stopping = false;
    this.#starting = this.#spawnAndInitialize().finally(() => {
      this.#starting = undefined;
    });
    return this.#starting;
  }

  async #spawnAndInitialize(): Promise<JsonRpcClient> {
    this.#status(this.#reconnectAttempts ? "reconnecting" : "starting");
    const spawnProcess = this.#options.spawnProcess ?? spawn;
    const child = spawnProcess(this.#options.command, this.#options.args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      windowsVerbatimArguments: shouldUseWindowsVerbatimArguments(
        process.platform,
        this.#options.command,
      ),
      env: process.env,
    }) as ChildProcessWithoutNullStreams;
    this.#child = child;
    const buffer = new JsonLineBuffer();
    const client = new JsonRpcClient(new ProcessTransport(child), {
      requestTimeoutMs: this.#options.requestTimeoutMs,
      onDiagnostic: this.#options.onDiagnostic,
    });
    this.#client = client;
    for (const method of NOTIFICATIONS)
      client.onNotification(method, (params) => this.#options.onNotification?.(method, params));
    child.stdout.on("data", (chunk: Buffer | string) => {
      for (const line of buffer.push(String(chunk))) client.handleIncomingLine(line);
    });
    child.stderr.on("data", () => this.#options.onDiagnostic?.("app-server-stderr"));
    child.once("error", (error) => {
      client.rejectPending(error);
      this.#status("error", error.message);
    });
    child.once("exit", (code, signal) => this.#handleExit(child, client, code, signal));
    this.#status("initializing");
    try {
      await client.sendRequest("initialize", {
        clientInfo: { name: "codex-pet-desktop", title: "Codex Pet Desktop", version: "0.1.0" },
        capabilities: {
          experimentalApi: true,
          requestAttestation: false,
          mcpServerOpenaiFormElicitation: false,
          optOutNotificationMethods: null,
        },
      });
      client.sendNotification("initialized");
      this.#options.onClient?.(client);
      this.#status("connected");
      return client;
    } catch (error) {
      this.#status("error", error instanceof Error ? error.message : "Initialization failed");
      if (child.exitCode === null) child.kill();
      throw error;
    }
  }

  #handleExit(
    child: ChildProcessWithoutNullStreams,
    client: JsonRpcClient,
    code: number | null,
    signal: NodeJS.Signals | null,
  ): void {
    if (this.#child !== child) return;
    client.rejectPending(new Error(`App Server exited (${code ?? signal ?? "unknown"})`));
    client.close();
    this.#child = undefined;
    this.#client = undefined;
    if (this.#stopping) {
      this.#status("stopped");
      return;
    }
    this.#status("error", `exit:${code ?? signal ?? "unknown"}`);
    if (this.#reconnectAttempts >= this.#options.maxReconnectAttempts) return;
    const delay = this.#options.reconnectBaseMs * 2 ** this.#reconnectAttempts;
    this.#reconnectAttempts += 1;
    this.#status("reconnecting", `attempt:${this.#reconnectAttempts}`);
    this.#reconnectTimer = setTimeout(() => void this.start().catch(() => undefined), delay);
  }

  async reconnect(): Promise<JsonRpcClient> {
    await this.stop();
    this.#reconnectAttempts = 0;
    return this.start();
  }

  async stop(): Promise<void> {
    this.#stopping = true;
    if (this.#reconnectTimer) clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = undefined;
    const child = this.#child;
    this.#client?.close();
    this.#client = undefined;
    this.#child = undefined;
    if (!child || child.exitCode !== null) {
      this.#status("stopped");
      return;
    }
    child.stdin.end();
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (child.exitCode === null) child.kill();
        resolve();
      }, 1_000);
      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    this.#status("stopped");
  }

  #status(status: AppServerStatus, detail?: string): void {
    this.#options.onStatus?.(status, detail);
  }
}
