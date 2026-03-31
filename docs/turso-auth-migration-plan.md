# Turso Cloud Migration + Google OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace local SQLite with Turso cloud database and add Google OAuth login so multiple users can use FocusForge across devices.

**Architecture:** Direct client-to-Turso via `@libsql/client` over HTTP. Google OAuth with localhost callback for desktop auth flow. Auth state managed via `AuthContext` wrapping the existing provider hierarchy. All queries scoped by `user_id`.

**Tech Stack:** `@libsql/client`, `@tauri-apps/plugin-shell` (open browser), `@tauri-apps/plugin-store` (persist tokens), Tauri Rust-side HTTP listener for OAuth callback.

---

## File Structure

### New Files
- `src/auth.ts` — OAuth flow logic (build auth URL, exchange code, refresh tokens, localhost listener via Tauri command)
- `src/contexts/AuthContext.tsx` — Auth state provider (current user, login/logout, token management)
- `src/components/LoginScreen.tsx` — Login screen UI
- `src/components/LoginScreen.module.scss` — Login screen styles
- `src-tauri/src/oauth.rs` — Rust-side localhost HTTP listener for OAuth callback

### Modified Files
- `src/db.ts` — Replace `@tauri-apps/plugin-sql` with `@libsql/client`, add `user_id` to all queries, new schema
- `src/db.test.ts` — Update mock and all tests for new client API and `user_id` parameter
- `src/types/index.ts` — Add `AuthUser`, modify `UserSettings`
- `src/contexts/UserContext.tsx` — Source user data from `AuthContext` + `user_settings` table
- `src/contexts/UserContext.test.tsx` — Update for new provider shape
- `src/contexts/FocusContext.tsx` — Pass `user_id` to all db calls
- `src/contexts/FocusContext.test.tsx` — Update mocks
- `src/components/SettingsModal.tsx` — Make name/email read-only, add logout button
- `src/main.tsx` — Wrap with `AuthProvider`, remove `initDb` call from top level
- `src-tauri/Cargo.toml` — Remove `tauri-plugin-sql`, add `tiny_http` for OAuth listener
- `src-tauri/src/lib.rs` — Remove SQL plugin, register OAuth command, add shell-opener plugin
- `src-tauri/capabilities/default.json` — Add shell:open and store permissions
- `package.json` — Remove `@tauri-apps/plugin-sql`, add `@libsql/client`, `@tauri-apps/plugin-shell`, `@tauri-apps/plugin-store`
- `.env` — Create with Turso + Google credentials (gitignored)

---

### Task 1: Install dependencies and configure environment

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/Cargo.toml`
- Create: `.env`

- [ ] **Step 1: Install npm packages**

Run:
```bash
cd C:/Work/focusforge && npm install @libsql/client @tauri-apps/plugin-shell @tauri-apps/plugin-store && npm uninstall @tauri-apps/plugin-sql
```

- [ ] **Step 2: Update Cargo.toml — remove SQL plugin, add tiny_http**

In `src-tauri/Cargo.toml`, replace:
```toml
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
```
with:
```toml
tauri-plugin-shell = "2"
tauri-plugin-store = "2"
tiny_http = "0.12"
```

- [ ] **Step 3: Create `.env` file**

Create `C:/Work/focusforge/.env` with:
```env
VITE_TURSO_DATABASE_URL=libsql://focusforge-virusescu.turso.io
VITE_TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJleHAiOjE5MDE4MDI0NzMsImdpZCI6IjQ3ZjgwMzYwLWU3NDMtNGI4ZC1iYWIyLTM0NzY4MjUxMTRlMSIsImlhdCI6MTc3NDk2NzI3MywicmlkIjoiZTA4MGI0MTktMmE3Zi00ZGQxLTliMDQtOTdjNmRhNDgxZGNiIn0.4yJLAOskls-8MfrCTrTTdWGGKEQED7T4yPbjmu7ZBFvd2FQMKm9bJjoFIqmpEy54e3Rk8vgxc_Lt47iFWYJwBw
VITE_GOOGLE_CLIENT_ID=<placeholder-until-user-creates-oauth-app>
VITE_GOOGLE_CLIENT_SECRET=<placeholder-until-user-creates-oauth-app>
```

Note: The Turso URL above assumes org name `virusescu`. The user should confirm the actual URL from their Turso dashboard. Google OAuth credentials will be filled in after the user creates the Google Cloud project.

- [ ] **Step 4: Verify `.env` is in `.gitignore`**

Check that `.gitignore` contains `.env` (it already does based on exploration — just verify).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src-tauri/Cargo.toml .env
git commit -m "chore: swap deps — remove plugin-sql, add libsql/client + shell + store + tiny_http"
```

**Do NOT commit `.env`** — it's gitignored. The `git add .env` above will be a no-op; that's expected.

---

### Task 2: Rust-side OAuth callback listener + Tauri command

**Files:**
- Create: `src-tauri/src/oauth.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Create `src-tauri/src/oauth.rs`**

```rust
use std::io::Read;
use tauri::command;
use tiny_http::{Server, Response};

#[command]
pub async fn wait_for_oauth_callback(port: u16) -> Result<String, String> {
    let server = Server::http(format!("127.0.0.1:{}", port))
        .map_err(|e| format!("Failed to start OAuth listener: {}", e))?;

    // Wait for one request (with a timeout built into the loop)
    let request = server.recv().map_err(|e| format!("Failed to receive request: {}", e))?;

    let url = request.url().to_string();

    // Extract the authorization code from query params
    let code = url
        .split('?')
        .nth(1)
        .and_then(|query| {
            query.split('&').find_map(|param| {
                let mut parts = param.splitn(2, '=');
                match (parts.next(), parts.next()) {
                    (Some("code"), Some(value)) => Some(value.to_string()),
                    _ => None,
                }
            })
        })
        .ok_or_else(|| "No authorization code in callback".to_string())?;

    // Send a nice HTML response to the browser
    let html = r#"<html><body style="background:#0a0a0a;color:#00ff88;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center">
            <h1>AUTHENTICATION_COMPLETE</h1>
            <p>You can close this tab and return to FocusForge.</p>
        </div>
    </body></html>"#;

    let response = Response::from_string(html)
        .with_header(tiny_http::Header::from_bytes("Content-Type", "text/html").unwrap());
    request.respond(response).map_err(|e| format!("Failed to respond: {}", e))?;

    Ok(code)
}

#[command]
pub fn get_available_port() -> Result<u16, String> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to find available port: {}", e))?;
    let port = listener.local_addr()
        .map_err(|e| format!("Failed to get local addr: {}", e))?
        .port();
    drop(listener);
    Ok(port)
}
```

- [ ] **Step 2: Update `src-tauri/src/lib.rs`**

Replace the entire file:
```rust
mod oauth;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_store::Builder::default().build())
    .invoke_handler(tauri::generate_handler![
      oauth::wait_for_oauth_callback,
      oauth::get_available_port,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Debug)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```

- [ ] **Step 3: Update capabilities**

Replace `src-tauri/capabilities/default.json`:
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "enables the default permissions",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-close",
    "core:window:allow-minimize",
    "core:window:allow-start-dragging",
    "shell:allow-open",
    "store:default"
  ]
}
```

- [ ] **Step 4: Verify Rust compiles**

Run:
```bash
cd C:/Work/focusforge/src-tauri && cargo check
```
Expected: compiles with no errors (warnings are OK).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/oauth.rs src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "feat: add Rust OAuth callback listener and Tauri commands"
```

---

### Task 3: Update types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Update `src/types/index.ts`**

Replace the entire file:
```typescript
import { LOG_MESSAGES } from '../logData';

export interface AuthUser {
  id: number;
  google_sub: string;
  email: string;
  name: string;
  avatar_url?: string;
}

export interface UserSettings {
  id: number;
  user_id: number;
  debug_speed: number;
  experience_lvl: number;
  day_start_hour: number;
  day_end_hour: number;
}

export interface LogEntry {
  id: string;
  time: string;
  msg: string;
  type: string;
}

export type LogCategory = keyof typeof LOG_MESSAGES;

export interface FocusSession {
  id: number;
  start_time: string;
  duration_seconds: number;
  date: string;
  pause_times?: string[];
}

export interface DailyStat {
  date: string;
  totalSeconds: number;
}

export interface ObjectiveCategory {
  id: number;
  label: string;
  color: string;
  sort_order: number;
}

export interface StrategicObjective {
  id: number;
  text: string;
  created_at: string;
  completed_at?: string;
  sort_order?: number;
  category_id?: number | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add AuthUser type, move name/email off UserSettings"
```

---

### Task 4: Rewrite `db.ts` for Turso with `user_id` scoping

**Files:**
- Modify: `src/db.ts`

- [ ] **Step 1: Replace `src/db.ts` entirely**

```typescript
import { createClient, type Client, type InArgs } from '@libsql/client';
import type { FocusSession, DailyStat, StrategicObjective, ObjectiveCategory, AuthUser, UserSettings } from './types';

let db: Client | null = null;

export function getDb(): Client {
  if (db) return db;
  db = createClient({
    url: import.meta.env.VITE_TURSO_DATABASE_URL,
    authToken: import.meta.env.VITE_TURSO_AUTH_TOKEN,
  });
  return db;
}

export async function initDb() {
  const database = getDb();

  await database.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_sub TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      debug_speed REAL DEFAULT 1.0,
      experience_lvl INTEGER DEFAULT 42,
      day_start_hour INTEGER DEFAULT 8,
      day_end_hour INTEGER DEFAULT 2,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS focus_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS objective_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS objectives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sort_order INTEGER DEFAULT 0,
      completed_at TEXT,
      category_id INTEGER REFERENCES objective_categories(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS session_pauses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      pause_time TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES focus_sessions(id)
    )
  `);
}

// ─── User Management ─────────────────────────────────────────────

export async function upsertUser(googleSub: string, email: string, name: string, avatarUrl?: string): Promise<AuthUser> {
  const database = getDb();

  await database.execute({
    sql: `INSERT INTO users (google_sub, email, name, avatar_url)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(google_sub) DO UPDATE SET email = ?, name = ?, avatar_url = ?`,
    args: [googleSub, email, name, avatarUrl ?? null, email, name, avatarUrl ?? null],
  });

  const result = await database.execute({
    sql: 'SELECT * FROM users WHERE google_sub = ?',
    args: [googleSub],
  });

  const row = result.rows[0];
  return {
    id: row.id as number,
    google_sub: row.google_sub as string,
    email: row.email as string,
    name: row.name as string,
    avatar_url: row.avatar_url as string | undefined,
  };
}

// ─── User Settings ───────────────────────────────────────────────

export async function getUserSettings(userId: number): Promise<UserSettings | null> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM user_settings WHERE user_id = ?',
    args: [userId],
  });

  if (result.rows.length === 0) {
    // Create default settings for this user
    await database.execute({
      sql: 'INSERT INTO user_settings (user_id) VALUES (?)',
      args: [userId],
    });
    const created = await database.execute({
      sql: 'SELECT * FROM user_settings WHERE user_id = ?',
      args: [userId],
    });
    const row = created.rows[0];
    return {
      id: row.id as number,
      user_id: row.user_id as number,
      debug_speed: row.debug_speed as number,
      experience_lvl: row.experience_lvl as number,
      day_start_hour: row.day_start_hour as number,
      day_end_hour: row.day_end_hour as number,
    };
  }

  const row = result.rows[0];
  return {
    id: row.id as number,
    user_id: row.user_id as number,
    debug_speed: row.debug_speed as number,
    experience_lvl: row.experience_lvl as number,
    day_start_hour: row.day_start_hour as number,
    day_end_hour: row.day_end_hour as number,
  };
}

export async function updateUserSettings(userId: number, debugSpeed: number, experienceLvl: number, dayStartHour: number, dayEndHour: number) {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE user_settings SET debug_speed = ?, experience_lvl = ?, day_start_hour = ?, day_end_hour = ? WHERE user_id = ?',
    args: [debugSpeed, experienceLvl, dayStartHour, dayEndHour, userId],
  });
}

// ─── Focus Sessions ──────────────────────────────────────────────

export async function saveFocusSession(userId: number, startTime: string, durationSeconds: number, pauseTimes: string[] = []) {
  const database = getDb();
  const date = startTime.split('T')[0];
  const result = await database.execute({
    sql: 'INSERT INTO focus_sessions (user_id, start_time, duration_seconds, date) VALUES (?, ?, ?, ?)',
    args: [userId, startTime, durationSeconds, date],
  });
  const sessionId = result.lastInsertRowid;
  for (const pauseTime of pauseTimes) {
    await database.execute({
      sql: 'INSERT INTO session_pauses (session_id, pause_time) VALUES (?, ?)',
      args: [Number(sessionId), pauseTime],
    });
  }
}

export async function getRecentSessions(userId: number, limit: number = 3): Promise<FocusSession[]> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM focus_sessions WHERE user_id = ? ORDER BY start_time DESC LIMIT ?',
    args: [userId, limit],
  });
  return result.rows.map(row => ({
    id: row.id as number,
    start_time: row.start_time as string,
    duration_seconds: row.duration_seconds as number,
    date: row.date as string,
  }));
}

export async function getDailyFocusStats(userId: number, days: number = 21): Promise<DailyStat[]> {
  const database = getDb();
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  const startDateStr = d.toISOString().split('T')[0];

  const result = await database.execute({
    sql: `SELECT date(start_time, 'localtime') as date, SUM(duration_seconds) as totalSeconds
          FROM focus_sessions
          WHERE user_id = ? AND date(start_time, 'localtime') >= ?
          GROUP BY date
          ORDER BY date ASC`,
    args: [userId, startDateStr],
  });

  return result.rows.map(row => ({
    date: row.date as string,
    totalSeconds: row.totalSeconds as number,
  }));
}

export async function getSessionsForDay(userId: number, date: string, _startHour: number = 8, endHour: number = 2): Promise<FocusSession[]> {
  const database = getDb();

  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
  const endHourStr = String(endHour).padStart(2, '0') + ':00:00';

  const result = await database.execute({
    sql: `SELECT * FROM focus_sessions
          WHERE user_id = ?
            AND datetime(start_time, 'localtime') >= ? || ' 00:00:00'
            AND datetime(start_time, 'localtime') < ? || ' ' || ?
          ORDER BY start_time ASC`,
    args: [userId, date, nextDayStr, endHourStr],
  });

  const rows = result.rows.map(row => ({
    id: row.id as number,
    start_time: row.start_time as string,
    duration_seconds: row.duration_seconds as number,
    date: row.date as string,
  }));

  if (rows.length === 0) return [];

  const ids = rows.map(r => r.id);
  const placeholders = ids.map(() => '?').join(', ');
  const pauses = await database.execute({
    sql: `SELECT session_id, pause_time FROM session_pauses WHERE session_id IN (${placeholders}) ORDER BY pause_time ASC`,
    args: ids as InArgs,
  });

  const pauseMap = new Map<number, string[]>();
  for (const p of pauses.rows) {
    const sid = p.session_id as number;
    const pt = p.pause_time as string;
    if (!pauseMap.has(sid)) pauseMap.set(sid, []);
    pauseMap.get(sid)!.push(pt);
  }

  return rows.map(row => ({
    ...row,
    pause_times: pauseMap.get(row.id) || [],
  }));
}

export async function deleteFocusSession(id: number) {
  const database = getDb();
  await database.execute({ sql: 'DELETE FROM session_pauses WHERE session_id = ?', args: [id] });
  await database.execute({ sql: 'DELETE FROM focus_sessions WHERE id = ?', args: [id] });
}

export async function getGlobalStats(userId: number) {
  const database = getDb();

  const allTime = await database.execute({
    sql: 'SELECT SUM(duration_seconds) as allTimeTotal, MAX(duration_seconds) as allTimePeak FROM focus_sessions WHERE user_id = ?',
    args: [userId],
  });

  const dWeek = new Date();
  dWeek.setDate(dWeek.getDate() - 7);
  const weekStr = dWeek.toISOString().split('T')[0];
  const week = await database.execute({
    sql: "SELECT SUM(duration_seconds) as weekTotal FROM focus_sessions WHERE user_id = ? AND date(start_time, 'localtime') >= ?",
    args: [userId, weekStr],
  });

  const dMonth = new Date();
  dMonth.setDate(dMonth.getDate() - 30);
  const monthStr = dMonth.toISOString().split('T')[0];
  const month = await database.execute({
    sql: "SELECT SUM(duration_seconds) as monthTotal FROM focus_sessions WHERE user_id = ? AND date(start_time, 'localtime') >= ?",
    args: [userId, monthStr],
  });

  return {
    allTimeTotal: (allTime.rows[0]?.allTimeTotal as number) || 0,
    allTimePeak: (allTime.rows[0]?.allTimePeak as number) || 0,
    weekTotal: (week.rows[0]?.weekTotal as number) || 0,
    monthTotal: (month.rows[0]?.monthTotal as number) || 0,
  };
}

export async function getAllSessions(userId: number): Promise<FocusSession[]> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM focus_sessions WHERE user_id = ? ORDER BY start_time ASC',
    args: [userId],
  });
  return result.rows.map(row => ({
    id: row.id as number,
    start_time: row.start_time as string,
    duration_seconds: row.duration_seconds as number,
    date: row.date as string,
  }));
}

export async function getFragmentationStats(userId: number): Promise<{ session_id: number; pause_count: number }[]> {
  const database = getDb();
  const result = await database.execute({
    sql: `SELECT fs.id as session_id, COUNT(sp.id) as pause_count
          FROM focus_sessions fs
          LEFT JOIN session_pauses sp ON sp.session_id = fs.id
          WHERE fs.user_id = ?
          GROUP BY fs.id
          ORDER BY fs.start_time ASC`,
    args: [userId],
  });
  return result.rows.map(row => ({
    session_id: row.session_id as number,
    pause_count: row.pause_count as number,
  }));
}

// ─── Objective Categories ────────────────────────────────────────

export async function getCategories(userId: number): Promise<ObjectiveCategory[]> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM objective_categories WHERE user_id = ? ORDER BY sort_order ASC, id ASC',
    args: [userId],
  });
  return result.rows.map(row => ({
    id: row.id as number,
    label: row.label as string,
    color: row.color as string,
    sort_order: row.sort_order as number,
  }));
}

export async function seedDefaultCategories(userId: number): Promise<void> {
  const database = getDb();
  const countResult = await database.execute({
    sql: 'SELECT COUNT(*) as n FROM objective_categories WHERE user_id = ?',
    args: [userId],
  });
  if ((countResult.rows[0]?.n as number) === 0) {
    await database.execute({
      sql: 'INSERT INTO objective_categories (user_id, label, color, sort_order) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)',
      args: [userId, 'Hard', '#ff4444', 0, userId, 'Normal', '#ffffff', 1, userId, 'Easy', '#888888', 2],
    });
  }
}

export async function addCategory(userId: number, label: string, color: string): Promise<number> {
  const database = getDb();
  const countResult = await database.execute({
    sql: 'SELECT COUNT(*) as n FROM objective_categories WHERE user_id = ?',
    args: [userId],
  });
  const nextOrder = (countResult.rows[0]?.n as number) ?? 0;
  const result = await database.execute({
    sql: 'INSERT INTO objective_categories (user_id, label, color, sort_order) VALUES (?, ?, ?, ?)',
    args: [userId, label, color, nextOrder],
  });
  return Number(result.lastInsertRowid) ?? 0;
}

export async function updateCategory(id: number, label: string, color: string): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE objective_categories SET label = ?, color = ? WHERE id = ?',
    args: [label, color, id],
  });
}

export async function deleteCategory(id: number): Promise<void> {
  const database = getDb();
  await database.execute({ sql: 'UPDATE objectives SET category_id = NULL WHERE category_id = ?', args: [id] });
  await database.execute({ sql: 'DELETE FROM objective_categories WHERE id = ?', args: [id] });
}

// ─── Strategic Objectives ────────────────────────────────────────

export async function getObjectives(userId: number): Promise<StrategicObjective[]> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM objectives WHERE user_id = ? AND completed_at IS NULL ORDER BY sort_order ASC, id ASC',
    args: [userId],
  });
  return result.rows.map(row => ({
    id: row.id as number,
    text: row.text as string,
    created_at: row.created_at as string,
    completed_at: row.completed_at as string | undefined,
    sort_order: row.sort_order as number,
    category_id: row.category_id as number | null,
  }));
}

export async function addObjective(userId: number, text: string, categoryId?: number | null): Promise<number> {
  const database = getDb();
  const countResult = await database.execute({
    sql: 'SELECT COUNT(*) as n FROM objectives WHERE user_id = ?',
    args: [userId],
  });
  const nextOrder = (countResult.rows[0]?.n as number) ?? 0;
  const result = await database.execute({
    sql: 'INSERT INTO objectives (user_id, text, sort_order, category_id) VALUES (?, ?, ?, ?)',
    args: [userId, text, nextOrder, categoryId ?? null],
  });
  return Number(result.lastInsertRowid) ?? 0;
}

export async function deleteObjective(id: number) {
  const database = getDb();
  await database.execute({ sql: 'DELETE FROM objectives WHERE id = ?', args: [id] });
}

export async function updateObjective(id: number, text: string, categoryId?: number | null) {
  const database = getDb();
  if (categoryId !== undefined) {
    await database.execute({
      sql: 'UPDATE objectives SET text = ?, category_id = ? WHERE id = ?',
      args: [text, categoryId, id],
    });
  } else {
    await database.execute({
      sql: 'UPDATE objectives SET text = ? WHERE id = ?',
      args: [text, id],
    });
  }
}

export async function updateObjectiveCategory(id: number, categoryId: number | null): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE objectives SET category_id = ? WHERE id = ?',
    args: [categoryId, id],
  });
}

export async function completeObjective(id: number): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE objectives SET completed_at = ? WHERE id = ?',
    args: [new Date().toISOString(), id],
  });
}

export async function reorderObjectives(orderedIds: number[]): Promise<void> {
  const database = getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await database.execute({
      sql: 'UPDATE objectives SET sort_order = ? WHERE id = ?',
      args: [i, orderedIds[i]],
    });
  }
}

export async function getCompletedObjectivesForDay(userId: number, date: string, startHour: number = 8, endHour: number = 2): Promise<StrategicObjective[]> {
  const database = getDb();

  const startHourStr = String(startHour).padStart(2, '0') + ':00:00';
  const endHourStr = String(endHour).padStart(2, '0') + ':00:00';

  const endDate = endHour > startHour ? date : (() => {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
  })();

  const result = await database.execute({
    sql: `SELECT id, text, completed_at FROM objectives
          WHERE user_id = ? AND completed_at IS NOT NULL
            AND datetime(completed_at, 'localtime') >= ? || ' ' || ?
            AND datetime(completed_at, 'localtime') < ? || ' ' || ?
          ORDER BY completed_at ASC`,
    args: [userId, date, startHourStr, endDate, endHourStr],
  });

  return result.rows.map(row => ({
    id: row.id as number,
    text: row.text as string,
    created_at: '',
    completed_at: row.completed_at as string,
  }));
}

export async function getKillRate(userId: number) {
  const database = getDb();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const dayResult = await database.execute({
    sql: "SELECT COUNT(*) as count FROM objectives WHERE user_id = ? AND completed_at IS NOT NULL AND date(completed_at, 'localtime') = ?",
    args: [userId, todayStr],
  });

  const dWeek = new Date();
  dWeek.setDate(dWeek.getDate() - 7);
  const weekStr = dWeek.toISOString().split('T')[0];
  const weekResult = await database.execute({
    sql: "SELECT COUNT(*) as count FROM objectives WHERE user_id = ? AND completed_at IS NOT NULL AND date(completed_at, 'localtime') >= ?",
    args: [userId, weekStr],
  });

  const allResult = await database.execute({
    sql: "SELECT COUNT(*) as count FROM objectives WHERE user_id = ? AND completed_at IS NOT NULL",
    args: [userId],
  });

  return {
    day: (dayResult.rows[0]?.count as number) || 0,
    week: (weekResult.rows[0]?.count as number) || 0,
    allTime: (allResult.rows[0]?.count as number) || 0,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/db.ts
git commit -m "feat: rewrite db.ts for Turso — libsql/client, user_id scoping, new schema"
```

---

### Task 5: Create OAuth auth module

**Files:**
- Create: `src/auth.ts`

- [ ] **Step 1: Create `src/auth.ts`**

```typescript
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token: string;
  expires_in: number;
  token_type: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export interface StoredAuth {
  refresh_token: string;
  google_sub: string;
}

export async function startOAuthFlow(): Promise<{ userInfo: GoogleUserInfo; refreshToken: string }> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;

  // Get an available port for the callback
  const port: number = await invoke('get_available_port');
  const redirectUri = `http://localhost:${port}`;

  // Build the auth URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });

  const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

  // Start listening for the callback BEFORE opening the browser
  const codePromise: Promise<string> = invoke('wait_for_oauth_callback', { port });

  // Open the browser
  await open(authUrl);

  // Wait for the callback
  const code = await codePromise;

  // Exchange the code for tokens
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokens: GoogleTokenResponse = await tokenResponse.json();

  // Get user info
  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userInfoResponse.ok) {
    throw new Error('Failed to fetch user info');
  }

  const userInfo: GoogleUserInfo = await userInfoResponse.json();

  return {
    userInfo,
    refreshToken: tokens.refresh_token || '',
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; userInfo: GoogleUserInfo }> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Token refresh failed — user must re-authenticate');
  }

  const tokens: GoogleTokenResponse = await tokenResponse.json();

  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userInfoResponse.ok) {
    throw new Error('Failed to fetch user info');
  }

  const userInfo: GoogleUserInfo = await userInfoResponse.json();

  return { accessToken: tokens.access_token, userInfo };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/auth.ts
git commit -m "feat: add OAuth flow module — Google auth URL, code exchange, token refresh"
```

---

### Task 6: Create AuthContext

**Files:**
- Create: `src/contexts/AuthContext.tsx`

- [ ] **Step 1: Create `src/contexts/AuthContext.tsx`**

```typescript
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { load } from '@tauri-apps/plugin-store';
import type { AuthUser } from '../types';
import { startOAuthFlow, refreshAccessToken, type StoredAuth } from '../auth';
import { upsertUser, initDb, seedDefaultCategories } from '../db';

interface AuthContextType {
  authUser: AuthUser | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORE_FILE = 'auth.json';
const AUTH_KEY = 'auth';

async function getStore() {
  return await load(STORE_FILE);
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Try to restore session from stored refresh token on mount
  useEffect(() => {
    (async () => {
      try {
        await initDb();
        const store = await getStore();
        const stored = await store.get<StoredAuth>(AUTH_KEY);
        if (stored?.refresh_token) {
          const { userInfo } = await refreshAccessToken(stored.refresh_token);
          const user = await upsertUser(userInfo.sub, userInfo.email, userInfo.name, userInfo.picture);
          setAuthUser(user);
        }
      } catch (e) {
        console.error('Failed to restore session:', e);
        // Clear stored auth if refresh failed
        try {
          const store = await getStore();
          await store.delete(AUTH_KEY);
          await store.save();
        } catch {}
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async () => {
    const { userInfo, refreshToken } = await startOAuthFlow();
    const user = await upsertUser(userInfo.sub, userInfo.email, userInfo.name, userInfo.picture);

    // Seed default categories for new users
    await seedDefaultCategories(user.id);

    // Store refresh token
    const store = await getStore();
    await store.set(AUTH_KEY, { refresh_token: refreshToken, google_sub: userInfo.sub } satisfies StoredAuth);
    await store.save();

    setAuthUser(user);
  }, []);

  const logout = useCallback(async () => {
    const store = await getStore();
    await store.delete(AUTH_KEY);
    await store.save();
    setAuthUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ authUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/contexts/AuthContext.tsx
git commit -m "feat: add AuthContext — manages login, logout, session restoration"
```

---

### Task 7: Create LoginScreen component

**Files:**
- Create: `src/components/LoginScreen.tsx`
- Create: `src/components/LoginScreen.module.scss`

- [ ] **Step 1: Create `src/components/LoginScreen.module.scss`**

```scss
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #0a0a0a;
  color: #00ff88;
  font-family: 'Courier New', monospace;
  gap: 2rem;
}

.title {
  font-size: 2.5rem;
  font-weight: bold;
  letter-spacing: 0.3rem;
  text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
}

.subtitle {
  color: #666;
  font-size: 0.9rem;
  letter-spacing: 0.1rem;
}

.loginBtn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 2rem;
  background: transparent;
  border: 1px solid #00ff88;
  color: #00ff88;
  font-family: 'Courier New', monospace;
  font-size: 1rem;
  letter-spacing: 0.1rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 255, 136, 0.1);
    box-shadow: 0 0 15px rgba(0, 255, 136, 0.3);
  }

  &:disabled {
    opacity: 0.5;
    cursor: wait;
  }
}

.error {
  color: #ff4444;
  font-size: 0.85rem;
  max-width: 400px;
  text-align: center;
}
```

- [ ] **Step 2: Create `src/components/LoginScreen.tsx`**

```typescript
import { type FC, useState } from 'react';
import styles from './LoginScreen.module.scss';
import { useAuth } from '../contexts/AuthContext';

export const LoginScreen: FC = () => {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await login();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.title}>FOCUS_FORGE</div>
      <div className={styles.subtitle}>OPERATOR_AUTHENTICATION_REQUIRED</div>
      <button className={styles.loginBtn} onClick={handleLogin} disabled={loading}>
        {loading ? 'AUTHENTICATING...' : 'SIGN_IN_WITH_GOOGLE'}
      </button>
      {error && <div className={styles.error}>ERROR: {error}</div>}
    </div>
  );
};
```

- [ ] **Step 3: Commit**

```bash
git add src/components/LoginScreen.tsx src/components/LoginScreen.module.scss
git commit -m "feat: add LoginScreen component with HUD-style Google sign-in"
```

---

### Task 8: Update UserContext to use AuthContext

**Files:**
- Modify: `src/contexts/UserContext.tsx`

- [ ] **Step 1: Replace `src/contexts/UserContext.tsx`**

```typescript
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { UserSettings } from '../types';
import { getUserSettings, updateUserSettings as dbUpdateUserSettings } from '../db';
import { useAuth } from './AuthContext';

interface UserContextType {
  user: UserSettings | null;
  avatar: string;
  name: string;
  email: string;
  loading: boolean;
  updateSettings: (debugSpeed: number, experienceLvl: number, dayStartHour: number, dayEndHour: number) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const { authUser } = useAuth();
  const [user, setUser] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!authUser) return;
    const userData = await getUserSettings(authUser.id);
    if (userData) {
      setUser(userData);
    }
    setLoading(false);
  }, [authUser]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const updateSettings = async (debugSpeed: number, experienceLvl: number, dayStartHour: number, dayEndHour: number) => {
    if (!authUser) return;
    await dbUpdateUserSettings(authUser.id, debugSpeed, experienceLvl, dayStartHour, dayEndHour);
    await refreshUser();
  };

  // Name, email, avatar come from Google (via AuthContext)
  const name = authUser?.name ?? '';
  const email = authUser?.email ?? '';
  const avatar = authUser?.avatar_url ?? '';

  return (
    <UserContext.Provider value={{ user, avatar, name, email, loading, updateSettings, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/contexts/UserContext.tsx
git commit -m "feat: UserContext now sources identity from AuthContext, settings from Turso"
```

---

### Task 9: Update FocusContext to pass user_id

**Files:**
- Modify: `src/contexts/FocusContext.tsx`

- [ ] **Step 1: Update FocusContext.tsx**

The key change: all `db` calls now receive `authUser.id` as the first argument. Add `useAuth` import and destructure `authUser`.

At the top, add the import:
```typescript
import { useAuth } from './AuthContext';
```

Inside the `FocusProvider` component, add:
```typescript
const { authUser } = useAuth();
```

Then update every db call to pass `authUser!.id` as the first argument. The specific changes:

In `refreshData`:
```typescript
const refreshData = useCallback(async () => {
    if (!authUser) return;
    try {
      const [sessions, stats, globals, objectives, cats] = await Promise.all([
        getRecentSessions(authUser.id, 3),
        getDailyFocusStats(authUser.id, 21),
        getGlobalStats(authUser.id),
        getObjectives(authUser.id),
        getCategories(authUser.id)
      ]);
      setRecentSessions(sessions);
      setDailyStats(stats);
      setGlobalStats(globals);
      setObjectivePool(objectives);
      setCategories(cats);
    } catch (e) {
      console.error("Failed to load focus data", e);
    } finally {
      setLoading(false);
    }
  }, [authUser]);
```

In `saveSession`:
```typescript
const saveSession = useCallback(async (startTime: string, durationSeconds: number, pauseTimes: string[] = []) => {
    if (durationSeconds < 60 || !authUser) return;
    await dbSaveFocusSession(authUser.id, startTime, durationSeconds, pauseTimes);
    await refreshData();
  }, [authUser, refreshData]);
```

In `addObjective`:
```typescript
const addObjective = useCallback(async (text: string, categoryId?: number | null) => {
    if (!authUser) return;
    await dbAddObjective(authUser.id, text, categoryId);
    await refreshData();
  }, [authUser, refreshData]);
```

In `addCategory`:
```typescript
const addCategory = useCallback(async (label: string, color: string) => {
    if (!authUser) return;
    await dbAddCategory(authUser.id, label, color);
    await refreshData();
  }, [authUser, refreshData]);
```

The remaining db calls (`deleteObjective`, `updateObjective`, `completeObjective`, `reorderObjectives`, `updateObjectiveCategory`, `deleteCategory`, `updateCategory`, `deleteFocusSession`) do NOT need `user_id` because they operate on a specific row by `id` (which is already scoped to the user).

- [ ] **Step 2: Commit**

```bash
git add src/contexts/FocusContext.tsx
git commit -m "feat: FocusContext passes user_id to all db queries"
```

---

### Task 10: Update main.tsx and App.tsx — add auth gating

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace `src/main.tsx`**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.scss'
import { AuthProvider } from './contexts/AuthContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
```

- [ ] **Step 2: Update `src/App.tsx`**

Replace the entire file:
```typescript
import { useState } from 'react';
import { Header } from './components/Header';
import { SidebarLeft } from './components/SidebarLeft';
import { MainDisplay } from './components/MainDisplay';
import { SidebarRight } from './components/SidebarRight';
import { Footer } from './components/Footer';
import { AnalyticsView } from './components/AnalyticsView';
import { IntelligenceHub } from './components/IntelligenceHub';
import { GlitchOverlay } from './components/GlitchOverlay';
import { LoginScreen } from './components/LoginScreen';
import { useFocus } from './contexts/FocusContext';
import { useAuth } from './contexts/AuthContext';
import { UserProvider } from './contexts/UserContext';
import { FocusProvider } from './contexts/FocusContext';
import { NavigationGuard } from './components/NavigationGuard';

function HudApp() {
  const [view, setView] = useState<'hud' | 'analytics' | 'intel'>('hud');
  const [analyticsDate, setAnalyticsDate] = useState<Date>(new Date());
  const [pendingNavigation, setPendingNavigation] = useState<{ target: 'analytics' | 'intel'; dateStr?: string } | null>(null);
  const { timerStatus, resetTimer } = useFocus();

  const handleViewAnalytics = (dateStr?: string) => {
    if (timerStatus !== 'idle') {
      setPendingNavigation({ target: 'analytics', dateStr });
      return;
    }

    if (dateStr) {
      setAnalyticsDate(new Date(dateStr));
    } else {
      setAnalyticsDate(new Date());
    }
    setView('analytics');
  };

  const handleViewIntel = () => {
    if (timerStatus !== 'idle') {
      setPendingNavigation({ target: 'intel' });
      return;
    }
    setView('intel');
  };

  const handleConfirmNavigation = () => {
    if (!pendingNavigation) return;
    resetTimer();

    if (pendingNavigation.target === 'analytics') {
      if (pendingNavigation.dateStr) {
        setAnalyticsDate(new Date(pendingNavigation.dateStr));
      } else {
        setAnalyticsDate(new Date());
      }
      setView('analytics');
    } else {
      setView('intel');
    }
    setPendingNavigation(null);
  };

  const handleCancelNavigation = () => {
    setPendingNavigation(null);
  };

  return (
    <div className="hud-container">
      <GlitchOverlay />
      <Header />
      {view === 'hud' ? (
        <>
          <SidebarLeft onViewAnalytics={() => handleViewAnalytics()} onViewIntel={handleViewIntel} />
          <MainDisplay onViewAnalytics={() => handleViewAnalytics()} onViewIntel={handleViewIntel} />
          <SidebarRight onViewAnalytics={(date) => handleViewAnalytics(date)} />
        </>
      ) : view === 'analytics' ? (
        <AnalyticsView initialDate={analyticsDate} onBack={() => setView('hud')} />
      ) : (
        <IntelligenceHub onBack={() => setView('hud')} />
      )}
      <Footer />

      {pendingNavigation && (
        <NavigationGuard
          onConfirm={handleConfirmNavigation}
          onCancel={handleCancelNavigation}
        />
      )}
    </div>
  );
}

function App() {
  const { authUser, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a', color: '#00ff88', fontFamily: 'monospace' }}>
        INITIALIZING_SYSTEM...
      </div>
    );
  }

  if (!authUser) {
    return <LoginScreen />;
  }

  return (
    <UserProvider>
      <FocusProvider>
        <HudApp />
      </FocusProvider>
    </UserProvider>
  );
}

export default App;
```

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx src/App.tsx
git commit -m "feat: gate app behind auth — LoginScreen when logged out, HudApp when logged in"
```

---

### Task 11: Update SettingsModal — read-only identity, add logout

**Files:**
- Modify: `src/components/SettingsModal.tsx`

- [ ] **Step 1: Update SettingsModal.tsx**

Key changes:
- Import `useAuth` for logout
- `name` and `email` come from `useUser()` as read-only display values
- Remove name/email state and editing
- `updateSettings` signature no longer takes name/email
- Add a "SIGN_OUT" button in the footer

Replace the entire file:
```typescript
import { type FC, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './SettingsModal.module.scss';
import { X, Check, LogOut } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useAuth } from '../contexts/AuthContext';
import { soundEngine } from '../utils/audio';

interface Props {
  onClose: () => void;
}

export const SettingsModal: FC<Props> = ({ onClose }) => {
  const { user, name, email, avatar, updateSettings, loading } = useUser();
  const { logout } = useAuth();
  const [debugSpeed, setDebugSpeed] = useState(1);
  const [experienceLvl, setExperienceLvl] = useState(42);
  const [dayStartHour, setDayStartHour] = useState(8);
  const [dayEndHour, setDayEndHour] = useState(2);

  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (user) {
      setDebugSpeed(user.debug_speed || 1);
      setExperienceLvl(user.experience_lvl || 42);
      setDayStartHour(user.day_start_hour ?? 8);
      setDayEndHour(user.day_end_hour ?? 2);
    }
  }, [user]);

  const handleSave = useCallback(async () => {
    soundEngine.playClick();
    await updateSettings(debugSpeed, experienceLvl, dayStartHour, dayEndHour);
    onClose();
  }, [debugSpeed, experienceLvl, dayStartHour, dayEndHour, updateSettings, onClose]);

  const handleCancel = useCallback(() => {
    soundEngine.playClick();
    onClose();
  }, [onClose]);

  const handleLogout = useCallback(async () => {
    soundEngine.playClick();
    await logout();
  }, [logout]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Tab') {
        soundEngine.playTab();
      } else if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
        soundEngine.playKey();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleCancel]);

  if (loading) return null;

  return createPortal(
    <div className={styles.overlay} onClick={handleCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>SYSTEM_SETTINGS</h2>
          <button className={styles.closeBtn} onClick={handleCancel}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.field}>
            <label>OPERATOR_NAME</label>
            <input
              type="text"
              value={name}
              disabled
              style={{ opacity: 0.6 }}
            />
          </div>
          <div className={styles.field}>
            <label>OPERATOR_EMAIL</label>
            <input
              type="email"
              value={email}
              disabled
              style={{ opacity: 0.6 }}
            />
          </div>
          <div className={styles.field}>
            <label>EXPERIENCE_LVL</label>
            <input
              type="number"
              value={experienceLvl}
              onChange={e => setExperienceLvl(Number(e.target.value))}
              placeholder="Enter level..."
              min="1"
              autoFocus
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>DAY_START_HOUR (0-23)</label>
              <input
                type="number"
                value={dayStartHour}
                onChange={e => setDayStartHour(Number(e.target.value))}
                min="0"
                max="23"
              />
            </div>
            <div className={styles.field}>
              <label>DAY_END_HOUR (0-23)</label>
              <input
                type="number"
                value={dayEndHour}
                onChange={e => setDayEndHour(Number(e.target.value))}
                min="0"
                max="23"
              />
            </div>
          </div>

          {isDev && (
            <div className={styles.field}>
              <label>DEBUG_SPEED_MULTIPLIER (DEV_ONLY)</label>
              <input
                type="number"
                value={debugSpeed}
                onChange={e => setDebugSpeed(Number(e.target.value))}
                min="1"
                max="1000"
              />
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={handleLogout}>
            <LogOut size={16} />
            SIGN_OUT
          </button>
          <div style={{ flex: 1 }} />
          <button className={styles.cancelBtn} onClick={handleCancel}>
            CANCEL
          </button>
          <button className={styles.saveBtn} onClick={handleSave}>
            <Check size={16} />
            APPLY_CHANGES
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SettingsModal.tsx
git commit -m "feat: SettingsModal — read-only identity fields, add sign-out button"
```

---

### Task 12: Update components that use avatar/name from UserContext

**Files:**
- Modify: any component that accesses `user.name`, `user.email`, or `avatar` from `useUser()`

- [ ] **Step 1: Search for components using user name/email/avatar**

Run:
```bash
cd C:/Work/focusforge && grep -rn "user\.name\|user\.email\|useUser\|avatar" src/components/ --include="*.tsx" --include="*.ts"
```

Check each file. The `useUser()` hook now exposes `name`, `email`, `avatar` as top-level properties (not nested in `user`). Any component that previously accessed `user.name` or `user.email` needs updating:
- `user.name` → `name` (from `useUser()`)
- `user.email` → `email` (from `useUser()`)

The `user` object now only has settings fields (`debug_speed`, `experience_lvl`, etc.).

Update each affected component. Common pattern:
```typescript
// Before
const { user, avatar } = useUser();
const displayName = user?.name;

// After
const { user, name, avatar } = useUser();
const displayName = name;
```

- [ ] **Step 2: Commit**

```bash
git add -u src/components/
git commit -m "fix: update components to use new UserContext shape for name/email/avatar"
```

---

### Task 13: Update AnalyticsView and IntelligenceHub for user_id

**Files:**
- Modify: `src/components/AnalyticsView.tsx`
- Modify: `src/components/IntelligenceHub.tsx`

- [ ] **Step 1: Check if these components call db functions directly**

Run:
```bash
cd C:/Work/focusforge && grep -n "from.*db\|import.*db" src/components/AnalyticsView.tsx src/components/IntelligenceHub.tsx
```

If they import db functions directly (not through FocusContext), they need `useAuth()` to get `authUser.id` and pass it to those calls.

For each direct db call found, add:
```typescript
import { useAuth } from '../contexts/AuthContext';
// inside component:
const { authUser } = useAuth();
```

And update each call to pass `authUser!.id` as the first argument.

- [ ] **Step 2: Commit**

```bash
git add src/components/AnalyticsView.tsx src/components/IntelligenceHub.tsx
git commit -m "fix: pass user_id to direct db calls in AnalyticsView and IntelligenceHub"
```

---

### Task 14: Update tests

**Files:**
- Modify: `src/db.test.ts`
- Modify: `src/contexts/UserContext.test.tsx`
- Modify: `src/contexts/FocusContext.test.tsx`

- [ ] **Step 1: Rewrite `src/db.test.ts`**

The mock needs to change from `@tauri-apps/plugin-sql` to `@libsql/client`. The `@libsql/client` `createClient` returns an object with an `execute` method that returns `{ rows, lastInsertRowid, rowsAffected }`.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecute } = vi.hoisted(() => {
  return {
    mockExecute: vi.fn(),
  };
});

vi.mock('@libsql/client', () => ({
  createClient: vi.fn().mockReturnValue({
    execute: mockExecute,
  }),
}));

import { saveFocusSession, getRecentSessions, getDailyFocusStats, getSessionsForDay, deleteFocusSession, getObjectives, addObjective, deleteObjective, completeObjective, getCompletedObjectivesForDay, getKillRate, getAllSessions, getFragmentationStats } from './db';

describe('db utility functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Focus Session Methods', () => {
    it('saveFocusSession should extract date and execute insert', async () => {
      const startTime = '2024-03-24T12:00:00.000Z';
      const duration = 3600;
      mockExecute.mockResolvedValueOnce({ lastInsertRowid: BigInt(1), rowsAffected: 1, rows: [] });

      await saveFocusSession(1, startTime, duration);

      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('INSERT INTO focus_sessions'),
        args: [1, startTime, duration, '2024-03-24'],
      });
    });

    it('getRecentSessions should call execute with user_id and limit', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [], rowsAffected: 0 });

      await getRecentSessions(1, 5);

      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('WHERE user_id = ?'),
        args: [1, 5],
      });
    });

    it('deleteFocusSession deletes pause records before the session', async () => {
      mockExecute.mockResolvedValue({ rows: [], rowsAffected: 1 });

      await deleteFocusSession(42);

      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('DELETE FROM session_pauses WHERE session_id = ?'),
        args: [42],
      });
      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('DELETE FROM focus_sessions WHERE id = ?'),
        args: [42],
      });
    });
  });

  describe('Strategic Objective Methods', () => {
    it('getObjectives filters out completed objectives for a user', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [], rowsAffected: 0 });

      await getObjectives(1);

      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('WHERE user_id = ? AND completed_at IS NULL'),
        args: [1],
      });
    });

    it('completeObjective sets completed_at timestamp', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-25T14:30:00.000Z'));
      mockExecute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 });

      await completeObjective(42);

      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('UPDATE objectives SET completed_at = ?'),
        args: ['2026-03-25T14:30:00.000Z', 42],
      });

      vi.useRealTimers();
    });

    it('addObjective inserts with user_id', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [{ n: 0 }], rowsAffected: 0 })
        .mockResolvedValueOnce({ lastInsertRowid: BigInt(123), rows: [], rowsAffected: 1 });

      const id = await addObjective(1, 'Test Objective');

      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('INSERT INTO objectives (user_id, text, sort_order, category_id)'),
        args: [1, 'Test Objective', 0, null],
      });
      expect(id).toBe(123);
    });

    it('deleteObjective should call execute with delete query and id', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 });

      await deleteObjective(42);

      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('DELETE FROM objectives WHERE id = ?'),
        args: [42],
      });
    });
  });

  describe('Intelligence Hub Queries', () => {
    it('getKillRate returns day, week, and allTime counts for a user', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-30T12:00:00.000Z'));

      mockExecute
        .mockResolvedValueOnce({ rows: [{ count: 3 }] })
        .mockResolvedValueOnce({ rows: [{ count: 12 }] })
        .mockResolvedValueOnce({ rows: [{ count: 45 }] });

      const result = await getKillRate(1);

      expect(result).toEqual({ day: 3, week: 12, allTime: 45 });
      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining("user_id = ? AND completed_at IS NOT NULL"),
        args: expect.arrayContaining([1]),
      });

      vi.useRealTimers();
    });

    it('getAllSessions returns all sessions for a user sorted by start_time ASC', async () => {
      const mockData = [
        { id: 1, start_time: '2026-03-20T09:00:00.000Z', duration_seconds: 1800, date: '2026-03-20' },
      ];
      mockExecute.mockResolvedValueOnce({ rows: mockData });

      const result = await getAllSessions(1);

      expect(result).toEqual(mockData);
      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('WHERE user_id = ? ORDER BY start_time ASC'),
        args: [1],
      });
    });

    it('getFragmentationStats returns pause counts for a user', async () => {
      const mockData = [
        { session_id: 1, pause_count: 0 },
        { session_id: 2, pause_count: 3 },
      ];
      mockExecute.mockResolvedValueOnce({ rows: mockData });

      const result = await getFragmentationStats(1);

      expect(result).toEqual(mockData);
      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('WHERE fs.user_id = ?'),
        args: [1],
      });
    });
  });
});
```

- [ ] **Step 2: Update other test files**

For `src/contexts/UserContext.test.tsx` and `src/contexts/FocusContext.test.tsx`: add `AuthContext` mock wrapping, update `useUser`/`useFocus` mock shapes. The exact changes depend on current test content — read each file and update the mock provider hierarchy to include `AuthProvider` (or mock `useAuth`).

- [ ] **Step 3: Run tests**

```bash
cd C:/Work/focusforge && npm test
```

Expected: All tests pass. Fix any failures.

- [ ] **Step 4: Commit**

```bash
git add -u src/
git commit -m "test: update all tests for Turso client + user_id scoping"
```

---

### Task 15: Verify full build compiles

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript check**

```bash
cd C:/Work/focusforge && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 2: Run Vite build**

```bash
cd C:/Work/focusforge && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Run Cargo check**

```bash
cd C:/Work/focusforge/src-tauri && cargo check
```

Expected: Compiles with no errors.

- [ ] **Step 4: Fix any issues found, then commit**

```bash
git add -u && git commit -m "fix: resolve build issues from Turso migration"
```

(Only if there were fixes needed.)

---

### Task 16: Manual integration test

**Files:** None

- [ ] **Step 1: Confirm Google OAuth credentials are set**

The user must have created a Google Cloud OAuth app and filled in `VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_SECRET` in `.env`. If not set yet, this task blocks until they are.

- [ ] **Step 2: Run the app**

User runs:
```bash
cd C:/Work/focusforge && npm run tauri dev
```

- [ ] **Step 3: Verify login flow**

1. App should show the LoginScreen with "SIGN_IN_WITH_GOOGLE" button
2. Clicking the button should open the system browser to Google's login page
3. After authenticating, the browser should show "AUTHENTICATION_COMPLETE"
4. The app should transition to the main HUD view

- [ ] **Step 4: Verify data operations**

1. Start a focus session (timer > 60 seconds), stop it — verify it saves
2. Create an objective — verify it appears
3. Complete an objective — verify the glitch effect fires
4. Open Settings — verify name/email are read-only and show your Google name/email
5. Change experience_lvl — verify it saves

- [ ] **Step 5: Verify sign out**

1. Open Settings → click SIGN_OUT
2. Should return to LoginScreen
3. Sign back in — data should persist from step 4

---

## Notes for the implementer

- **Turso URL**: The user needs to confirm the exact database URL from their Turso dashboard. The plan uses `libsql://focusforge-virusescu.turso.io` as a placeholder.
- **Google OAuth**: The user must create a Google Cloud project, enable Google Identity, create OAuth 2.0 credentials (Desktop app type), and provide Client ID + Secret. This is a prerequisite for Tasks 5+ to actually work at runtime.
- **`@libsql/client` API difference**: It uses `{ sql, args }` objects instead of positional parameters. Return values use `result.rows` (array of objects) and `result.lastInsertRowid` (BigInt) instead of `database.select()` / `result.lastInsertId`.
- **The `getGravatarUrl` function** is removed entirely — avatars now come from Google profile.
- **No migration of existing data** — this is a clean break. The local `focusforge.db` file will still exist but is no longer used.
