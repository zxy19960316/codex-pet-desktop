import type { DesktopThreadSnapshot } from "../../shared/ipc-contract";

export function shortId(value: string | undefined): string {
  return value ? `${value.slice(0, 8)}…` : "none";
}

export function threadLabel(thread: DesktopThreadSnapshot): string {
  return `${shortId(thread.threadId)} · ${thread.status}`;
}
