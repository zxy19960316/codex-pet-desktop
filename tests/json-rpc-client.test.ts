import { describe, expect, it, vi } from "vitest";
import { JsonRpcClient, JsonRpcError } from "../src/core/codex/json-rpc-client";
import { MockTransport } from "../src/core/codex/mock-transport";

describe("JsonRpcClient", () => {
  it("matches a response to its request", async () => {
    const transport = new MockTransport();
    const client = new JsonRpcClient(transport);
    const result = client.sendRequest<{ ok: boolean }>("ping", { value: 1 });
    expect(JSON.parse(transport.lines[0])).toMatchObject({ id: 1, method: "ping" });
    client.handleIncomingLine('{"jsonrpc":"2.0","id":1,"result":{"ok":true}}');
    await expect(result).resolves.toEqual({ ok: true });
  });

  it("rejects JSON-RPC error responses", async () => {
    const transport = new MockTransport();
    const client = new JsonRpcClient(transport);
    const result = client.sendRequest("explode");
    client.handleIncomingLine(
      '{"jsonrpc":"2.0","id":1,"error":{"code":-32000,"message":"failed"}}',
    );
    await expect(result).rejects.toBeInstanceOf(JsonRpcError);
  });

  it("routes notifications and server requests", async () => {
    const transport = new MockTransport();
    const client = new JsonRpcClient(transport);
    const notice = vi.fn();
    client.onNotification("notice", notice);
    client.onServerRequest("question", async (params) => ({ echoed: params }));
    client.handleIncomingLine('{"jsonrpc":"2.0","method":"notice","params":{"n":1}}');
    client.handleIncomingLine(
      '{"jsonrpc":"2.0","id":"server-1","method":"question","params":{"answer":42}}',
    );
    await vi.waitFor(() => expect(transport.lines).toHaveLength(1));
    expect(notice).toHaveBeenCalledWith({ n: 1 });
    expect(JSON.parse(transport.lines[0])).toEqual({
      jsonrpc: "2.0",
      id: "server-1",
      result: { echoed: { answer: 42 } },
    });
  });

  it("survives invalid JSON and unknown response IDs", () => {
    const diagnostics: string[] = [];
    const client = new JsonRpcClient(new MockTransport(), {
      onDiagnostic: (message) => diagnostics.push(message),
    });
    expect(() => client.handleIncomingLine("not json")).not.toThrow();
    expect(() => client.handleIncomingLine('{"jsonrpc":"2.0","id":999,"result":{}}')).not.toThrow();
    expect(diagnostics).toEqual(["invalid-json", "unknown-response-id"]);
  });

  it("times out and clears pending requests", async () => {
    vi.useFakeTimers();
    const client = new JsonRpcClient(new MockTransport(), { requestTimeoutMs: 25 });
    const result = client.sendRequest("slow");
    const rejection = expect(result).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(26);
    await rejection;
    expect(client.pendingCount).toBe(0);
    vi.useRealTimers();
  });

  it("rejects every pending request on process exit or close", async () => {
    const client = new JsonRpcClient(new MockTransport());
    const first = client.sendRequest("one");
    const second = client.sendRequest("two");
    client.rejectPending(new Error("child exited"));
    await expect(first).rejects.toThrow("child exited");
    await expect(second).rejects.toThrow("child exited");
    expect(client.pendingCount).toBe(0);
  });
});
