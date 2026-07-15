export function ReplyTextArea({
  value,
  secret,
  onChange,
  onSubmit,
}: {
  value: string;
  secret: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <textarea
      aria-label="Reply text"
      className="reply-textarea"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          onSubmit();
        }
      }}
      placeholder={secret ? "Sensitive answer" : "Type your answer"}
    />
  );
}
