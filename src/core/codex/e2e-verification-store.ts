import { createHash } from "node:crypto";
import type {
  E2EVerificationKind,
  E2EVerificationRecord,
  E2EVerificationStep,
} from "./control-types";

const KINDS: E2EVerificationKind[] = [
  "approval-allow",
  "approval-deny",
  "user-input",
  "steer",
  "interrupt",
];

const SAFE_EVIDENCE = new Set([
  "turn/start",
  "turn/steer",
  "turn/interrupt",
  "turn/completed",
  "serverRequest/resolved",
  "item/commandExecution/requestApproval",
  "item/commandExecution/started",
  "item/tool/requestUserInput",
  "final-reply-steered",
  "transport-unavailable",
]);

export interface E2EVerificationStoreOptions {
  now?: () => number;
}

export interface E2EVerificationIds {
  threadId?: string;
  turnId?: string;
  requestId?: string;
}

function hash(value: string | undefined): string | undefined {
  return value ? createHash("sha256").update(value).digest("hex").slice(0, 12) : undefined;
}

function evidence(values: string[]): string[] {
  return values.filter((value) => SAFE_EVIDENCE.has(value));
}

function cloneRecord(record: E2EVerificationRecord): E2EVerificationRecord {
  return {
    ...record,
    protocolEvidence: record.protocolEvidence ? [...record.protocolEvidence] : undefined,
  };
}

export class E2EVerificationStore {
  readonly #now: () => number;
  readonly #records: E2EVerificationRecord[] = [];
  readonly #steps = new Map<E2EVerificationKind, E2EVerificationStep>(
    KINDS.map((kind) => [kind, { kind, state: "not-run" }]),
  );
  #nextId = 1;

  constructor(options: E2EVerificationStoreOptions = {}) {
    this.#now = options.now ?? Date.now;
  }

  start(kind: E2EVerificationKind, ids: E2EVerificationIds = {}): E2EVerificationRecord {
    const record: E2EVerificationRecord = {
      id: "e2e-" + this.#nextId++,
      kind,
      threadIdHash: hash(ids.threadId),
      turnIdHash: hash(ids.turnId),
      requestIdHash: hash(ids.requestId),
      startedAt: this.#now(),
      result: "running",
      protocolEvidence: [],
    };
    this.#records.unshift(record);
    this.#records.splice(20);
    this.#steps.set(kind, { kind, state: "waiting-for-codex", recordId: record.id });
    return cloneRecord(record);
  }

  attach(recordId: string, ids: E2EVerificationIds): void {
    const record = this.#record(recordId);
    record.threadIdHash ??= hash(ids.threadId);
    record.turnIdHash ??= hash(ids.turnId);
    record.requestIdHash ??= hash(ids.requestId);
  }

  resetSteps(): void {
    for (const kind of KINDS) this.#steps.set(kind, { kind, state: "not-run" });
  }

  waitForUser(recordId: string, event: string): void {
    const record = this.#record(recordId);
    if (record.result !== "running") return;
    this.#appendEvidence(record, [event]);
    this.#steps.set(record.kind, {
      kind: record.kind,
      state: "waiting-for-user",
      recordId: record.id,
    });
  }

  waitForCodex(recordId: string, events: string[] = []): void {
    const record = this.#record(recordId);
    if (record.result !== "running") return;
    this.#appendEvidence(record, events);
    this.#steps.set(record.kind, {
      kind: record.kind,
      state: "waiting-for-codex",
      recordId: record.id,
    });
  }

  pass(recordId: string, events: string[] = []): void {
    this.#finish(recordId, "passed", undefined, events);
  }

  fail(recordId: string, failureCode: string, events: string[] = []): void {
    this.#finish(recordId, "failed", failureCode, events);
  }

  failRunning(failureCode: string, events: string[] = []): void {
    for (const record of this.#records)
      if (record.result === "running") this.#finish(record.id, "failed", failureCode, events);
  }

  snapshot(): E2EVerificationRecord[] {
    return this.#records.map(cloneRecord);
  }

  steps(): E2EVerificationStep[] {
    return KINDS.map((kind) => ({ ...this.#steps.get(kind)! }));
  }

  #finish(
    recordId: string,
    result: "passed" | "failed",
    failureCode: string | undefined,
    events: string[],
  ): void {
    const record = this.#record(recordId);
    if (record.result !== "running") return;
    this.#appendEvidence(record, events);
    record.result = result;
    record.completedAt = this.#now();
    record.failureCode = failureCode;
    this.#steps.set(record.kind, {
      kind: record.kind,
      state: result,
      recordId: record.id,
      ...(failureCode ? { failureCode } : {}),
    });
  }

  #record(recordId: string): E2EVerificationRecord {
    const record = this.#records.find((candidate) => candidate.id === recordId);
    if (!record) throw new Error("Verification record was not found");
    return record;
  }

  #appendEvidence(record: E2EVerificationRecord, values: string[]): void {
    const current = record.protocolEvidence ?? [];
    record.protocolEvidence = [...new Set([...current, ...evidence(values)])];
  }
}
