import { useEffect, useState } from "react";
import { ApprovalCard } from "../approval/ApprovalCard";
import { CodexControlPanel } from "../control/CodexControlPanel";
import { DebugPanel } from "../debug/DebugPanel";
import { CompactHud } from "../hud/CompactHud";
import { Hud } from "../hud/Hud";
import { Pet } from "../pet/Pet";
import { wheelScaleStep } from "../pet/pet-scale-wheel";
import { ReplyCard } from "../reply/ReplyCard";
import { SessionQuickView } from "../sessions/SessionQuickView";
import { useDesktopApi } from "./use-desktop-api";

export function App() {
  const snapshot = useDesktopApi();
  const [quickViewVisible, setQuickViewVisible] = useState(false);
  useEffect(() => {
    let pendingSteps = 0;
    let timer: number | undefined;
    const flush = () => {
      const steps = Math.max(-10, Math.min(10, pendingSteps));
      pendingSteps = 0;
      timer = undefined;
      if (steps) void window.codexPet.adjustPetScale(steps);
    };
    const onWheel = (event: WheelEvent) => {
      const step = wheelScaleStep(event);
      if (!step) return;
      event.preventDefault();
      pendingSteps += step;
      if (timer === undefined) timer = window.setTimeout(flush, 120);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);
  const hubVisible = snapshot?.settings.hudVisible ?? false;
  useEffect(() => {
    if (hubVisible) setQuickViewVisible(false);
  }, [hubVisible]);
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
      <Pet
        state={snapshot.petState}
        pet={snapshot.pet?.active}
        scalePercent={snapshot.settings.scalePercent}
        physicalScaleFactor={snapshot.petPhysicalScaleFactor}
        resourceHud={
          quickViewVisible ? (
            <SessionQuickView snapshot={snapshot} />
          ) : (
            <CompactHud snapshot={snapshot} />
          )
        }
        onPrimaryAction={() => {
          if (snapshot.settings.hudVisible) {
            void window.codexPet.toggleHud().then(() => setQuickViewVisible(true));
            return;
          }
          setQuickViewVisible((visible) => !visible);
        }}
        primaryActionExpanded={quickViewVisible}
      />
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
