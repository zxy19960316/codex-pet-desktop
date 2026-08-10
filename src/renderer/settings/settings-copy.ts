import type { AppServerStatus } from "../../core/codex/app-server-process";
import type { PetPackageOrigin } from "../../core/pet/pet-manifest";
import type { SettingsLoadState } from "../../shared/settings";
import type { SettingsWindowSnapshot } from "../../shared/ipc/settings-ipc";

const CONNECTION_STATUS_LABELS: Record<AppServerStatus, string> = {
  stopped: "已停止",
  starting: "正在启动",
  initializing: "正在初始化",
  connected: "已连接",
  reconnecting: "正在重新连接",
  error: "连接错误",
};

const PROTOCOL_SOURCE_LABELS: Record<SettingsWindowSnapshot["status"]["protocolSource"], string> = {
  "codex-hooks": "Codex Hook",
  "codex-app-server": "Codex App Server",
  "codex-session-file": "本地会话文件",
  mock: "模拟数据",
  unavailable: "暂无数据",
};

const PET_ORIGIN_LABELS: Record<PetPackageOrigin, string> = {
  builtin: "内置",
  user: "本地导入",
};

export function connectionStatusLabel(status: AppServerStatus): string {
  return CONNECTION_STATUS_LABELS[status];
}

export function protocolSourceLabel(
  source: SettingsWindowSnapshot["status"]["protocolSource"],
): string {
  return PROTOCOL_SOURCE_LABELS[source];
}

export function loadStateLabel(state: SettingsLoadState): string {
  if (state.kind === "loaded") return "已加载 v3 设置";
  if (state.kind === "migrated") return `已将 v${state.sourceVersion} 设置迁移至 v3`;
  if (state.kind === "future-version") return `检测到并保护了未来版本 v${state.schemaVersion}`;
  if (state.kind === "corrupt") return "设置文件损坏，已使用安全默认值";
  return "正在使用默认值，尚未创建设置文件";
}

export function petOriginLabel(origin: PetPackageOrigin): string {
  return PET_ORIGIN_LABELS[origin];
}

export function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? "不可用" : value.toLocaleString("zh-CN");
}
