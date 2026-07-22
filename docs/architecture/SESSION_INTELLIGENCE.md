# Session Intelligence

M4.1 gives the desktop one neutral session view. The Registry merges three bounded sources: optional Codex App Server control events, trusted lifecycle Hook events, and local JSONL-safe telemetry. It never reads prompts, message bodies, tool input/output, cwd, or JSONL paths for session presentation.

Records merge by session ID with monotonic state timestamps. App Server owns select/interrupt/steer capability; approval and input states have higher attention priority; closed is terminal until a later session-start event. Output ordering is attention, active state, recent activity, then ID, and the desktop snapshot is capped at 20 summaries.

Titles come only from an already supplied thread title, safe project label, or stable `Codex Session N` fallback. Control characters, paths, excess length, and raw identifiers are not used as visible fallbacks. The resolver supports safe-title, project-only, and anonymous policy modes.

Session and turn elapsed time are wall-clock views. Active work advances only between observations, is capped at 90 seconds per observation, and never goes negative on clock rollback or sleep. Daily activity storage contains only schema version, local date, and a bounded aggregate; it contains no session ID, title, path, prompt, or timeline. Concurrent future ledger updates must use interval union, not session-duration sums.

`AttentionArbiter` is pure: waiting input, approval, error, multi-session activity, working, thinking, success, idle, offline. It provides the primary state, concurrency count, presentation hint, and limited secondary sessions. The existing pet state machine remains compatible, while later Behavior Director and Session Mini Panel work must consume `DesktopSnapshot.sessionOverview` rather than raw source events.

This milestone deliberately does not add a Behavior Director, new animation, sound, growth/token system, MCP, alternate provider, cloud sync, AI title generation, transcript reading, or a Session Mini Panel.
