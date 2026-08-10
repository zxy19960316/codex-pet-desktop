import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  connectionStatusLabel,
  formatCount,
  loadStateLabel,
  petOriginLabel,
  protocolSourceLabel,
} from "../src/renderer/settings/settings-copy";

describe("Settings Center Chinese localization", () => {
  it("uses Chinese document metadata and key interface copy", async () => {
    const root = process.cwd();
    const [html, app, selector, windowManager] = await Promise.all([
      readFile(join(root, "settings.html"), "utf8"),
      readFile(join(root, "src/renderer/settings/SettingsApp.tsx"), "utf8"),
      readFile(join(root, "src/renderer/settings/PetSelector.tsx"), "utf8"),
      readFile(join(root, "src/main/windows/settings-window-manager.ts"), "utf8"),
    ]);

    expect(html).toContain('<html lang="zh-CN">');
    expect(html).toContain("<title>Codex Pet 设置中心</title>");
    expect(windowManager).toContain('title: "Codex Pet 设置中心"');
    for (const copy of [
      "设置中心",
      "运行状态",
      "通用设置",
      "宠物管理",
      "Codex 连接",
      "额度与用量",
      "诊断信息",
      "关于",
    ]) {
      expect(app).toContain(copy);
    }
    for (const copy of ["当前宠物", "导入宠物包", "已安装的宠物", "第三方本地来源"]) {
      expect(selector).toContain(copy);
    }
  });

  it("translates every connection status and observation source", () => {
    expect(connectionStatusLabel("stopped")).toBe("已停止");
    expect(connectionStatusLabel("starting")).toBe("正在启动");
    expect(connectionStatusLabel("initializing")).toBe("正在初始化");
    expect(connectionStatusLabel("connected")).toBe("已连接");
    expect(connectionStatusLabel("reconnecting")).toBe("正在重新连接");
    expect(connectionStatusLabel("error")).toBe("连接错误");

    expect(protocolSourceLabel("codex-hooks")).toBe("Codex Hook");
    expect(protocolSourceLabel("codex-app-server")).toBe("Codex App Server");
    expect(protocolSourceLabel("codex-session-file")).toBe("本地会话文件");
    expect(protocolSourceLabel("mock")).toBe("模拟数据");
    expect(protocolSourceLabel("unavailable")).toBe("暂无数据");
  });

  it("translates settings storage, package origin, and counts", () => {
    expect(loadStateLabel({ kind: "loaded", schemaVersion: 3 })).toBe("已加载 v3 设置");
    expect(loadStateLabel({ kind: "migrated", sourceVersion: 2 })).toBe("已将 v2 设置迁移至 v3");
    expect(loadStateLabel({ kind: "future-version", schemaVersion: 4 })).toBe(
      "检测到并保护了未来版本 v4",
    );
    expect(loadStateLabel({ kind: "corrupt" })).toBe("设置文件损坏，已使用安全默认值");
    expect(loadStateLabel({ kind: "missing" })).toBe("正在使用默认值，尚未创建设置文件");
    expect(petOriginLabel("builtin")).toBe("内置");
    expect(petOriginLabel("user")).toBe("本地导入");
    expect(formatCount(null)).toBe("不可用");
    expect(formatCount(12_345)).toBe((12_345).toLocaleString("zh-CN"));
  });
});
