# AGENTS.md

Instructions for any AI coding agent (Claude Code, Gemini, Copilot, Cursor, Codex, …)
working in this repository.

## 1. Read the docs before exploring the code

Project documentation lives in `docs/`. Read the relevant file **before** you
grep through the source. It is faster, and it explains decisions the code alone
doesn't.

| If the task touches… | Read first |
|---|---|
| App structure, contexts, components, events, startup/auth, keyboard shortcuts | [`docs/architecture.md`](docs/architecture.md) |
| Tables, columns, queries, migrations, time zones, legacy columns | [`docs/database.md`](docs/database.md) |
| Coins, multipliers, daily challenge, streaks, prestige, seasons | [`docs/economy.md`](docs/economy.md) |
| Scripts, versioning, signing, CI, OTA updates, environment variables | [`docs/release.md`](docs/release.md) |
| Setup and the feature overview | [`README.md`](README.md) |
| Future ideas and plans | `docs/IDEAS.md`, `docs/mobileApp-ImplementationPlan.md` |

Treat the docs as a map, not as ground truth. If the docs and the code
disagree, the code wins: fix the doc as part of your change (see §2).

## 2. Keep the docs up to date

When you make a **major change**, update the matching doc **in the same change
or commit**. Don't leave it for later. A major change is any of these:

- **Architecture:** adding, removing or renaming a context, view, top-level component, hook, window event, Tauri command or plugin → `docs/architecture.md`
- **Database:** a new or dropped table or column, a new migration, changed query semantics → `docs/database.md`
- **Economy:** any change to a formula, multiplier, threshold, streak rule, season rule or prestige title, or adding or removing a game feature → `docs/economy.md` (keep the "Removed features" list current)
- **Release:** changes to the build scripts (`*.bat`, `cmds/*.ps1`), the CI workflow, updater config, signing, required env vars or secrets → `docs/release.md`
- **Shortcuts:** a new or changed keyboard shortcut → the shortcut tables in `docs/architecture.md` and `README.md`
- **Features:** a user-visible feature added or removed → `README.md` "Key Features", plus the status list in `docs/IDEAS.md`

Small fixes, refactors that keep the behaviour the same, styling tweaks and
test-only changes don't need doc updates.

When you update the docs:

- Edit the existing section rather than appending a changelog entry. The docs describe the **current** state.
- Never put real credentials, tokens or keys in the docs. Use variable names only.
- If you notice an existing doc is wrong while you work, fix it, even if your task didn't cause the problem.
- In your summary to the user, say which docs you updated.

## 3. Project essentials

- **Stack:** Tauri 2 (Rust) + React 19 + TypeScript + Vite 8, Turso (LibSQL) cloud DB, Google OAuth.
- **Commands:** `npm run tauri dev` (dev), `npm test`, `npm run lint`, `npm run build`; for a debug binary without installers, `npx tauri build --debug --no-bundle`.
- **Tests** sit next to the source (`*.test.ts(x)`). Run `npm test` after changing logic, and update or add tests when you change behaviour.
- **Line endings:** the repo uses CRLF (`core.autocrlf=true`). Keep the existing line endings when you edit files.
- **Never commit** `.env`, `*.key` or anything under `src-tauri/target/`.
- **Versioning and releases** go through `set_version.bat` and `deploy_release.bat`. Don't bump versions or push tags unless asked.
