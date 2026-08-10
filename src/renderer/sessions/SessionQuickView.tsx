import type { DesktopSnapshot } from "../../shared/ipc-contract";
import { buildSessionPresentation } from "./session-view-model";

export function SessionQuickView({ snapshot }: { snapshot: DesktopSnapshot }) {
  const presentation = buildSessionPresentation(snapshot, 3);
  return (
    <aside className="session-quick-view" aria-label="当前会话速览" aria-live="polite">
      <header>
        <strong>当前会话 {presentation.totalCount}</strong>
        <span>活跃 {presentation.activeCount}</span>
      </header>
      {presentation.items.length ? (
        <ul>
          {presentation.items.map((session) => (
            <li key={session.sessionId} data-session-state={session.state}>
              <span className="session-quick-view__dot" aria-hidden="true" />
              <span className="session-quick-view__title" title={session.title}>
                {session.shortTitle}
              </span>
              <small>{session.stateLabel}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p>暂无可显示的会话</p>
      )}
      {presentation.totalCount > presentation.items.length ? (
        <footer>另有 {presentation.totalCount - presentation.items.length} 个会话</footer>
      ) : null}
    </aside>
  );
}
