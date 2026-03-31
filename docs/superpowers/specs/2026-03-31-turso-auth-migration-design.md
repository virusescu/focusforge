# FocusForge: Turso Cloud Migration + Google OAuth

**Date:** 2026-03-31
**Status:** Approved

## Overview

Migrate FocusForge from local SQLite (via `@tauri-apps/plugin-sql`) to Turso (cloud-hosted SQLite over HTTP) and add multi-user support via Google OAuth. Architecture is direct client-to-Turso with no backend layer.

## Goals

- All user data stored in Turso cloud database (no local SQLite)
- Users authenticate via Google OAuth
- Multiple users supported with data isolation via `user_id` filtering
- Open registration — any Google account can sign in
- Existing local data is not migrated (fresh start for all users)

## Non-Goals

- Offline-first / local replica
- Backend API layer
- Email/password auth
- Migration of existing local data
- Admin panel for user management

## Architecture

```
Tauri App (React frontend)
  ├── Google OAuth (system browser + localhost callback)
  ├── @libsql/client → Turso (HTTP)
  └── Local token storage (refresh token persistence)
```

Direct client-to-Turso. The Turso auth token is embedded in the app. This is acceptable because the user base is small and trusted (~1-5 people).

## Auth Flow

1. App launches → `AuthProvider` checks for stored auth token in local app data
2. No token → render `LoginScreen` with "Sign in with Google" button
3. User clicks → `shell.open()` opens system browser to Google OAuth consent URL
4. User authenticates → Google redirects to `http://localhost:<port>/callback` with authorization code
5. App exchanges auth code for ID token + refresh token via Google's token endpoint
6. App extracts user info from ID token: `sub` (unique ID), `email`, `name`, `picture`
7. App upserts user in Turso `users` table (keyed on `google_sub`)
8. App stores refresh token locally (via `@tauri-apps/plugin-store` or JSON file in app data dir)
9. On subsequent launches: use stored refresh token to get a fresh ID token silently — no browser popup
10. Logout: clear stored token, return to `LoginScreen`

### OAuth Details

- **Provider:** Google Identity Platform
- **Flow:** Authorization Code (with PKCE for desktop apps)
- **Redirect URI:** `http://localhost:<dynamic-port>/callback`
- **Scopes:** `openid email profile`
- **Credentials needed:** Google Cloud OAuth Client ID + Client Secret
- **Token storage:** Local file in Tauri app data directory

### Localhost Callback Listener

The app spins up a temporary HTTP server on a random available port before opening the browser. This server:
- Listens for the OAuth callback
- Extracts the authorization code from query params
- Exchanges it for tokens
- Shuts down immediately after

This is the standard approach for desktop OAuth and is supported by Google for "Desktop app" OAuth client types.

## Data Model

### New Table: `users`

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Modified Table: `user_settings`

```sql
CREATE TABLE user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  debug_speed REAL DEFAULT 1.0,
  experience_lvl INTEGER DEFAULT 42,
  day_start_hour INTEGER DEFAULT 8,
  day_end_hour INTEGER DEFAULT 2,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

`name`, `email`, and `avatar_url` move to the `users` table (sourced from Google). `user_settings` retains app-specific preferences only.

### Modified Table: `focus_sessions`

```sql
CREATE TABLE focus_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  date TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Modified Table: `objectives`

```sql
CREATE TABLE objectives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sort_order INTEGER DEFAULT 0,
  completed_at TEXT,
  category_id INTEGER REFERENCES objective_categories(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Modified Table: `objective_categories`

```sql
CREATE TABLE objective_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Unchanged Table: `session_pauses`

```sql
CREATE TABLE session_pauses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  pause_time TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES focus_sessions(id)
);
```

No `user_id` needed — already scoped via `session_id` foreign key.

## Tech Stack Changes

### Remove

- `@tauri-apps/plugin-sql` (npm package)
- `tauri-plugin-sql` (Rust crate in Cargo.toml)
- Local SQLite database file

### Add

- `@libsql/client` — Turso's HTTP client for JavaScript
- OAuth localhost callback listener (Rust-side or JS-side HTTP server)
- `@tauri-apps/plugin-store` or equivalent for persisting auth tokens locally
- `@tauri-apps/plugin-shell` — for opening system browser (may already be available)

### Turso Connection

```typescript
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,   // libsql://focusforge-<org>.turso.io
  authToken: process.env.TURSO_AUTH_TOKEN, // read-write token
});
```

Credentials stored in `.env` file, loaded at build time via Vite's `import.meta.env`.

## App Structure Change

### Current

```
main.tsx → UserProvider → FocusProvider → App
```

### New

```
main.tsx → AuthProvider → (logged in?) → UserProvider → FocusProvider → App
                        → (not logged in?) → LoginScreen
```

`AuthProvider` wraps everything and gates access. The existing `UserProvider` changes to source user data from the `users` table (populated by Google profile) instead of the local `user_settings` single-row pattern.

## Query Changes

Every query in `db.ts` that currently operates on all rows will be scoped by `user_id`. Examples:

```sql
-- Before
SELECT * FROM focus_sessions ORDER BY start_time DESC LIMIT ?

-- After
SELECT * FROM focus_sessions WHERE user_id = ? ORDER BY start_time DESC LIMIT ?
```

The current user's `id` (from the `users` table) is passed through React context and provided to all db functions.

## TypeScript Type Changes

```typescript
// New
interface AuthUser {
  id: number;           // from users table
  google_sub: string;
  email: string;
  name: string;
  avatar_url?: string;
}

// Modified — remove name/email/avatar (now on AuthUser)
interface UserSettings {
  id: number;
  user_id: number;
  debug_speed: number;
  experience_lvl: number;
  day_start_hour: number;
  day_end_hour: number;
}
```

## Login Screen

Minimal screen matching the existing HUD/cyberpunk aesthetic:
- App logo/title
- "Sign in with Google" button
- No other options or form fields

## Settings Modal Changes

- `name` and `email` fields become read-only (sourced from Google profile)
- Avatar comes from Google profile picture (replace Gravatar logic)
- `debug_speed`, `experience_lvl`, `day_start_hour`, `day_end_hour` remain editable
- Add "Sign out" button

## Environment Variables

```env
VITE_TURSO_DATABASE_URL=libsql://focusforge-<org>.turso.io
VITE_TURSO_AUTH_TOKEN=<read-write-token>
VITE_GOOGLE_CLIENT_ID=<google-oauth-client-id>
VITE_GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
```

Stored in `.env` (gitignored). Loaded via Vite's `import.meta.env.VITE_*` at build time.

## Testing Strategy

- Mock `@libsql/client` the same way `@tauri-apps/plugin-sql` is currently mocked
- Auth flow tested with mocked Google responses
- All db functions tested with `user_id` parameter
- Existing tests updated to pass `user_id` where needed

## Security Notes

- Turso auth token is embedded in the built app — acceptable for trusted small group
- Google OAuth Client Secret is embedded at build time — acceptable for desktop apps (Google documents this as expected for "Desktop" app type)
- User data isolation is enforced at the query level (`WHERE user_id = ?`), not at the database level
- No sensitive data beyond focus session times and task text
