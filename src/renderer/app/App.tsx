import { ApprovalCard } from "../approval/ApprovalCard";
import { CodexControlPanel } from "../control/CodexControlPanel";
import { DebugPanel } from "../debug/DebugPanel";
import { CompactHud } from "../hud/CompactHud";
import { Hud } from "../hud/Hud";
import { Pet } from "../pet/Pet";
import { ReplyCard } from "../reply/ReplyCard";
import { useDesktopApi } from "./use-desktop-api";

export function App() {
  const snapshot = useDesktopApi();
  if (!snapshot) return <main className="shell loading">Waking up...</main>;
  const waitingStep = snapshot.e2eSteps.find((step) => step.state === "waiting-for-user");
  const approvalVerificationLabel =
    waitingStep?.kind === "approval-allow"
      ? "M2.6 Approval Allow Test"
      : waitingStep?.kind === "approval-deny"
        ? "M2.6 Approval Deny Test"
        : undefined;
  const inputVerificationLabel =
    waitingStep?.kind === "user-input" ? "M2.6 User Input Test" : undefined;
  const expanded =
    snapshot.settings.hudVisible ||
    snapshot.settings.debugVisible ||
    snapshot.approvals.length > 0 ||
    snapshot.userInputs.length > 0;

  return (
    <main className={`shell ${expanded ? "shell--expanded" : ""}`} data-state={snapshot.petState}>
      <CompactHud snapshot={snapshot} />
      <Pet state={snapshot.petState} />
      {snapshot.approvals[0] && (
        <ApprovalCard
          request={snapshot.approvals[0]}
          queueSize={snapshot.approvals.length}
          verificationLabel={approvalVerificationLabel}
        />
      )}
      {!snapshot.approvals.length && snapshot.userInputs[0] && (
        <ReplyCard
          request={snapshot.userInputs[0]}
          queueSize={snapshot.userInputs.length}
          verificationLabel={inputVerificationLabel}
        />
      )}
      {snapshot.settings.hudVisible && <Hud snapshot={snapshot} />}
      {snapshot.settings.debugVisible && (
        <>
          <CodexControlPanel snapshot={snapshot} />
          <DebugPanel snapshot={snapshot} />
        </>
      )}
    </main>
  );
}
