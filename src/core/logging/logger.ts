import { redactValue } from "./redaction";

export interface LogRecord {
  level: "debug" | "info" | "warn" | "error";
  event: string;
  timestamp: number;
  metadata?: unknown;
}

export class SafeLogger {
  readonly #sink: (record: LogRecord) => void;

  constructor(
    sink: (record: LogRecord) => void = (record) => console.info(JSON.stringify(record)),
  ) {
    this.#sink = sink;
  }

  write(level: LogRecord["level"], event: string, metadata?: unknown): void {
    this.#sink({ level, event, timestamp: Date.now(), metadata: redactValue(metadata) });
  }
}
