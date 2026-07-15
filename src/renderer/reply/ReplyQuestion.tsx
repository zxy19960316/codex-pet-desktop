import type { UserInputQuestion } from "../../core/input/input-types";
import { ReplyTextArea } from "./ReplyTextArea";
import type { ReplyDraftAnswer } from "./reply-view-model";

export function ReplyQuestion({
  question,
  answer,
  disabled,
  onChange,
  onSubmit,
}: {
  question: UserInputQuestion;
  answer: ReplyDraftAnswer;
  disabled: boolean;
  onChange: (answer: ReplyDraftAnswer) => void;
  onSubmit: () => void;
}) {
  const select = (id: string, checked: boolean) => {
    const selectedOptionIds = question.multiSelect
      ? checked
        ? [...answer.selectedOptionIds, id]
        : answer.selectedOptionIds.filter((value) => value !== id)
      : checked
        ? [id]
        : [];
    onChange({ ...answer, selectedOptionIds });
  };
  return (
    <fieldset className="reply-question" disabled={disabled}>
      <legend>
        {question.header && <small>{question.header}</small>}
        {question.prompt}
      </legend>
      {question.options.map((option) => (
        <label className="reply-option" key={option.id}>
          <input
            type={question.multiSelect ? "checkbox" : "radio"}
            name={question.id}
            checked={answer.selectedOptionIds.includes(option.id)}
            onChange={(event) => select(option.id, event.target.checked)}
          />
          <span>{option.label}</span>
          {option.description && <small>{option.description}</small>}
        </label>
      ))}
      {question.allowFreeText && (
        <ReplyTextArea
          value={answer.freeText}
          secret={question.secret}
          onChange={(freeText) => onChange({ ...answer, freeText })}
          onSubmit={onSubmit}
        />
      )}
    </fieldset>
  );
}
