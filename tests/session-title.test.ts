import { describe, expect, it } from "vitest";
import { resolveSessionTitle, sanitizeSessionTitle } from "../src/core/sessions/session-title";

describe("session title privacy", () => {
  it("uses a cleaned App Server title without retaining control characters", () => {
    expect(sanitizeSessionTitle("  Fix\n\u0000 installer   flow  ")).toBe("Fix installer flow");
    expect(
      resolveSessionTitle({ title: "  Fix\n\u0000 installer   flow  ", fallbackNumber: 3 }),
    ).toBe("Fix installer flow");
  });

  it("caps visible titles and strips an absolute path to a safe basename", () => {
    expect(sanitizeSessionTitle("C:\\Users\\private\\secret-project\\very-long-file-name.ts")).toBe(
      "very-long-file-name.ts",
    );
    expect(sanitizeSessionTitle("x".repeat(40))).toHaveLength(36);
  });

  it("uses safe project and stable anonymous fallbacks without session IDs", () => {
    expect(resolveSessionTitle({ projectLabel: "Desktop pet", fallbackNumber: 2 })).toBe(
      "Desktop pet",
    );
    expect(
      resolveSessionTitle({ privacy: "project-only", title: "Secret prompt", fallbackNumber: 2 }),
    ).toBe("Codex Session 2");
    expect(
      resolveSessionTitle({ privacy: "anonymous", title: "Secret prompt", fallbackNumber: 2 }),
    ).toBe("Codex Session 2");
  });
});
