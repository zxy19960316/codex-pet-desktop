export interface UserInputOption {
  id: string;
  label: string;
  description?: string;
}

export interface UserInputQuestion {
  id: string;
  header?: string;
  prompt: string;
  options: UserInputOption[];
  allowFreeText: boolean;
  multiSelect: boolean;
  required: boolean;
  secret: boolean;
}

export interface UserInputRequest {
  requestId: string;
  threadId: string;
  turnId?: string;
  itemId?: string;
  questions: UserInputQuestion[];
  receivedAt: number;
  expiresAt?: number;
  sourceMethod: string;
  isMock: boolean;
  submitting?: boolean;
}

export interface UserInputAnswer {
  questionId: string;
  selectedOptionIds?: string[];
  freeText?: string;
}

export interface UserInputAnswers {
  answers: UserInputAnswer[];
}

export interface ToolRequestUserInputResponse {
  answers: Record<string, { answers: string[] }>;
}
