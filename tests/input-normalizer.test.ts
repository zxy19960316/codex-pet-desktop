import { describe, expect, it } from "vitest";
import {
  normalizeUserInputRequest,
  validateAndSerializeUserInputAnswers,
} from "../src/core/input/input-normalizer";

const realParams = {
  threadId: "thread-a",
  turnId: "turn-a",
  itemId: "item-a",
  autoResolutionMs: 1_000,
  questions: [
    {
      id: "format",
      header: "Compatibility",
      question: "Which format?",
      isOther: true,
      isSecret: false,
      options: [{ label: "Modern", description: "Current format" }],
    },
    {
      id: "notes",
      header: "Notes",
      question: "Add context",
      isOther: false,
      isSecret: false,
      options: null,
    },
  ],
};

describe("user-input normalizer", () => {
  it("normalizes the locally generated App Server request shape", () => {
    expect(
      normalizeUserInputRequest("rpc-1", "item/tool/requestUserInput", realParams, 10),
    ).toMatchObject({
      requestId: "rpc-1",
      threadId: "thread-a",
      turnId: "turn-a",
      itemId: "item-a",
      expiresAt: 1_010,
      questions: [
        { id: "format", allowFreeText: true, options: [{ id: "Modern" }] },
        { id: "notes", allowFreeText: true, options: [] },
      ],
    });
  });

  it("rejects missing protocol fields and malformed options", () => {
    expect(() => normalizeUserInputRequest("x", "item/tool/requestUserInput", {})).toThrow(
      "Invalid",
    );
    expect(() =>
      normalizeUserInputRequest("x", "item/tool/requestUserInput", {
        ...realParams,
        questions: [{ ...realParams.questions[0], options: [{ label: "", description: "x" }] }],
      }),
    ).toThrow("Invalid");
  });

  it("serializes only validated domain answers into the generated response shape", () => {
    const request = normalizeUserInputRequest(
      "rpc-1",
      "item/tool/requestUserInput",
      realParams,
      10,
    );
    expect(
      validateAndSerializeUserInputAnswers(request, {
        answers: [
          { questionId: "format", selectedOptionIds: ["Modern"], freeText: "Extra" },
          { questionId: "notes", freeText: "Context" },
        ],
      }),
    ).toEqual({
      answers: {
        format: { answers: ["Modern", "Extra"] },
        notes: { answers: ["Context"] },
      },
    });
    expect(() =>
      validateAndSerializeUserInputAnswers(request, {
        answers: [
          { questionId: "format", selectedOptionIds: ["Unknown"] },
          { questionId: "notes", freeText: "Context" },
        ],
      }),
    ).toThrow("not offered");
  });
});
