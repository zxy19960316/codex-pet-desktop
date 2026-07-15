export class JsonLineBuffer {
  #buffer = "";

  push(chunk: string | Uint8Array): string[] {
    this.#buffer += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    const lines = this.#buffer.split("\n");
    this.#buffer = lines.pop() ?? "";
    return lines.map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line)).filter(Boolean);
  }

  flush(): string | null {
    if (!this.#buffer) return null;
    const line = this.#buffer.endsWith("\r") ? this.#buffer.slice(0, -1) : this.#buffer;
    this.#buffer = "";
    return line || null;
  }
}
