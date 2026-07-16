import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { CODEX_HOOK_EVENTS } from "../core/codex/hook-event";
import { isObject } from "../core/codex/protocol-guards";

interface HookConfig {
  hooks: Record<string, unknown[]>;
  [key: string]: unknown;
}

function quoted(path: string): string {
  return `"${path.replaceAll('"', '\\"')}"`;
}

export function codexPetHookCommand(receiverPath: string, eventPath: string): string {
  return `node ${quoted(receiverPath)} --output ${quoted(eventPath)}`;
}

export function mergeCodexPetHooks(
  existing: unknown,
  receiverPath: string,
  eventPath: string,
): HookConfig {
  const root: HookConfig = isObject(existing)
    ? ({ ...existing, hooks: isObject(existing.hooks) ? { ...existing.hooks } : {} } as HookConfig)
    : { hooks: {} };
  const command = codexPetHookCommand(receiverPath, eventPath);
  for (const event of CODEX_HOOK_EVENTS) {
    const groups = Array.isArray(root.hooks[event]) ? [...root.hooks[event]] : [];
    const alreadyInstalled = groups.some(
      (group) =>
        isObject(group) &&
        Array.isArray(group.hooks) &&
        group.hooks.some((hook) => isObject(hook) && hook.command === command),
    );
    if (!alreadyInstalled)
      groups.push({
        hooks: [
          {
            type: "command",
            command,
            commandWindows: command,
            timeout: 5,
          },
        ],
      });
    root.hooks[event] = groups;
  }
  return root;
}

export async function installCodexPetHooks(options: {
  hooksPath: string;
  receiverPath: string;
  eventPath: string;
}): Promise<void> {
  let existing: unknown = {};
  try {
    existing = JSON.parse(await readFile(options.hooksPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const next = mergeCodexPetHooks(existing, options.receiverPath, options.eventPath);
  await mkdir(dirname(options.hooksPath), { recursive: true });
  const temporary = `${options.hooksPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporary, options.hooksPath);
}
