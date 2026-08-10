import { useEffect, useState } from "react";
import type { SettingsPatch, SettingsWindowSnapshot } from "../../shared/ipc/settings-ipc";
import { PetSelector } from "./PetSelector";
import {
  connectionStatusLabel,
  formatCount,
  loadStateLabel,
  protocolSourceLabel,
} from "./settings-copy";

const SECTIONS = [
  ["status", "运行状态"],
  ["general", "通用设置"],
  ["pets", "宠物管理"],
  ["codex", "Codex 连接"],
  ["quota", "额度与用量"],
  ["diagnostics", "诊断信息"],
  ["about", "关于"],
] as const;

const PET_SCALE_SHORTCUTS = [50, 75, 100, 125, 150, 175, 200] as const;

function Toggle({
  checked,
  label,
  detail,
  disabled,
  onChange,
}: {
  checked: boolean;
  label: string;
  detail: string;
  disabled: boolean;
  onChange(value: boolean): void;
}) {
  return (
    <label className="setting-row">
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </label>
  );
}

export function SettingsApp() {
  const [snapshot, setSnapshot] = useState<SettingsWindowSnapshot | null>(null);
  const [pending, setPending] = useState(false);
  const [petPending, setPetPending] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void window.codexPetSettings
      .getSnapshot()
      .then((value) => {
        if (active) setSnapshot(value);
      })
      .catch(() => {
        if (active) setError("无法加载设置。");
      });
    const unsubscribe = window.codexPetSettings.subscribe((value) => {
      if (active) setSnapshot(value);
    });
    const unsubscribeNavigation = window.codexPetSettings.subscribeNavigation((section) => {
      window.location.hash = section;
      document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => {
      active = false;
      unsubscribe();
      unsubscribeNavigation();
    };
  }, []);

  async function patch(value: SettingsPatch): Promise<void> {
    setPending(true);
    setError(undefined);
    try {
      await window.codexPetSettings.patch(value);
    } catch {
      setError("设置修改被拒绝，未能应用。");
    } finally {
      setPending(false);
    }
  }

  async function runPetAction(name: string, action: () => Promise<void>): Promise<void> {
    setPetPending(name);
    setError(undefined);
    try {
      await action();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "宠物操作失败，且没有可用的诊断信息。",
      );
    } finally {
      setPetPending(undefined);
    }
  }

  if (!snapshot)
    return (
      <main className="settings-loading">
        <span className="pet-mark" aria-hidden="true" />
        <p>{error ?? "正在打开设置中心…"}</p>
      </main>
    );

  const preferences = snapshot.settings.preferences;
  const device = snapshot.settings.device;

  return (
    <main className="settings-shell">
      <aside className="settings-sidebar">
        <header>
          <span className="pet-mark" aria-hidden="true" />
          <div>
            <strong>Codex Pet</strong>
            <small>设置中心</small>
          </div>
        </header>
        <nav aria-label="设置中心分区">
          {SECTIONS.map(([id, label]) => (
            <a href={`#${id}`} key={id}>
              {label}
            </a>
          ))}
        </nav>
        <footer>设置架构 v{snapshot.settings.schemaVersion}</footer>
      </aside>

      <div className="settings-content">
        <div className="settings-heading">
          <div>
            <p className="eyebrow">M3.4</p>
            <h1>设置中心</h1>
          </div>
          <span className={`status-pill status-pill--${snapshot.status.connectionStatus}`}>
            {connectionStatusLabel(snapshot.status.connectionStatus)}
          </span>
        </div>
        {error && <p className="settings-error">{error}</p>}

        <section id="status" className="settings-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">运行时</p>
              <h2>运行状态</h2>
            </div>
            <span className="section-number">01</span>
          </div>
          <dl className="status-grid">
            <div>
              <dt>连接状态</dt>
              <dd>{connectionStatusLabel(snapshot.status.connectionStatus)}</dd>
            </div>
            <div>
              <dt>状态来源</dt>
              <dd>{protocolSourceLabel(snapshot.status.protocolSource)}</dd>
            </div>
            <div>
              <dt>活跃任务</dt>
              <dd>{snapshot.status.activeThreadCount}</dd>
            </div>
            <div>
              <dt>当前任务 Token</dt>
              <dd>{formatCount(snapshot.quota.currentThreadTokens)}</dd>
            </div>
          </dl>
        </section>

        <section id="general" className="settings-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">宠物窗口</p>
              <h2>通用设置</h2>
            </div>
            <span className="section-number">02</span>
          </div>
          <Toggle
            checked={preferences.alwaysOnTop}
            disabled={pending}
            label="窗口置顶"
            detail="让宠物始终显示在普通应用窗口上方。"
            onChange={(alwaysOnTop) => void patch({ preferences: { alwaysOnTop } })}
          />
          <Toggle
            checked={device.launchAtLogin}
            disabled={pending || !snapshot.app.isPackaged}
            label="登录 Windows 时启动"
            detail={
              snapshot.app.isPackaged
                ? "登录系统后在后台启动桌宠。"
                : "仅在已安装或已打包的应用中可用。"
            }
            onChange={(launchAtLogin) => void patch({ device: { launchAtLogin } })}
          />
          <Toggle
            checked={preferences.clickThrough}
            disabled={pending}
            label="鼠标穿透"
            detail="让鼠标操作穿过宠物窗口，不影响下方应用。"
            onChange={(clickThrough) => void patch({ preferences: { clickThrough } })}
          />
          <Toggle
            checked={preferences.soundEnabled}
            disabled={pending}
            label="声音"
            detail="为支持声音的原创主题启用反馈音效。"
            onChange={(soundEnabled) => void patch({ preferences: { soundEnabled } })}
          />
          <label className="range-setting pet-size-setting">
            <span>
              <strong>宠物大小</strong>
              <small>同时缩放宠物和窗口，可在 50% 至 200% 之间调整。</small>
            </span>
            <output data-testid="pet-scale-value">{preferences.petDisplay.scalePercent}%</output>
            <input
              type="range"
              min="50"
              max="200"
              step="5"
              value={preferences.petDisplay.scalePercent}
              disabled={pending}
              onChange={(event) =>
                void patch({
                  preferences: {
                    petDisplay: { scalePercent: Number(event.currentTarget.value) },
                  },
                })
              }
            />
          </label>
          <div className="pet-size-shortcuts" aria-label="宠物大小快捷选项">
            {PET_SCALE_SHORTCUTS.map((scalePercent) => (
              <button
                type="button"
                key={scalePercent}
                data-testid={`pet-scale-${scalePercent}`}
                className={preferences.petDisplay.scalePercent === scalePercent ? "active" : ""}
                disabled={pending}
                onClick={() => void patch({ preferences: { petDisplay: { scalePercent } } })}
              >
                {scalePercent}%
              </button>
            ))}
            <button
              type="button"
              disabled={pending || preferences.petDisplay.scalePercent === 100}
              onClick={() => void patch({ preferences: { petDisplay: { scalePercent: 100 } } })}
            >
              恢复默认大小
            </button>
          </div>
          <Toggle
            checked={preferences.petDisplay.lockPhysicalSizeAcrossDisplays}
            disabled={pending}
            label="跨屏保持实际大小"
            detail="宠物在不同显示器之间移动时，自动补偿显示缩放比例差异。"
            onChange={(lockPhysicalSizeAcrossDisplays) =>
              void patch({ preferences: { petDisplay: { lockPhysicalSizeAcrossDisplays } } })
            }
          />
        </section>

        <section id="pets" className="settings-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">2D 素材</p>
              <h2>宠物管理</h2>
            </div>
            <span className="section-number">03</span>
          </div>
          <PetSelector
            pets={snapshot.pets}
            codexPokePets={snapshot.codexPokePets}
            pending={petPending}
            onSelect={(id) =>
              void runPetAction(`select:${id}`, () => window.codexPetSettings.setActivePet(id))
            }
            onImport={() =>
              void runPetAction("import", () => window.codexPetSettings.importPetPackage())
            }
            onImportCodexPokePet={() =>
              void runPetAction("import-codex", () => window.codexPetSettings.importCodexPokePet())
            }
            onScanCodexPokePets={() =>
              void runPetAction("scan-codex", () => window.codexPetSettings.scanCodexPokePets())
            }
            onImportDiscovered={(sourcePetId) =>
              void runPetAction(`import-codex:${sourcePetId}`, () =>
                window.codexPetSettings.importDiscoveredCodexPokePet(sourcePetId),
              )
            }
            onOpenDirectory={() =>
              void runPetAction("open", () => window.codexPetSettings.openPetsDirectory())
            }
            onRescan={() => void runPetAction("rescan", () => window.codexPetSettings.rescanPets())}
          />
        </section>

        <section id="codex" className="settings-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">本地桥接</p>
              <h2>Codex 连接</h2>
            </div>
            <span className="section-number">04</span>
          </div>
          <Toggle
            checked={device.autoStartAppServer}
            disabled={pending}
            label="自动启动 App Server"
            detail="桌宠启动时自动连接额度信息和本地 Codex 控制功能。"
            onChange={(autoStartAppServer) => void patch({ device: { autoStartAppServer } })}
          />
          <Toggle
            checked={device.useMockData}
            disabled={pending}
            label="使用模拟数据"
            detail="显示固定的本地开发数据，不连接真实服务。"
            onChange={(useMockData) => void patch({ device: { useMockData } })}
          />
        </section>

        <section id="quota" className="settings-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">用量保护</p>
              <h2>额度与用量</h2>
            </div>
            <span className="section-number">05</span>
          </div>
          <label className="range-setting">
            <span>
              <strong>预警阈值</strong>
              <small>剩余额度达到该百分比时发出提醒。</small>
            </span>
            <output>{preferences.quotaWarningPercent}%</output>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={preferences.quotaWarningPercent}
              disabled={pending}
              onChange={(event) =>
                void patch({
                  preferences: { quotaWarningPercent: Number(event.currentTarget.value) },
                })
              }
            />
          </label>
          <div className="quota-summary">
            {snapshot.quota.rateLimits?.length ? (
              snapshot.quota.rateLimits.map((bucket) => (
                <div key={bucket.id}>
                  <span>{bucket.label ?? bucket.id}</span>
                  <strong>剩余 {Math.round(bucket.remainingPercent)}%</strong>
                </div>
              ))
            ) : (
              <p>暂时无法获取实时额度数据。</p>
            )}
            <div>
              <span>今日 Token</span>
              <strong>{formatCount(snapshot.quota.dailyUsage?.tokens)}</strong>
            </div>
          </div>
        </section>

        <section id="diagnostics" className="settings-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">只读信息</p>
              <h2>诊断信息</h2>
            </div>
            <span className="section-number">06</span>
          </div>
          <dl className="diagnostic-list">
            <div>
              <dt>设置存储</dt>
              <dd>{loadStateLabel(snapshot.loadState)}</dd>
            </div>
            <div>
              <dt>连接详情</dt>
              <dd>{snapshot.status.connectionDetail ?? "暂无诊断详情。"}</dd>
            </div>
          </dl>
        </section>

        <section id="about" className="settings-card about-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">独立项目</p>
              <h2>关于</h2>
            </div>
            <span className="section-number">07</span>
          </div>
          <p>
            {snapshot.app.name} <strong>v{snapshot.app.version}</strong>
          </p>
          <p>采用 MIT 许可证的桌面伴侣应用，不包含云端设置同步或遥测功能。</p>
          <ul className="asset-policy-summary">
            <li>本项目不内置 Pokémon 角色素材。</li>
            <li>本地导入的第三方素材不受本项目 MIT 许可证覆盖。</li>
            <li>你需要自行确认拥有使用所导入素材的权利。</li>
            <li>本应用与 Pokémon 权利方不存在官方关联。</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
