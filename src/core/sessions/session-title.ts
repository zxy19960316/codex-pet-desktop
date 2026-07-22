import type { SessionTitlePrivacy } from "./session-types";

const MAX_TITLE_LENGTH = 36;
const ABSOLUTE_PATH = /^(?:[A-Za-z]:[\\/]|[\\/]{1,2})/;

export function sanitizeSessionTitle(value: string, maximum = MAX_TITLE_LENGTH): string {
  let result = [...value]
    .map((character) => {
      const code = character.charCodeAt(0);
      return (code >= 0 && code <= 31) || (code >= 127 && code <= 159) ? " " : character;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (ABSOLUTE_PATH.test(result)) {
    const basename = result.split(/[\\/]/).filter(Boolean).at(-1);
    result = basename ?? "";
  }
  return [...result].slice(0, Math.max(0, maximum)).join("");
}

export function resolveSessionTitle(options: {
  title?: string;
  projectLabel?: string;
  privacy?: SessionTitlePrivacy;
  fallbackNumber: number;
}): string {
  const privacy = options.privacy ?? "safe-title";
  const fallback = `Codex Session ${Math.max(1, Math.floor(options.fallbackNumber) || 1)}`;
  if (privacy === "anonymous") return fallback;
  const project = sanitizeSessionTitle(options.projectLabel ?? "");
  if (privacy === "project-only") return project || fallback;
  return sanitizeSessionTitle(options.title ?? "") || project || fallback;
}
