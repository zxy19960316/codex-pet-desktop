import type { JsonObject, JsonRpcId } from "./protocol-types";

export function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isJsonRpcId(value: unknown): value is JsonRpcId {
  return typeof value === "string" || typeof value === "number";
}

export function stringField(value: unknown, ...paths: string[][]): string | undefined {
  for (const path of paths) {
    let current: unknown = value;
    for (const part of path) current = isObject(current) ? current[part] : undefined;
    if (typeof current === "string") return current;
  }
  return undefined;
}
