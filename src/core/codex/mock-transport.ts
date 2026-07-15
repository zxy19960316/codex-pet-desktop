import type { JsonRpcTransport } from "./protocol-types";

export class MockTransport implements JsonRpcTransport {
  readonly lines: string[] = [];
  readonly #listeners = new Set<(line: string) => void>();

  writeLine(line: string): void {
    this.lines.push(line);
  }

  onLine(listener: (line: string) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  emit(line: string): void {
    for (const listener of this.#listeners) listener(line);
  }
}
