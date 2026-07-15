import { useEffect, useState } from "react";
import type { DesktopSnapshot } from "../../shared/ipc-contract";

export function useDesktopApi(): DesktopSnapshot | null {
  const [snapshot, setSnapshot] = useState<DesktopSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    void window.codexPet.getSnapshot().then((value) => {
      if (active) setSnapshot(value);
    });
    const unsubscribe = window.codexPet.subscribe((value) => {
      if (active) setSnapshot(value);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return snapshot;
}
