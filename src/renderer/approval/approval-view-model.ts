import type { ApprovalDecision, ApprovalRequest } from "../../core/codex/approval-router";

const LABELS: Readonly<Record<ApprovalDecision, string>> = {
  accept: "Allow",
  acceptForSession: "Allow for session",
  decline: "Deny",
  cancel: "Cancel",
};

export interface ApprovalDecisionOption {
  decision: ApprovalDecision;
  label: string;
  primary: boolean;
}

export function approvalDecisionOptions(request: ApprovalRequest): ApprovalDecisionOption[] {
  return request.availableDecisions.map((decision) => ({
    decision,
    label: LABELS[decision],
    primary: decision === "accept",
  }));
}

export function summarizePaths(
  paths: string[] | undefined,
  limit = 5,
): {
  visible: string[];
  remaining: number;
} {
  const values = paths ?? [];
  return { visible: values.slice(0, limit), remaining: Math.max(0, values.length - limit) };
}
