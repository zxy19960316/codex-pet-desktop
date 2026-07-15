import { describe, expect, it } from "vitest";
import { ApprovalRouter } from "../src/core/codex/approval-router";
import { JsonRpcClient } from "../src/core/codex/json-rpc-client";
import { MockTransport } from "../src/core/codex/mock-transport";
import {
  ServerRequestRegistry,
  type ApprovalDiagnostic,
} from "../src/core/codex/server-request-registry";
import { InputRouter } from "../src/core/input/input-router";

describe("ServerRequestRegistry", () => {
  it("routes approval requests and emits only redacted diagnostic metadata", async () => {
    const transport = new MockTransport();
    const diagnostics: ApprovalDiagnostic[] = [];
    const holder: { registry?: ServerRequestRegistry } = {};
    const approvals = new ApprovalRouter({
      respond: async (id, decision, request) => {
        if (!holder.registry) throw new Error("Registry not initialized");
        holder.registry.respondApproval(id, decision, request);
      },
    });
    const registry = new ServerRequestRegistry({
      approvalRouter: approvals,
      inputRouter: new InputRouter(),
      onApprovalDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    holder.registry = registry;
    const client = new JsonRpcClient(transport);
    registry.register(client);
    client.handleIncomingLine(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 7,
        method: "item/commandExecution/requestApproval",
        params: {
          threadId: "thread-a",
          turnId: "turn-a",
          itemId: "item-a",
          command: "private command body",
          availableDecisions: ["accept", "decline"],
        },
      }),
    );
    await approvals.respond("7", "accept");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(JSON.parse(transport.lines.at(-1) ?? "{}")).toMatchObject({
      id: 7,
      result: { decision: "accept" },
    });
    expect(diagnostics).toEqual([
      expect.objectContaining({
        method: "item/commandExecution/requestApproval",
        response: undefined,
      }),
      expect.objectContaining({
        method: "item/commandExecution/requestApproval",
        response: "success",
      }),
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain("private command body");
  });
});
