# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent instructions (read first)

Follow [`AGENTS.md`](AGENTS.md). In short:

- **Before exploring the code**, read the relevant doc in `docs/`: `architecture.md` (contexts, components, events, shortcuts), `database.md` (schema, migrations), `economy.md` (coins, streaks, prestige, seasons), `release.md` (scripts, CI, updates).
- **After any major change** (architecture, schema, economy rules, release pipeline, shortcuts, user-visible features), update the matching doc in the same change, and tell the user which docs you updated.

## Project Overview

FocusForge is a desktop productivity app — a precision focus timer with a light scoring layer (coins as a score, streaks, prestige ranks, seasonal resets). Built with **Tauri 2** (Rust backend) + **React 19** + **TypeScript** frontend, using **Turso** (LibSQL) for cloud database and **Google OAuth** for authentication.

## Commands

| Task | Command |
|------|---------|
| Dev (browser) | `npm run dev` |
| Dev (desktop) | `npm run tauri dev` |
| Build frontend | `npm run build` (runs `tsc -b && vite build`) |
| Build desktop app | `npx tauri build` |
| Run tests | `npm test` |
| Watch tests | `npm run test:watch` |
| Lint | `npm run lint` |
| Debug binary (no installer) | `npx tauri build --debug --no-bundle` → `src-tauri/target/debug/app.exe` |
| Set version | `.\set_version.bat <major.minor.patch>` (updates package.json, Cargo.toml, tauri.conf.json) |
| Deploy release | `.\deploy_release.bat` (bumps version, tags, pushes; CI builds and signs) |

## Architecture

### Frontend (`src/`)

**5 React Contexts** drive all state (provider order: Auth → User → Focus → Game → Alarm):
- **AuthContext** — Google OAuth login/logout, token storage via Tauri plugin-store, Turso DB init on login
- **FocusContext** — Timer state, focus sessions, objectives pool, categories. Uses `useTimer` hook
- **GameContext** — Active season, coins (score only, no spending), streaks, daily challenge, prestige titles, `+N` coin flash
- **UserContext** — User settings and profile
- **AlarmContext** — Recurring alarms, overlay, snooze

Focus → Game communication goes through `window` CustomEvents (`timer-saved`, `objective-neutralized`); see `docs/architecture.md`.

**Database layer** (`src/db.ts`) — ~45 async functions over 15 tables (sessions, objectives, categories, game state, coin transactions, prestige, season archives, alarms, etc.). Schema and migrations: `docs/database.md`.

**Game economy** (`src/utils/gameEconomy.ts`) — Pure calculation functions with no side effects. Session rewards use base rate (1 coin/min) with duration milestones, pause penalties, streak multipliers and the daily challenge bonus. Formulas: `docs/economy.md`. Contexts call these to compute rewards before writing to DB.

**Audio** (`src/utils/audio.ts`) — All sounds synthesized via Web Audio API, no external audio assets.

### Rust Backend (`src-tauri/src/`)

- `main.rs` — Entry point (no console window on release)
- `lib.rs` — Tauri plugin setup: shell, store, updater, log (debug only)
- `oauth.rs` — Localhost HTTP server for Google OAuth callback (`get_available_port` + `wait_for_oauth_callback`)

### OTA Updates

Tauri updater plugin checks `update.json` on GitHub raw master on startup. Releases built and signed via GitHub Actions on `v*` tag push (`.github/workflows/release.yml`); CI then commits a new `update.json` to master, so pull after releasing. Details: `docs/release.md`.

## Key Patterns

- **Context + custom hook** pattern: each context has a provider and a `useX()` hook that throws if used outside the provider (exception: `useGame()` returns safe defaults)
- **Pure economy functions**: `gameEconomy.ts` functions take typed inputs, return typed outputs, no DB calls — test these in isolation
- **DB functions**: all async, use `getDb()` for active client, prepared statements, return types matching TS interfaces
- **Keyboard shortcuts**: Space (start/pause), Escape (reset), Ctrl+Enter (neutralize objective), A/I/V (toggle views)

## Testing

Vitest + React Testing Library + jsdom. Test files co-located with source (`*.test.ts(x)`). Key test files:
- `src/utils/gameEconomy.test.ts` — comprehensive economy calculation tests
- `src/contexts/FocusContext.test.tsx`, `UserContext.test.tsx`
- `src/hooks/useTimer.test.ts`, `useCanvasNotes.test.ts`
- `src/db.test.ts`

## Environment Variables (`.env`, git-ignored)

```
VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_CLIENT_SECRET=...
TAURI_SIGNING_PRIVATE_KEY=...         # for release builds
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=...
```

## Versioning

Version lives in three places kept in sync by `set_version.bat`: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`. CI triggers on `v*` tags pushed to GitHub.
