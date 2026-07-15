import type {
  ToolRequestUserInputResponse,
  UserInputAnswers,
  UserInputOption,
  UserInputQuestion,
  UserInputRequest,
} from "./input-types";

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function string(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function boolean(value: unknown): boolean {
  return value === true;
}

function normalizeOptions(value: unknown): UserInputOption[] {
  if (value === null) return [];
  if (!Array.isArray(value)) throw new Error("User-input options must be an array or null");
  const seen = new Set<string>();
  return value.map((candidate) => {
    const option = record(candidate);
    const label = string(option?.label);
    if (!option || !label || seen.has(label))
      throw new Error("Invalid or duplicate user-input option");
    seen.add(label);
    return { id: label, label, description: string(option.description) };
  });
}

function normalizeQuestion(value: unknown): UserInputQuestion {
  const question = record(value);
  const id = string(question?.id);
  const prompt = string(question?.question);
  if (!question || !id || !prompt) throw new Error("Invalid user-input question");
  const options = normalizeOptions(question.options);
  return {
    id,
    header: string(question.header),
    prompt,
    options,
    allowFreeText: boolean(question.isOther) || options.length === 0,
    // The generated protocol has no multiselect flag. Real requests therefore default to one
    // choice; mock requests may opt in to multiple selections through their domain model.
    multiSelect: false,
    required: true,
    secret: boolean(question.isSecret),
  };
}

export function normalizeUserInputRequest(
  requestId: string | number,
  sourceMethod: string,
  rawParams: unknown,
  now = Date.now(),
): UserInputRequest {
  const params = record(rawParams);
  const threadId = string(params?.threadId);
  const turnId = string(params?.turnId);
  const itemId = string(params?.itemId);
  if (!params || !threadId || !turnId || !itemId || !Array.isArray(params.questions))
    throw new Error("Invalid user-input request");
  const seen = new Set<string>();
  const questions = params.questions.map(normalizeQuestion);
  if (
    !questions.length ||
    questions.some((question) => seen.has(question.id) || !seen.add(question.id))
  )
    throw new Error("User-input requests need unique questions");
  const timeout = typeof params.autoResolutionMs === "number" ? params.autoResolutionMs : null;
  return {
    requestId: String(requestId),
    threadId,
    turnId,
    itemId,
    questions,
    receivedAt: now,
    expiresAt: timeout && Number.isFinite(timeout) && timeout > 0 ? now + timeout : undefined,
    sourceMethod,
    isMock: false,
  };
}

export function validateAndSerializeUserInputAnswers(
  request: UserInputRequest,
  candidate: UserInputAnswers,
): ToolRequestUserInputResponse {
  if (!candidate || !Array.isArray(candidate.answers)) throw new Error("Invalid user-input answer");
  const submitted = new Map<string, (typeof candidate.answers)[number]>();
  for (const answer of candidate.answers) {
    if (!answer || typeof answer.questionId !== "string" || submitted.has(answer.questionId))
      throw new Error("Invalid or duplicate user-input answer");
    submitted.set(answer.questionId, answer);
  }
  const answers: ToolRequestUserInputResponse["answers"] = {};
  for (const question of request.questions) {
    const answer = submitted.get(question.id);
    if (!answer) {
      if (question.required) throw new Error("A required question has no answer");
      continue;
    }
    const selected = answer.selectedOptionIds ?? [];
    if (!Array.isArray(selected) || selected.some((id) => typeof id !== "string"))
      throw new Error("Invalid selected option");
    if (!question.multiSelect && selected.length > 1)
      throw new Error("Only one option may be selected");
    const allowed = new Set(question.options.map((option) => option.id));
    if (selected.some((id) => !allowed.has(id))) throw new Error("An option was not offered");
    const freeText = typeof answer.freeText === "string" ? answer.freeText.trim() : undefined;
    if (freeText && !question.allowFreeText) throw new Error("Free text was not offered");
    const values = [...selected, ...(freeText ? [freeText] : [])];
    if (question.required && !values.length) throw new Error("A required question has no answer");
    answers[question.id] = { answers: values };
  }
  if (submitted.size !== request.questions.length)
    throw new Error("Unknown user-input answer question");
  return { answers };
}
