import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import {
  parseM32E2EConfiguration,
  validateM32VerificationReport,
} from "../src/main/m3-2-settings-verifier";

const absolute = {
  CODEX_PET_M3_2_USER_DATA: "C:/tmp/m3-2/user-data",
  CODEX_PET_M3_2_OUTPUT: "C:/tmp/m3-2/results/import",
  CODEX_PET_M3_2_IMPORT_SOURCE: "C:/tmp/m3-2/import-source",
};

describe("M3.2 Settings verifier", () => {
  it("does not enable path overrides without the explicit command-line gate", () => {
    expect(parseM32E2EConfiguration([], absolute)).toBeUndefined();
  });

  it("parses import and restart phases only from absolute main-process paths", () => {
    expect(
      parseM32E2EConfiguration(["--m3-2-e2e"], {
        ...absolute,
        CODEX_PET_M3_2_PHASE: "import",
      }),
    ).toMatchObject({
      phase: "import",
      importSource: resolve(absolute.CODEX_PET_M3_2_IMPORT_SOURCE),
    });
    const restartConfiguration = parseM32E2EConfiguration(["--m3-2-e2e"], {
      ...absolute,
      CODEX_PET_M3_2_PHASE: "restart",
      CODEX_PET_M3_2_IMPORT_SOURCE: undefined,
    });
    expect(restartConfiguration).toMatchObject({ phase: "restart" });
    expect(restartConfiguration).not.toHaveProperty("importSource");
    expect(() =>
      parseM32E2EConfiguration(["--m3-2-e2e"], {
        ...absolute,
        CODEX_PET_M3_2_PHASE: "import",
        CODEX_PET_M3_2_OUTPUT: "relative/results",
      }),
    ).toThrow("CODEX_PET_M3_2_OUTPUT must be an absolute path");
  });

  it("accepts complete phase reports and rejects incomplete evidence", () => {
    const report = {
      phase: "import",
      passed: true,
      packaged: true,
      currentPetId: "e2e-sprout",
      availablePetIds: ["pixel-sprout", "e2e-sprout"],
      previewsLoaded: true,
      imported: true,
      switchedToBuiltin: true,
      switchedBack: true,
      rescanned: false,
      screenshot: "C:/tmp/settings-import.png",
    };
    expect(validateM32VerificationReport(report, "import")).toEqual(report);
    expect(() =>
      validateM32VerificationReport({ ...report, previewsLoaded: false }, "import"),
    ).toThrow("previewsLoaded");
    expect(() => validateM32VerificationReport({ ...report, phase: "restart" }, "import")).toThrow(
      "phase",
    );
  });
});
