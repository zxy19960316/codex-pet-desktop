import type { ApprovalRequest } from "../../core/codex/approval-router";
import { approvalDecisionOptions, summarizePaths } from "./approval-view-model";

export function ApprovalCard({
  request,
  queueSize,
  verificationLabel,
}: {
  request: ApprovalRequest;
  queueSize: number;
  verificationLabel?: string;
}) {
  const paths = summarizePaths(request.paths);
  return (
    <section className="panel approval-card no-drag" aria-label="Approval request">
      <div className="panel-title">
        <span>{verificationLabel ?? request.title}</span>
        <small>{queueSize > 1 ? `1 of ${queueSize}` : "Action required"}</small>
      </div>
      {request.reason && <p>{request.reason}</p>}
      {request.networkTargets?.length ? (
        <div>
          <strong>Network targets</strong>
          <ul>
            {request.networkTargets.map((target) => (
              <li key={target}>{target}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {paths.visible.length ? (
        <div>
          <strong>Affected paths</strong>
          <ul>
            {paths.visible.map((path) => (
              <li key={path}>{path}</li>
            ))}
          </ul>
          {paths.remaining > 0 && <small>+{paths.remaining} more path(s)</small>}
        </div>
      ) : null}
      {request.command && (
        <details>
          <summary>Command details</summary>
          <code>{request.command}</code>
          {request.cwd && <small>Working directory: {request.cwd}</small>}
        </details>
      )}
      <div className="approval-actions">
        {approvalDecisionOptions(request).map((option) => (
          <button
            className={option.primary ? "primary" : ""}
            key={option.decision}
            onClick={() => void window.codexPet.respondApproval(request.requestId, option.decision)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
