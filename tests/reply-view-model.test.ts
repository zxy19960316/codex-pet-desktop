import { describe, expect, it } from "vitest";
import {
  createReplyDraft,
  isSubmitShortcut,
  validateReplyDraft,
} from "../src/renderer/reply/reply-view-model";
import type { UserInputRequest } from "../src/core/input/input-types";

const request: UserInputRequest = {
  requestId: "mock-1",
  threadId: "thread-a",
  questions: [
    {
      id: "one",
      prompt: "Choose",
      options: [{ id: "Yes", label: "Yes" }],
      allowFreeText: false,
      multiSelect: false,
      required: true,
      secret: false,
    },
  ],
  receivedAt: 1,
  sourceMethod: "mock",
  isMock: true,
};

describe("reply view model", () => {
  it("requires answers and returns a renderer-safe domain payload", () => {
    const draft = createReplyDraft(request);
    expect(validateReplyDraft(request, draft).error).toBe("This question is required");
    draft.one.selectedOptionIds = ["Yes"];
    expect(validateReplyDraft(request, draft).answers).toEqual({
      answers: [{ questionId: "one", selectedOptionIds: ["Yes"], freeText: undefined }],
    });
  });

  it("models Enter send and Shift+Enter newline intent", () => {
    expect(isSubmitShortcut("Enter", false)).toBe(true);
    expect(isSubmitShortcut("Enter", true)).toBe(false);
  });
});
