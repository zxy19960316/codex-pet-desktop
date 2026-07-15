import { PET_STATES } from "../../core/pet/pet-state";
import type { DesktopSnapshot } from "../../shared/ipc-contract";

export function DebugPanel({ snapshot }: { snapshot: DesktopSnapshot }) {
  return (
    <section className="panel debug-panel no-drag" aria-label="Debug controls">
      <div className="panel-title">
        <span>Debug states</span>
        <button
          className="icon-button"
          onClick={() => void window.codexPet.toggleDebug()}
          aria-label="Close debug panel"
        >
          ×
        </button>
      </div>
      <div className="state-grid">
        {PET_STATES.map((state) => (
          <button
            className={snapshot.petState === state ? "active" : ""}
            key={state}
            onClick={() => void window.codexPet.setPetState(state)}
          >
            {state}
          </button>
        ))}
      </div>
      <label className="switch-row">
        <input
          type="checkbox"
          checked={snapshot.settings.useMockData}
          onChange={(event) =>
            void window.codexPet.patchSettings({ useMockData: event.target.checked })
          }
        />
        <span>Use clearly labeled Mock usage</span>
      </label>
      <button onClick={() => void window.codexPet.enqueueMockApproval()}>
        Queue Mock approval card
      </button>
      <button onClick={() => void window.codexPet.reconnectCodex()}>
        Reconnect real App Server
      </button>
    </section>
  );
}
