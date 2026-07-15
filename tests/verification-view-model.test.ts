import { describe, expect, it } from "vitest";
import { verificationAvailability } from "../src/renderer/control/verification-view-model";
import { DEFAULT_SETTINGS } from "../src/shared/settings";

const snapshot = {
  connectionStatus: "connected" as const,
  protocolSource: "codex-app-server" as const,
  settings: DEFAULT_SETTINGS,
};

describe("verification view model", () => {
  it("allows real verification only with a connected real App Server", () => {
    expect(verificationAvailability(snapshot)).toEqual({ canStart: true });
    expect(
      verificationAvailability({
        ...snapshot,
        protocolSource: "mock",
        settings: { ...DEFAULT_SETTINGS, useMockData: true },
      }),
    ).toEqual({
      canStart: false,
      reason: "Real verification is unavailable while Mock data is enabled",
    });
    expect(verificationAvailability({ ...snapshot, connectionStatus: "reconnecting" })).toEqual({
      canStart: false,
      reason: "Connect Codex App Server before running verification",
    });
  });
});
