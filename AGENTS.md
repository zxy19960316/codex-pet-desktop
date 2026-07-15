# Repository instructions

## General

- Work incrementally and preserve existing behavior.
- Do not copy code or assets from Clawd on Desk, AgentPet, or Codex PokéPets.
- Do not add Pokémon artwork or other copyrighted character assets.
- Keep user pet assets in Git-ignored local directories.
- Never commit credentials, access tokens, cookies, session files, or private logs.

## Architecture

- Electron main-process code belongs under src/main.
- Renderer code must not directly access Node.js.
- Codex App Server protocol logic belongs under src/core/codex.
- UI components must consume normalized domain events rather than raw JSON-RPC messages.
- Keep pet state separate from animation rendering.

## Quality gates

Before committing:

1. Run npm run format:check.
2. Run npm run lint.
3. Run npm test.
4. Run npm run build.
5. Inspect git diff.
6. Inspect git status for secrets or local assets.

## Git workflow

- Never force push.
- Never rewrite published history.
- Make focused commits with Conventional Commit messages.
- Push completed milestones to the configured origin.
- Report the branch, commit SHA, remote URL, and test results.
