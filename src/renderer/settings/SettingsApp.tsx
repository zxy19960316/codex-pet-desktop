import { useEffect, useState } from "react";
import type { SettingsPatch, SettingsWindowSnapshot } from "../../shared/ipc/settings-ipc";
import { PetSelector } from "./PetSelector";

const SECTIONS = [
  ["status", "Status"],
  ["general", "General"],
  ["pets", "Pets"],
  ["codex", "Codex connection"],
  ["quota", "Quota"],
  ["diagnostics", "Diagnostics"],
  ["about", "About"],
] as const;

const PET_SCALE_SHORTCUTS = [50, 75, 100, 125, 150, 175, 200] as const;

function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? "Unavailable" : value.toLocaleString();
}

function loadStateLabel(snapshot: SettingsWindowSnapshot): string {
  const state = snapshot.loadState;
  if (state.kind === "loaded") return "Loaded v3 settings";
  if (state.kind === "migrated") return `Migrated v${state.sourceVersion} settings to v3`;
  if (state.kind === "future-version") return `Protected future schema v${state.schemaVersion}`;
  if (state.kind === "corrupt") return "Protected damaged settings file; using safe defaults";
  return "Using defaults; settings file not created yet";
}

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
        if (active) setError("Settings could not be loaded.");
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
      setError("The settings change was rejected and was not applied.");
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
        actionError instanceof Error
          ? actionError.message
          : "The pet operation failed without a diagnostic message.",
      );
    } finally {
      setPetPending(undefined);
    }
  }

  if (!snapshot)
    return (
      <main className="settings-loading">
        <span className="pet-mark" aria-hidden="true" />
        <p>{error ?? "Opening Settings Center..."}</p>
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
            <small>Settings Center</small>
          </div>
        </header>
        <nav aria-label="Settings sections">
          {SECTIONS.map(([id, label]) => (
            <a href={`#${id}`} key={id}>
              {label}
            </a>
          ))}
        </nav>
        <footer>Schema v{snapshot.settings.schemaVersion}</footer>
      </aside>

      <div className="settings-content">
        <div className="settings-heading">
          <div>
            <p className="eyebrow">M3.4</p>
            <h1>Settings Center</h1>
          </div>
          <span className={`status-pill status-pill--${snapshot.status.connectionStatus}`}>
            {snapshot.status.connectionStatus}
          </span>
        </div>
        {error && <p className="settings-error">{error}</p>}

        <section id="status" className="settings-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Runtime</p>
              <h2>Status</h2>
            </div>
            <span className="section-number">01</span>
          </div>
          <dl className="status-grid">
            <div>
              <dt>Connection</dt>
              <dd>{snapshot.status.connectionStatus}</dd>
            </div>
            <div>
              <dt>Observation source</dt>
              <dd>{snapshot.status.protocolSource}</dd>
            </div>
            <div>
              <dt>Active threads</dt>
              <dd>{snapshot.status.activeThreadCount}</dd>
            </div>
            <div>
              <dt>Current thread tokens</dt>
              <dd>{formatCount(snapshot.quota.currentThreadTokens)}</dd>
            </div>
          </dl>
        </section>

        <section id="general" className="settings-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Pet window</p>
              <h2>General</h2>
            </div>
            <span className="section-number">02</span>
          </div>
          <Toggle
            checked={preferences.alwaysOnTop}
            disabled={pending}
            label="Always on top"
            detail="Keep the pet above normal application windows."
            onChange={(alwaysOnTop) => void patch({ preferences: { alwaysOnTop } })}
          />
          <Toggle
            checked={preferences.clickThrough}
            disabled={pending}
            label="Click-through"
            detail="Let pointer input pass through the pet window."
            onChange={(clickThrough) => void patch({ preferences: { clickThrough } })}
          />
          <Toggle
            checked={preferences.soundEnabled}
            disabled={pending}
            label="Sound"
            detail="Reserve sound feedback for supported original themes."
            onChange={(soundEnabled) => void patch({ preferences: { soundEnabled } })}
          />
          <label className="range-setting pet-size-setting">
            <span>
              <strong>Pet size</strong>
              <small>Adjust the pet and its window together from 50% to 200%.</small>
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
          <div className="pet-size-shortcuts" aria-label="Pet size shortcuts">
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
              Restore default size
            </button>
          </div>
          <Toggle
            checked={preferences.petDisplay.lockPhysicalSizeAcrossDisplays}
            disabled={pending}
            label="Keep physical size across displays"
            detail="Compensate for different display scale factors when the pet moves between monitors."
            onChange={(lockPhysicalSizeAcrossDisplays) =>
              void patch({ preferences: { petDisplay: { lockPhysicalSizeAcrossDisplays } } })
            }
          />
        </section>

        <section id="pets" className="settings-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">2D assets</p>
              <h2>Pets</h2>
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
              <p className="eyebrow">Local bridge</p>
              <h2>Codex connection</h2>
            </div>
            <span className="section-number">04</span>
          </div>
          <Toggle
            checked={device.autoStartAppServer}
            disabled={pending}
            label="Start App Server automatically"
            detail="Enable the optional local control path at app startup."
            onChange={(autoStartAppServer) => void patch({ device: { autoStartAppServer } })}
          />
          <Toggle
            checked={device.useMockData}
            disabled={pending}
            label="Use mock data"
            detail="Show deterministic local development data instead of a real connection."
            onChange={(useMockData) => void patch({ device: { useMockData } })}
          />
        </section>

        <section id="quota" className="settings-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Usage guardrail</p>
              <h2>Quota</h2>
            </div>
            <span className="section-number">05</span>
          </div>
          <label className="range-setting">
            <span>
              <strong>Warning threshold</strong>
              <small>Warn when remaining quota reaches this percentage.</small>
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
                  <strong>{Math.round(bucket.remainingPercent)}% remaining</strong>
                </div>
              ))
            ) : (
              <p>Live quota data is unavailable.</p>
            )}
            <div>
              <span>Tokens today</span>
              <strong>{formatCount(snapshot.quota.dailyUsage?.tokens)}</strong>
            </div>
          </div>
        </section>

        <section id="diagnostics" className="settings-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Read-only</p>
              <h2>Diagnostics</h2>
            </div>
            <span className="section-number">06</span>
          </div>
          <dl className="diagnostic-list">
            <div>
              <dt>Settings storage</dt>
              <dd>{loadStateLabel(snapshot)}</dd>
            </div>
            <div>
              <dt>Connection detail</dt>
              <dd>{snapshot.status.connectionDetail ?? "No diagnostic detail reported."}</dd>
            </div>
          </dl>
        </section>

        <section id="about" className="settings-card about-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Independent project</p>
              <h2>About</h2>
            </div>
            <span className="section-number">07</span>
          </div>
          <p>
            {snapshot.app.name} <strong>v{snapshot.app.version}</strong>
          </p>
          <p>MIT-licensed desktop companion. No cloud settings sync or telemetry is included.</p>
        </section>
      </div>
    </main>
  );
}
