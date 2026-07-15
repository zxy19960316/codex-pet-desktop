import { useState } from "react";
import type { DesktopSnapshot } from "../../shared/ipc-contract";
import { shortId, threadLabel } from "./control-view-model";

export function CodexControlPanel({ snapshot }: { snapshot: DesktopSnapshot }) {
  const [cwd, setCwd] = useState(snapshot.currentCwd ?? "");
  const [prompt, setPrompt] = useState("Give a short greeting without using tools.");
  const [steer, setSteer] = useState("");
  const [state, setState] = useState("Ready");
  const selected = snapshot.selectedThread;
  const activeTurnId = selected?.activeTurnId;

  const run = async (label: string, action: () => Promise<unknown>) => {
    setState(`${label}: sending`);
    try {
      await action();
      setState(`${label}: sent`);
    } catch (error) {
      setState(`${label}: ${error instanceof Error ? error.message : "failed"}`);
    }
  };

  return (
    <section className="panel control-panel no-drag" aria-label="Developer controls">
      <div className="panel-title">
        <span>Developer controls</span>
        <small>{snapshot.connectionStatus}</small>
      </div>
      <label className="control-field">
        <span>Safe cwd</span>
        <input value={cwd} onChange={(event) => setCwd(event.target.value)} />
      </label>
      <button
        onClick={() => void run("Create thread", () => window.codexPet.createThread({ cwd }))}
      >
        Create disposable thread
      </button>
      <label className="control-field">
        <span>Thread</span>
        <select
          value={snapshot.selectedThreadId ?? ""}
          onChange={(event) =>
            event.target.value &&
            void run("Select thread", () => window.codexPet.selectThread(event.target.value))
          }
        >
          <option value="">Select a thread</option>
          {snapshot.threads.map((thread) => (
            <option key={thread.threadId} value={thread.threadId}>
              {threadLabel(thread)}
            </option>
          ))}
        </select>
      </label>
      <p className="control-meta">
        Active turn: <strong>{shortId(activeTurnId)}</strong>
      </p>
      <label className="control-field">
        <span>Normal turn</span>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
      </label>
      <button
        disabled={!selected || Boolean(activeTurnId)}
        onClick={() =>
          selected &&
          void run("Start turn", () =>
            window.codexPet.startTurn({ threadId: selected.threadId, prompt, mode: "normal" }),
          )
        }
      >
        Start normal turn
      </button>
      <div className="control-actions">
        <button onClick={() => void run("Approval test", () => window.codexPet.runApprovalTest())}>
          Run real approval test
        </button>
        <button onClick={() => void run("Input test", () => window.codexPet.runUserInputTest())}>
          Run real user-input test
        </button>
      </div>
      <label className="control-field">
        <span>Steer active turn</span>
        <input value={steer} onChange={(event) => setSteer(event.target.value)} />
      </label>
      <div className="control-actions">
        <button
          disabled={!selected || !activeTurnId || !steer.trim()}
          onClick={() =>
            selected &&
            activeTurnId &&
            void run("Steer", () =>
              window.codexPet.steerTurn({
                threadId: selected.threadId,
                expectedTurnId: activeTurnId,
                message: steer,
              }),
            )
          }
        >
          Steer {shortId(activeTurnId)}
        </button>
        <button
          disabled={!selected || !activeTurnId}
          onClick={() =>
            selected &&
            activeTurnId &&
            void run("Interrupt", () =>
              window.codexPet.interruptTurn({ threadId: selected.threadId, turnId: activeTurnId }),
            )
          }
        >
          Interrupt active turn
        </button>
      </div>
      <p className="control-status" role="status">
        {state}
      </p>
    </section>
  );
}
