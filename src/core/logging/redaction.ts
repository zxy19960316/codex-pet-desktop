const SENSITIVE_KEY =
  /(?:token|cookie|authorization|secret|password|message|commandOutput|fileContent|conversation|sessionFile)/i;
const BEARER = /\b(?:bearer|gh[opsu]_|sk-[a-z-]*)\S+/gi;

export function redactValue(value: unknown, key = ""): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (typeof value === "string") return value.replace(BEARER, "[REDACTED]");
  if (Array.isArray(value)) return value.map((item) => redactValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactValue(entryValue, entryKey),
      ]),
    );
  }
  return value;
}
