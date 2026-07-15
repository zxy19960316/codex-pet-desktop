import { ApprovalCard } from "../approval/ApprovalCard";
import { DebugPanel } from "../debug/DebugPanel";
import { Hud } from "../hud/Hud";
import { Pet } from "../pet/Pet";
import { useDesktopApi } from "./use-desktop-api";

export function App() {
  const snapshot = useDesktopApi();
  if (!snapshot) return <main className="shell loading">Waking up…</main>;

  return (
    <main className="shell" data-state={snapshot.petState}>
      <header className="drag-bar">
        <span className={`connection connection--${snapshot.connectionStatus}`} />
        <span>{snapshot.protocolSource === "mock" ? "Mock" : snapshot.connectionStatus}</span>
        <button
          className="icon-button no-drag"
          onClick={() => void window.codexPet.toggleClickThrough()}
          title="Toggle click-through"
        >
          {snapshot.settings.clickThrough ? "◌" : "●"}
        </button>
      </header>
      <Pet state={snapshot.petState} />
      {snapshot.approvals[0] && (
        <ApprovalCard request={snapshot.approvals[0]} queueSize={snapshot.approvals.length} />
      )}
      {snapshot.settings.hudVisible && <Hud snapshot={snapshot} />}
      {snapshot.settings.debugVisible && <DebugPanel snapshot={snapshot} />}
    </main>
  );
}
