import { appendFile, mkdir, rename, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { parseCodexHookEvent } from "../core/codex/hook-event";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function rotateIfLarge(path: string): Promise<void> {
  try {
    if ((await stat(path)).size > 1_000_000) await rename(path, `${path}.old`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function main(): Promise<void> {
  const outputIndex = process.argv.indexOf("--output");
  const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
  if (!output) return;
  let raw: unknown;
  try {
    raw = JSON.parse(await readStdin());
  } catch {
    return;
  }
  const event = parseCodexHookEvent(raw);
  if (!event) return;
  await mkdir(dirname(output), { recursive: true });
  await rotateIfLarge(output);
  await appendFile(output, `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o600 });
}

void main().catch(() => {
  process.exitCode = 0;
});
