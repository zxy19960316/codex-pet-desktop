import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DesktopSnapshot } from "../shared/ipc-contract";

type E2EResultSnapshot = Pick<
  DesktopSnapshot,
  "connectionStatus" | "protocolSource" | "e2eSteps" | "e2eRecords"
>;

export function writeE2EResult(resultPath: string, snapshot: E2EResultSnapshot): void {
  mkdirSync(dirname(resultPath), { recursive: true });
  writeFileSync(
    resultPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        connectionStatus: snapshot.connectionStatus,
        protocolSource: snapshot.protocolSource,
        steps: snapshot.e2eSteps,
        records: snapshot.e2eRecords,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}
