import { useState } from "react";
import type {
  DeveloperCwdSelection,
  E2EVerificationKind,
  E2EVerificationStep,
} from "../../core/codex/control-types";
import type { DesktopSnapshot } from "../../shared/ipc-contract";
import { shortId, threadLabel } from "./control-view-model";
import { VERIFICATION_STEPS, verificationAvailability } from "./verification-view-model";

type CwdKind = DeveloperCwdSelection["kind"];

function relativePathLooksAbsolute(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path) || /^[\\/]/.test(path);
}

function stepActionLabel(step: E2EVerificationStep): string {
  if (step.state === "failed") return "Retry";
  if (step.state === "passed") return "Passed";
  if (step.state === "waiting-for-codex") return "Waiting for Codex";
  if (step.state === "waiting-for-user" && step.kind === "steer") return "Send fixed steer";
  if (step.state === "waiting-for-user" && step.kind === "interrupt") return "Interrupt now";
  if (step.state === "waiting-for-user") return "Use the card above";
  return "Run this step";
}

export function CodexControlPanel({ snapshot }: { snapshot: DesktopSnapshot }) {
  const [cwdKind, setCwdKind] = useState<CwdKind>("project-root");
  const [relativePath, setRelativePath] = useState(".");
  const [prompt, setPrompt] = useState("Give a short greeting without using tools.");
  const [steer, setSteer] = useState("");
  const [state, setState] = useState("Ready");
  const selected = snapshot.selectedThread;
  const activeTurnId = selected?.activeTurnId;
  const availability = verificationAvailability(snapshot);
  const unsafeRelative =
    cwdKind === "project-relative" &&
    (!relativePath.trim() || relativePathLooksAbsolute(relativePath.trim()));

  const run = async (label: string, action: () => Promise<unknown>) => {
    setState(label + ": sending");
    try {
      await action();
      setState(label + ": sent");
    } catch (error) {
      setState(label + ": " + (error instanceof Error ? error.message : "failed"));
    }
  };

  const cwdSelection = (): DeveloperCwdSelection =>
    cwdKind === "project-relative"
      ? { kind: "project-relative", relativePath: relativePath.trim() }
      : { kind: cwdKind };

  const runVerificationStep = async (kind: E2EVerificationKind) => {
    const step = snapshot.e2eSteps.find((candidate) => candidate.kind === kind);
    if (step?.state === "waiting-for-user" && kind === "steer") {
      if (!selected || !activeTurnId) throw new Error("The verification turn is no longer active");
      return window.codexPet.steerTurn({
        threadId: selected.threadId,
        expectedTurnId: activeTurnId,
        message: "Please include the exact word STEERED in the final reply.",
      });
    }
    if (step?.state === "waiting-for-user" && kind === "interrupt") {
      if (!selected || !activeTurnId) throw new Error("The verification turn is no longer active");
      return window.codexPet.interruptTurn({
        threadId: selected.threadId,
        turnId: activeTurnId,
      });
    }
    return window.codexPet.runVerification(kind);
  };

  return (
    <section className="panel control-panel no-drag" aria-label="Developer controls">
      <div className="panel-title">
        <span>Developer controls</span>
        <small>{snapshot.connectionStatus}</small>
      </div>
      <label className="control-field">
        <span>Developer cwd</span>
        <select value={cwdKind} onChange={(event) => setCwdKind(event.target.value as CwdKind)}>
          <option value="project-root">Project root</option>
          <option value="e2e-root">Disposable tmp/e2e</option>
          <option value="project-relative">Project-relative folder</option>
        </select>
      </label>
      {cwdKind === "project-relative" ? (
        <label className="control-field">
          <span>Project-relative path</span>
          <input value={relativePath} onChange={(event) => setRelativePath(event.target.value)} />
        </label>
      ) : null}
      <button
        disabled={unsafeRelative}
        onClick={() =>
          void run("Create thread", () => window.codexPet.createThread({ cwd: cwdSelection() }))
        }
      >
        Create disposable thread
      </button>
      <p className="control-meta">
        Current cwd: <strong>{snapshot.currentCwdLabel}</strong>
      </p>
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
      <div className="verification-guide">
        <div className="verification-heading">
          <strong>M2.6 verification</strong>
          <button
            disabled={!availability.canStart}
            onClick={() => void run("Start M2.6 verification", window.codexPet.startVerification)}
          >
            Start M2.6 verification
          </button>
        </div>
        {!availability.canStart ? <p className="unavailable">{availability.reason}</p> : null}
        {VERIFICATION_STEPS.map((metadata) => {
          const step =
            snapshot.e2eSteps.find((candidate) => candidate.kind === metadata.kind) ??
            ({ kind: metadata.kind, state: "not-run" } as E2EVerificationStep);
          const cardAction =
            step.state === "waiting-for-user" &&
            metadata.kind !== "steer" &&
            metadata.kind !== "interrupt";
          const disabled =
            !availability.canStart ||
            step.state === "passed" ||
            step.state === "waiting-for-codex" ||
            cardAction;
          return (
            <div
              className={"verification-step verification-step--" + step.state}
              key={metadata.kind}
            >
              <div>
                <strong>{metadata.label}</strong>
                <small>{step.state}</small>
              </div>
              <p>{metadata.instruction}</p>
              {step.failureCode ? <p className="reply-error">{step.failureCode}</p> : null}
              <button
                disabled={disabled}
                onClick={() => void run(metadata.label, () => runVerificationStep(metadata.kind))}
              >
                {stepActionLabel(step)}
              </button>
            </div>
          );
        })}
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
