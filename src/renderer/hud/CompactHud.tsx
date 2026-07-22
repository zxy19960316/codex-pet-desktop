import type { DesktopSnapshot } from "../../shared/ipc-contract";
import { PetResourceBars } from "../pet/PetResourceBars";

export function CompactHud({ snapshot }: { snapshot: DesktopSnapshot }) {
  return (
    <PetResourceBars
      buckets={snapshot.rateLimits}
      model={snapshot.agent?.model}
      reasoningEffort={snapshot.agent?.reasoningEffort}
      currentTokens={snapshot.currentThreadTokens}
      contextWindowTokens={snapshot.contextWindowTokens}
      expanded={snapshot.settings.hudVisible}
      onToggle={() => void window.codexPet.toggleHud()}
    />
  );
}
