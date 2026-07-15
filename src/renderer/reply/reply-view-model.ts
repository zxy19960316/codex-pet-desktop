import type {
  UserInputAnswers,
  UserInputQuestion,
  UserInputRequest,
} from "../../core/input/input-types";

export interface ReplyDraftAnswer {
  selectedOptionIds: string[];
  freeText: string;
}

export type ReplyDraft = Record<string, ReplyDraftAnswer>;

export function createReplyDraft(request: UserInputRequest): ReplyDraft {
  return Object.fromEntries(
    request.questions.map((question) => [question.id, { selectedOptionIds: [], freeText: "" }]),
  );
}

function questionAnswer(
  question: UserInputQuestion,
  answer: ReplyDraftAnswer | undefined,
): string | undefined {
  if (!answer) return question.required ? "A required question has no answer" : undefined;
  if (!question.multiSelect && answer.selectedOptionIds.length > 1) return "Choose only one option";
  if (answer.selectedOptionIds.some((id) => !question.options.some((option) => option.id === id)))
    return "Choose an offered option";
  if (answer.freeText.trim() && !question.allowFreeText) return "Free text is not available";
  if (question.required && !answer.selectedOptionIds.length && !answer.freeText.trim())
    return "This question is required";
  return undefined;
}

export function validateReplyDraft(
  request: UserInputRequest,
  draft: ReplyDraft,
): { answers?: UserInputAnswers; error?: string } {
  for (const question of request.questions) {
    const error = questionAnswer(question, draft[question.id]);
    if (error) return { error };
  }
  return {
    answers: {
      answers: request.questions.map((question) => ({
        questionId: question.id,
        selectedOptionIds: draft[question.id]?.selectedOptionIds ?? [],
        freeText: draft[question.id]?.freeText.trim() || undefined,
      })),
    },
  };
}

export function isSubmitShortcut(key: string, shiftKey: boolean): boolean {
  return key === "Enter" && !shiftKey;
}
