import { describe, expect, it } from "vitest";
import { redactValue } from "../src/core/logging/redaction";

describe("redactValue", () => {
  it("removes credential fields, bearer values, and sensitive payload bodies", () => {
    const value = redactValue({
      token: "secret",
      cookie: "session=secret",
      authorization: "Bearer secret",
      commandOutput: "private output",
      fileContent: "private file",
      message: "full user message",
      safe: "connected",
    });
    expect(value).toEqual({
      token: "[REDACTED]",
      cookie: "[REDACTED]",
      authorization: "[REDACTED]",
      commandOutput: "[REDACTED]",
      fileContent: "[REDACTED]",
      message: "[REDACTED]",
      safe: "connected",
    });
  });
});
