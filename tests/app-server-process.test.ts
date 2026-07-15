import type { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AppServerProcess,
  resolveAppServerLaunch,
  shouldUseWindowsVerbatimArguments,
  type AppServerStatus,
} from "../src/core/codex/app-server-process";

class FakeChild extends EventEmitter {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  exitCode: number | null = null;

  constructor(fragmentHandshake = false) {
    super();
    let input = "";
    this.stdin.on("data", (chunk) => {
      input += String(chunk);
      const lines = input.split("\n");
      input = lines.pop() ?? "";
      for (const line of lines.filter(Boolean)) {
        const message = JSON.parse(line) as { id?: number; method?: string };
        if (message.method !== "initialize") continue;
        const response = `${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { userAgent: "fake" } })}\n`;
        if (fragmentHandshake) {
          this.stdout.write(response.slice(0, 12));
          this.stdout.write(response.slice(12));
        } else {
          this.stdout.write(response);
        }
      }
    });
    this.stdin.once("finish", () => this.exit(0));
  }

  exit(code: number, signal: NodeJS.Signals | null = null): void {
    if (this.exitCode !== null) return;
    this.exitCode = code;
    this.emit("exit", code, signal);
  }

  kill(): boolean {
    this.exit(1, "SIGTERM");
    return true;
  }
}

function asSpawn(factory: () => FakeChild): typeof spawn {
  return vi.fn(factory) as unknown as typeof spawn;
}

afterEach(() => vi.useRealTimers());

describe("AppServerProcess", () => {
  it("uses the npm command shim through a fixed Windows command wrapper", () => {
    expect(
      resolveAppServerLaunch(
        "win32",
        { APPDATA: "C:\\Users\\example\\AppData\\Roaming", ComSpec: "cmd.exe" },
        (path) => path.endsWith("codex.cmd"),
      ),
    ).toEqual({
      command: "cmd.exe",
      args: [
        "/d",
        "/s",
        "/c",
        '"C:\\Users\\example\\AppData\\Roaming\\npm\\codex.cmd" app-server --listen stdio://',
      ],
    });
    expect(shouldUseWindowsVerbatimArguments("win32", "C:\\Windows\\System32\\cmd.exe")).toBe(true);
    expect(shouldUseWindowsVerbatimArguments("linux", "cmd.exe")).toBe(false);
  });

  it("initializes once, handles fragmented stdout, and routes notifications", async () => {
    const child = new FakeChild(true);
    const spawnProcess = asSpawn(() => child);
    const statuses: AppServerStatus[] = [];
    const onClient = vi.fn();
    const onNotification = vi.fn();
    const process = new AppServerProcess({
      command: "fake-codex",
      spawnProcess,
      onStatus: (status) => statuses.push(status),
      onClient,
      onNotification,
    });

    const [first, second] = await Promise.all([process.start(), process.start()]);
    expect(first).toBe(second);
    expect(spawnProcess).toHaveBeenCalledTimes(1);
    expect(spawnProcess).toHaveBeenNthCalledWith(
      1,
      "fake-codex",
      ["app-server", "--listen", "stdio://"],
      expect.objectContaining({ windowsHide: true }),
    );
    expect(statuses).toEqual(["starting", "initializing", "connected"]);
    expect(onClient).toHaveBeenCalledWith(first);

    child.stdout.write(
      `${JSON.stringify({ jsonrpc: "2.0", method: "turn/started", params: { threadId: "t" } })}\n`,
    );
    expect(onNotification).toHaveBeenCalledWith("turn/started", { threadId: "t" });
    await process.stop();
    expect(statuses.at(-1)).toBe("stopped");
  });

  it("keeps stderr diagnostic-only and rejects pending requests after exit", async () => {
    const child = new FakeChild();
    const diagnostics: string[] = [];
    const process = new AppServerProcess({
      command: "fake-codex",
      spawnProcess: asSpawn(() => child),
      maxReconnectAttempts: 0,
      onDiagnostic: (code) => diagnostics.push(code),
    });
    const client = await process.start();
    const pending = client.sendRequest("slow");
    child.stderr.write("private output that must not be forwarded");
    child.exit(7);
    await expect(pending).rejects.toThrow("exited");
    expect(diagnostics).toEqual(["app-server-stderr"]);
  });

  it("bounds exponential reconnect attempts across repeated crashes", async () => {
    vi.useFakeTimers();
    const children: FakeChild[] = [];
    const process = new AppServerProcess({
      command: "fake-codex",
      spawnProcess: asSpawn(() => {
        const child = new FakeChild();
        children.push(child);
        return child;
      }),
      maxReconnectAttempts: 2,
      reconnectBaseMs: 10,
    });

    await process.start();
    children[0].exit(1);
    await vi.advanceTimersByTimeAsync(10);
    expect(children).toHaveLength(2);
    children[1].exit(1);
    await vi.advanceTimersByTimeAsync(20);
    expect(children).toHaveLength(3);
    children[2].exit(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(children).toHaveLength(3);
  });
});
