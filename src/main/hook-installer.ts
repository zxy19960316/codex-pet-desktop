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

function isCodexPetHook(value: unknown, eventPath: string): boolean {
  if (!isObject(value) || typeof value.command !== "string") return false;
  const command = value.command.toLocaleLowerCase();
  return (
    command.trimStart().startsWith("node ") &&
    command.includes(`--output ${quoted(eventPath)}`.toLocaleLowerCase())
  );
}

function withoutStalePetHooks(groups: unknown[], eventPath: string): unknown[] {
  const cleaned: unknown[] = [];
  for (const group of groups) {
    if (!isObject(group) || !Array.isArray(group.hooks)) {
      cleaned.push(group);
      continue;
    }
    const hooks = group.hooks.filter((hook) => !isCodexPetHook(hook, eventPath));
    if (hooks.length) cleaned.push({ ...group, hooks });
  }
  return cleaned;
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
    const groups = withoutStalePetHooks(
      Array.isArray(root.hooks[event]) ? [...root.hooks[event]] : [],
      eventPath,
    );
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
}): Promise<"installed" | "unchanged"> {
  let existing: unknown = {};
  try {
    existing = JSON.parse(await readFile(options.hooksPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const next = mergeCodexPetHooks(existing, options.receiverPath, options.eventPath);
  if (JSON.stringify(next) === JSON.stringify(existing)) return "unchanged";
  await mkdir(dirname(options.hooksPath), { recursive: true });
  const temporary = `${options.hooksPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporary, options.hooksPath);
  return "installed";
}
