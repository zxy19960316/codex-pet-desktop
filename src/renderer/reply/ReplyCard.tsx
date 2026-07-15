import { useEffect, useState } from "react";
import type { UserInputRequest } from "../../core/input/input-types";
import { ReplyQuestion } from "./ReplyQuestion";
import { createReplyDraft, validateReplyDraft, type ReplyDraft } from "./reply-view-model";

export function ReplyCard({
  request,
  queueSize,
  verificationLabel,
}: {
  request: UserInputRequest;
  queueSize: number;
  verificationLabel?: string;
}) {
  const [draft, setDraft] = useState<ReplyDraft>(() => createReplyDraft(request));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const expired = Boolean(request.expiresAt && request.expiresAt <= Date.now());
  useEffect(() => {
    setDraft(createReplyDraft(request));
    setSending(false);
    setError(undefined);
  }, [request.requestId]);
  const submit = async () => {
    const result = validateReplyDraft(request, draft);
    if (!result.answers) return setError(result.error ?? "Invalid answer");
    setSending(true);
    setError(undefined);
    try {
      await window.codexPet.respondUserInput(request.requestId, result.answers);
    } catch (reason) {
      setSending(false);
      setError(reason instanceof Error ? reason.message : "Reply could not be sent");
    }
  };
  return (
    <section className="panel reply-card no-drag" aria-label="User input request">
      <div className="panel-title">
        <span>{verificationLabel ?? (request.isMock ? "Mock request" : "Reply requested")}</span>
        <small>{queueSize > 1 ? `1 of ${queueSize}` : request.threadId.slice(0, 8)}</small>
      </div>
      {expired ? <p className="unavailable">This request has expired.</p> : null}
      {request.questions.map((question) => (
        <ReplyQuestion
          key={question.id}
          question={question}
          answer={draft[question.id]}
          disabled={sending || expired}
          onChange={(answer) => setDraft((current) => ({ ...current, [question.id]: answer }))}
          onSubmit={() => void submit()}
        />
      ))}
      {error && <p className="reply-error">{error}</p>}
      <div className="approval-actions">
        <button
          disabled={sending || expired}
          onClick={() => void window.codexPet.cancelUserInput(request.requestId)}
        >
          Cancel
        </button>
        <button className="primary" disabled={sending || expired} onClick={() => void submit()}>
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </section>
  );
}
