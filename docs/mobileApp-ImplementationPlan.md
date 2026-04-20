# FocusForge Mobile Companion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal Expo (React Native) mobile companion app that logs in with the same Google account, hits the same Turso database directly (no backend), lists and adds objectives, runs a focus timer, and marks objectives complete — acting as a controller while the desktop app remains the full dashboard.

**Architecture:** The phone app talks directly to Turso over HTTPS using `@libsql/client/web` — same URL + auth token the desktop uses. Google OAuth runs natively via `expo-auth-session/providers/google` (PKCE handled by the provider hook). Refresh token and Turso credentials are stored in `expo-secure-store`. The mobile app reads and writes the same `users`, `objectives`, `objective_categories`, and `focus_sessions` tables the desktop already owns. Desktop ↔ mobile consistency is achieved by polling `focus_sessions` on the desktop side; no realtime channel is added.

**Pairing model:** instead of typing a Turso URL and auth token on the phone, the desktop app shows a QR code (from settings → "Pair Phone") encoding `{url, token}`. The mobile app scans it once via `expo-camera` during setup. No pairing server is involved — the handoff is a local optical transfer.

**Distribution:** Android APK only (no iOS, no Play Store in v1). Built via EAS `preview` profile, attached to GitHub Releases, sideloaded manually. The app checks a GitHub-hosted `mobile-update.json` manifest on startup and prompts the user to download the latest APK when a newer version is available — same mental model as the desktop's Tauri updater.

**Code reuse:** the four shared type interfaces (`AuthUser`, `ObjectiveCategory`, `StrategicObjective`, `FocusSession`) live in a root `shared/types.ts` imported by both desktop and mobile, preventing schema drift.

**Tech Stack:**
- **Expo SDK 53** if available (falls back to 52+) — React Native framework, New Architecture default on 53
- **TypeScript** — same strictness as desktop
- **@libsql/client** `^0.17.2` — HTTP mode (`@libsql/client/web`) for RN compatibility; `intMode: 'number'`
- **expo-auth-session/providers/google** — higher-level Google OAuth hook (handles PKCE + refresh internally)
- **expo-secure-store** — refresh token + Turso token storage
- **expo-camera** — QR code pairing scanner
- **expo-router** — file-based navigation
- **EAS Build** (`preview` profile) — Android APK output for sideload
- **Jest** + **@testing-library/react-native** (≥ 12.4, with built-in matchers) — unit tests
- No state management library — React Context, matching desktop

**Out of scope (desktop-only features):** coin economy, streaks, prestige, tools, seasons, daily challenges, stats views, daily logs, pause-penalty UI. The `focus_sessions` rows written by mobile will still be picked up by the desktop's economy calculations on next read — that is intentional.

---

## File Structure

The mobile app lives in a new `mobile/` directory at the repo root, sibling to `src/` and `src-tauri/`. It has its own `package.json` and build pipeline so Expo tooling does not collide with Vite/Tauri. Four shared type interfaces live at root in `shared/`, imported by both sides.

```
shared/
└── types.ts                         # AuthUser, ObjectiveCategory, StrategicObjective, FocusSession
mobile-update.json                   # version manifest polled by the mobile app at startup
mobile/
├── package.json                    # Expo + RN deps, isolated from root package.json
├── app.json                         # Expo config: slug, scheme, bundle IDs
├── eas.json                         # EAS Build profiles (preview = APK for sideload)
├── tsconfig.json                    # extends expo/tsconfig.base, aliases @/* and @shared/*
├── metro.config.js                  # watchFolders points at ../shared
├── babel.config.js                  # babel-preset-expo
├── .env.example                     # EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB, _ANDROID
├── .gitignore                       # node_modules, .env, .expo
├── app/                             # expo-router routes
│   ├── _layout.tsx                  # root layout, providers, auth gate, update check
│   ├── index.tsx                    # redirects based on auth state
│   ├── login.tsx                    # Google sign-in screen
│   ├── setup.tsx                    # QR scanner (with manual-entry fallback)
│   └── (tabs)/
│       ├── _layout.tsx              # tab navigator
│       ├── objectives.tsx           # list, add, edit, complete
│       └── timer.tsx                # start/stop + optional selected-objective context
├── src/
│   ├── db/
│   │   ├── client.ts                # createClient singleton (intMode: 'number')
│   │   └── queries.ts               # subset of desktop db.ts functions
│   ├── auth/
│   │   ├── oauth.ts                 # expo-auth-session/providers/google wrapper
│   │   └── storage.ts               # SecureStore wrappers
│   ├── updater/
│   │   └── checkForUpdate.ts        # polls mobile-update.json, shows Alert
│   ├── contexts/
│   │   ├── AuthContext.tsx          # mirrors desktop, SecureStore + provider hook
│   │   └── FocusContext.tsx         # objectives list + add + complete + session save
│   ├── hooks/
│   │   └── useTimer.ts              # port of src/hooks/useTimer.ts, swap window events for callbacks
│   ├── components/
│   │   ├── ObjectiveItem.tsx
│   │   ├── AddObjectiveInput.tsx
│   │   └── TimerDisplay.tsx
│   └── types/
│       └── index.ts                 # re-exports from @shared/types
└── __tests__/
    ├── db/queries.test.ts
    ├── auth/storage.test.ts
    ├── updater/checkForUpdate.test.ts
    └── hooks/useTimer.test.ts
```

**Why a sibling folder, not a monorepo tool?** Expo's Metro bundler and Vite do not share a resolver, and introducing `pnpm` / `turborepo` adds more complexity than this project needs. A sibling `mobile/` folder with its own `package.json` stays simple and keeps the desktop build untouched. `shared/` is reachable via Metro `watchFolders` on the mobile side and a `@shared/*` path alias on both sides — no bundler glue beyond that.

---

## Task 1: Initialize Expo Project

**Files:**
- Create: `mobile/package.json` (via `npx create-expo-app`)
- Create: `mobile/app.json`
- Create: `mobile/tsconfig.json`
- Create: `mobile/.env.example`
- Create: `mobile/.gitignore`
- Modify: `.gitignore` (root, add `mobile/.env` and `mobile/.expo`)

- [ ] **Step 1: Scaffold the Expo project**

Run:
```bash
cd C:\Work\focusforge
npx create-expo-app@latest mobile --template blank-typescript
```

Expected: `mobile/` directory created with `package.json`, `tsconfig.json`, `App.tsx`, `app.json`.

- [ ] **Step 2: Add required dependencies**

Run:
```bash
cd C:\Work\focusforge\mobile
npx expo install expo-router expo-auth-session expo-crypto expo-secure-store expo-linking expo-web-browser expo-camera expo-constants react-native-safe-area-context react-native-screens
npm install @libsql/client
npm install --save-dev @testing-library/react-native jest-expo
```

Expected: All packages install. `@libsql/client` is a plain npm package (not an Expo module), so use `npm install`, not `expo install`.

**Notes:**
- `@testing-library/jest-native` is intentionally NOT installed — it's deprecated and its matchers are built into `@testing-library/react-native` ≥ 12.4.
- `expo-camera` is the QR scanner used in Task 11 (setup/pairing screen).
- `expo-constants` exposes the app version for the update check (Task 16).

- [ ] **Step 3: Configure app.json for OAuth deep link and router**

Replace `mobile/app.json` with:

```json
{
  "expo": {
    "name": "FocusForge",
    "slug": "focusforge-mobile",
    "scheme": "focusforge",
    "version": "0.1.0",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.focusforge.mobile"
    },
    "android": {
      "package": "com.focusforge.mobile"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      [
        "expo-camera",
        { "cameraPermission": "Allow FocusForge to scan the pairing QR code from your desktop." }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

The `scheme` field is the deep-link scheme Google OAuth will redirect back to (`focusforge://`).

- [ ] **Step 4: Configure TypeScript strict mode**

Replace `mobile/tsconfig.json` with:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 5: Create .env.example and update root .gitignore**

Create `mobile/.env.example`:

```
EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=
```

Only the Web client ID is required for development (Expo AuthSession proxy). The Android client ID is required before shipping the release APK (Task 15). No iOS client is needed in v1.

Append to root `.gitignore`:
```
mobile/.env
mobile/.expo/
mobile/node_modules/
mobile/dist/
```

Note: Turso URL and token are NOT in `.env` — they come from user input at setup time (same pattern as desktop).

- [ ] **Step 6: Verify dev server starts**

Run:
```bash
cd C:\Work\focusforge\mobile
npx expo start
```

Expected: Metro bundler starts, QR code appears. Press `Ctrl+C` to stop — this is only a smoke test.

- [ ] **Step 7: Commit**

```bash
cd C:\Work\focusforge
git add mobile/ .gitignore
git commit -m "feat(mobile): scaffold Expo project for mobile companion app"
```

---

## Task 2: Shared Type Definitions

Instead of duplicating type interfaces between desktop and mobile, the four types both sides agree on live at repo root in `shared/types.ts`. Desktop re-exports them from `src/types/index.ts`; mobile re-exports from `mobile/src/types/index.ts`. A single edit to `shared/types.ts` breaks both TypeScript builds in the same way, preventing silent schema drift.

**Files:**
- Create: `shared/types.ts`
- Modify: `tsconfig.json` (root) — add `@shared/*` path alias
- Modify: `src/types/index.ts` (desktop) — re-export shared interfaces
- Create: `mobile/metro.config.js` — add `../shared` to Metro `watchFolders`
- Modify: `mobile/tsconfig.json` — add `@shared/*` path alias
- Create: `mobile/src/types/index.ts` — re-export from `@shared/types`

- [ ] **Step 1: Create `shared/types.ts`**

Create `shared/types.ts` with exactly the four interfaces both sides use:

```typescript
export interface AuthUser {
  id: number;
  google_sub: string;
  email: string;
  name: string;
  avatar_url?: string;
}

export interface ObjectiveCategory {
  id: number;
  label: string;
  color: string;
  sort_order: number;
  coin_bounty: number;
}

export interface StrategicObjective {
  id: number;
  text: string;
  created_at: string;
  completed_at?: string;
  sort_order?: number;
  category_id?: number | null;
  is_mission: number;
}

export interface FocusSession {
  id: number;
  start_time: string;
  duration_seconds: number;
  date: string;
}
```

**Why only these four types?** `GameState`, `ToolDefinition`, `PrestigeTitleDefinition`, etc. are desktop-only. Mobile never reads them, so they stay in `src/types/index.ts`.

- [ ] **Step 2: Add `@shared/*` alias to root `tsconfig.json`**

Edit `tsconfig.json` at the repo root, inside `compilerOptions`:

```json
"paths": {
  "@shared/*": ["./shared/*"]
}
```

If `paths` already exists, merge this entry in. Vite follows TS paths via `vite-tsconfig-paths` (already used in this repo) so no Vite config change is needed.

- [ ] **Step 3: Re-export shared interfaces from `src/types/index.ts`**

At the top of `src/types/index.ts`, replace the local declarations of `AuthUser`, `ObjectiveCategory`, `StrategicObjective`, and `FocusSession` with:

```typescript
export type { AuthUser, ObjectiveCategory, StrategicObjective, FocusSession } from '@shared/types';
```

Leave desktop-only types (`GameState`, `ToolDefinition`, etc.) untouched.

- [ ] **Step 4: Verify desktop still builds**

Run: `cd C:\Work\focusforge && npm run build`
Expected: PASS.

- [ ] **Step 5: Create `mobile/metro.config.js`**

Create `mobile/metro.config.js`:

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../shared')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

module.exports = config;
```

Without `watchFolders`, Metro refuses to read files outside the Expo project root.

- [ ] **Step 6: Add `@shared/*` alias to `mobile/tsconfig.json`**

Extend the `paths` block created in Task 1 Step 4:

```json
"paths": {
  "@/*": ["./src/*"],
  "@shared/*": ["../shared/*"]
}
```

- [ ] **Step 7: Create `mobile/src/types/index.ts` as a re-export**

```typescript
export type {
  AuthUser,
  ObjectiveCategory,
  StrategicObjective,
  FocusSession,
} from '@shared/types';
```

- [ ] **Step 8: Commit**

```bash
git add shared/ tsconfig.json src/types/index.ts mobile/metro.config.js mobile/tsconfig.json mobile/src/types/index.ts
git commit -m "feat(shared): extract shared types to shared/ used by desktop and mobile"
```

---

## Task 3: Turso Client Singleton

**Files:**
- Create: `mobile/src/db/client.ts`
- Test: `mobile/__tests__/db/client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `mobile/__tests__/db/client.test.ts`:

```typescript
import { getDb, initDbClient, resetDbClient } from '@/db/client';

describe('db client', () => {
  beforeEach(() => {
    resetDbClient();
  });

  it('throws before initialization', () => {
    expect(() => getDb()).toThrow('Database not initialized');
  });

  it('returns the same client after init', () => {
    initDbClient('libsql://test.turso.io', 'token');
    const a = getDb();
    const b = getDb();
    expect(a).toBe(b);
  });

  it('resetDbClient forces re-init on next getDb', () => {
    initDbClient('libsql://test.turso.io', 'token');
    resetDbClient();
    expect(() => getDb()).toThrow('Database not initialized');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Work\focusforge\mobile && npx jest __tests__/db/client.test.ts`
Expected: FAIL — cannot resolve `@/db/client`.

- [ ] **Step 3: Configure Jest path alias**

Add to `mobile/package.json`:

```json
{
  "jest": {
    "preset": "jest-expo",
    "moduleNameMapper": {
      "^@/(.*)$": "<rootDir>/src/$1"
    }
  }
}
```

- [ ] **Step 4: Implement the client**

Create `mobile/src/db/client.ts`:

```typescript
import { createClient, type Client } from '@libsql/client/web';

let db: Client | null = null;

export function initDbClient(url: string, authToken: string): void {
  // intMode: 'number' avoids BigInt return values (lastInsertRowid, id columns).
  // Hermes supports BigInt but mixing with regular number paths is a footgun.
  db = createClient({ url, authToken, intMode: 'number' });
}

export function getDb(): Client {
  if (!db) {
    throw new Error('Database not initialized. Call initDbClient() first.');
  }
  return db;
}

export function resetDbClient(): void {
  db = null;
}
```

**Why `@libsql/client/web`?** The default `@libsql/client` import pulls in Node-only APIs (Hrana WebSockets, `better-sqlite3` native bindings). The `/web` entrypoint is pure fetch + HTTP, which React Native supports natively.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/db/client.test.ts`
Expected: PASS, 3 tests green.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/db/client.ts mobile/__tests__/db/client.test.ts mobile/package.json
git commit -m "feat(mobile): add Turso client singleton with HTTP-only libsql"
```

---

## Task 4: Port DB Queries (Minimal Subset)

**Files:**
- Create: `mobile/src/db/queries.ts`
- Test: `mobile/__tests__/db/queries.test.ts`

The mobile app needs exactly these DB functions (mirroring `src/db.ts` signatures):
- `upsertUser` — sign-in side effect
- `getCategories` — for objective color/bounty labels
- `getObjectives` — list Mission objectives (`is_mission = 1`)
- `addObjective` — append a new Mission objective
- `completeObjective` — mark objective done
- `saveFocusSession` — insert a focus_sessions row

No `initDb()` call — the desktop already creates all tables. Mobile assumes the schema exists. If a table is missing, the query errors propagate to the UI (correct: this would mean the user pointed at a stale DB).

- [ ] **Step 1: Write the failing test**

Create `mobile/__tests__/db/queries.test.ts`:

```typescript
import { createClient } from '@libsql/client/web';
import { initDbClient, resetDbClient } from '@/db/client';
import {
  upsertUser,
  getObjectives,
  addObjective,
  completeObjective,
  saveFocusSession,
} from '@/db/queries';

// Mock @libsql/client/web
jest.mock('@libsql/client/web', () => ({
  createClient: jest.fn(),
}));

const mockExecute = jest.fn();
const mockClient = { execute: mockExecute };

describe('db/queries', () => {
  beforeEach(() => {
    (createClient as jest.Mock).mockReturnValue(mockClient);
    mockExecute.mockReset();
    resetDbClient();
    initDbClient('libsql://test', 'tok');
  });

  it('upsertUser inserts and returns the row', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: 5, google_sub: 'g1', email: 'a@b.co', name: 'Ann', avatar_url: null }],
      });

    const user = await upsertUser('g1', 'a@b.co', 'Ann');

    expect(user).toEqual({ id: 5, google_sub: 'g1', email: 'a@b.co', name: 'Ann', avatar_url: null });
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it('getObjectives filters completed_at IS NULL and is_mission = 1', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { id: 1, text: 'Task', created_at: 't', completed_at: null, sort_order: 0, category_id: null, is_mission: 1 },
      ],
    });

    const objectives = await getObjectives(5);

    expect(objectives).toHaveLength(1);
    expect(objectives[0].text).toBe('Task');
    const call = mockExecute.mock.calls[0][0];
    expect(call.sql).toContain('is_mission = 1');
    expect(call.sql).toContain('completed_at IS NULL');
  });

  it('addObjective appends to end of list', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ maxOrder: 3 }] })
      .mockResolvedValueOnce({ lastInsertRowid: 42 });

    const id = await addObjective(5, 'New task', null);

    expect(id).toBe(42);
    expect(typeof id).toBe('number'); // regression guard — not BigInt
    const insertCall = mockExecute.mock.calls[1][0];
    expect(insertCall.args).toContain(4); // maxOrder + 1
  });

  it('completeObjective sets completed_at to ISO timestamp', async () => {
    mockExecute.mockResolvedValueOnce({});

    await completeObjective(7);

    const call = mockExecute.mock.calls[0][0];
    expect(call.sql).toContain('completed_at');
    expect(call.args[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(call.args[1]).toBe(7);
  });

  it('saveFocusSession inserts with derived date', async () => {
    mockExecute.mockResolvedValueOnce({ lastInsertRowid: 1n });

    await saveFocusSession(5, '2026-04-16T10:30:00.000Z', 1500);

    const call = mockExecute.mock.calls[0][0];
    expect(call.args).toEqual([5, '2026-04-16T10:30:00.000Z', 1500, '2026-04-16']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/db/queries.test.ts`
Expected: FAIL — cannot resolve `@/db/queries`.

- [ ] **Step 3: Implement queries**

Create `mobile/src/db/queries.ts`:

```typescript
import { getDb } from './client';
import type {
  AuthUser,
  ObjectiveCategory,
  StrategicObjective,
} from '@/types';

export async function upsertUser(
  googleSub: string,
  email: string,
  name: string,
  avatarUrl?: string,
): Promise<AuthUser> {
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO users (google_sub, email, name, avatar_url)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(google_sub) DO UPDATE SET email = ?, name = ?, avatar_url = ?`,
    args: [googleSub, email, name, avatarUrl ?? null, email, name, avatarUrl ?? null],
  });

  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE google_sub = ?',
    args: [googleSub],
  });

  const row = result.rows[0];
  return {
    id: row.id as number,
    google_sub: row.google_sub as string,
    email: row.email as string,
    name: row.name as string,
    avatar_url: (row.avatar_url as string | null) ?? undefined,
  };
}

export async function getCategories(userId: number): Promise<ObjectiveCategory[]> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM objective_categories WHERE user_id = ? ORDER BY sort_order ASC, id ASC',
    args: [userId],
  });
  return result.rows.map((row) => ({
    id: row.id as number,
    label: row.label as string,
    color: row.color as string,
    sort_order: row.sort_order as number,
    coin_bounty: (row.coin_bounty as number) ?? 25,
  }));
}

export async function getObjectives(userId: number): Promise<StrategicObjective[]> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM objectives
          WHERE user_id = ? AND completed_at IS NULL AND is_mission = 1
          ORDER BY sort_order ASC, id ASC`,
    args: [userId],
  });
  return result.rows.map((row) => ({
    id: row.id as number,
    text: row.text as string,
    created_at: row.created_at as string,
    completed_at: (row.completed_at as string | null) ?? undefined,
    sort_order: row.sort_order as number,
    category_id: row.category_id as number | null,
    is_mission: (row.is_mission as number) ?? 1,
  }));
}

export async function addObjective(
  userId: number,
  text: string,
  categoryId: number | null,
): Promise<number> {
  const db = getDb();
  const maxResult = await db.execute({
    sql: 'SELECT MAX(sort_order) as maxOrder FROM objectives WHERE user_id = ? AND is_mission = 1 AND completed_at IS NULL',
    args: [userId],
  });
  const maxOrder = (maxResult.rows[0]?.maxOrder as number | null) ?? -1;
  const sortOrder = maxOrder + 1;
  const result = await db.execute({
    sql: 'INSERT INTO objectives (user_id, text, sort_order, category_id, is_mission) VALUES (?, ?, ?, ?, 1)',
    args: [userId, text, sortOrder, categoryId],
  });
  return Number(result.lastInsertRowid);
}

export async function completeObjective(id: number): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: 'UPDATE objectives SET completed_at = ? WHERE id = ?',
    args: [new Date().toISOString(), id],
  });
}

export async function saveFocusSession(
  userId: number,
  startTime: string,
  durationSeconds: number,
): Promise<void> {
  const db = getDb();
  const date = startTime.split('T')[0];
  await db.execute({
    sql: 'INSERT INTO focus_sessions (user_id, start_time, duration_seconds, date) VALUES (?, ?, ?, ?)',
    args: [userId, startTime, durationSeconds, date],
  });
}
```

**Note on `saveFocusSession`:** the desktop also writes `session_pauses` rows for pause-penalty calculations. Mobile intentionally skips pause tracking — sessions from mobile count as uninterrupted. This is a documented tradeoff, not a bug.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/db/queries.test.ts`
Expected: PASS, all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/db/queries.ts mobile/__tests__/db/queries.test.ts
git commit -m "feat(mobile): port minimal DB query subset with TDD coverage"
```

---

## Task 5: SecureStore Wrappers

**Files:**
- Create: `mobile/src/auth/storage.ts`
- Test: `mobile/__tests__/auth/storage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `mobile/__tests__/auth/storage.test.ts`:

```typescript
import * as SecureStore from 'expo-secure-store';
import {
  saveRefreshToken,
  getRefreshToken,
  clearRefreshToken,
  saveTursoCredentials,
  getTursoCredentials,
  clearTursoCredentials,
} from '@/auth/storage';

jest.mock('expo-secure-store');

describe('auth/storage', () => {
  beforeEach(() => {
    (SecureStore.setItemAsync as jest.Mock).mockReset();
    (SecureStore.getItemAsync as jest.Mock).mockReset();
    (SecureStore.deleteItemAsync as jest.Mock).mockReset();
  });

  it('saves and reads refresh token', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('tok123');
    await saveRefreshToken('tok123');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('refresh_token', 'tok123');
    const result = await getRefreshToken();
    expect(result).toBe('tok123');
  });

  it('clears refresh token', async () => {
    await clearRefreshToken();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('refresh_token');
  });

  it('saves and reads Turso credentials as a pair', async () => {
    (SecureStore.getItemAsync as jest.Mock)
      .mockResolvedValueOnce('libsql://x.turso.io')
      .mockResolvedValueOnce('tok');
    await saveTursoCredentials('libsql://x.turso.io', 'tok');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('turso_url', 'libsql://x.turso.io');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('turso_token', 'tok');
    const creds = await getTursoCredentials();
    expect(creds).toEqual({ url: 'libsql://x.turso.io', token: 'tok' });
  });

  it('getTursoCredentials returns null if either key is missing', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce('tok');
    expect(await getTursoCredentials()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/auth/storage.test.ts`
Expected: FAIL — cannot resolve `@/auth/storage`.

- [ ] **Step 3: Implement storage wrappers**

Create `mobile/src/auth/storage.ts`:

```typescript
import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'refresh_token';
const TURSO_URL_KEY = 'turso_url';
const TURSO_TOKEN_KEY = 'turso_token';

export async function saveRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function saveTursoCredentials(url: string, token: string): Promise<void> {
  await SecureStore.setItemAsync(TURSO_URL_KEY, url);
  await SecureStore.setItemAsync(TURSO_TOKEN_KEY, token);
}

export async function getTursoCredentials(): Promise<{ url: string; token: string } | null> {
  const url = await SecureStore.getItemAsync(TURSO_URL_KEY);
  const token = await SecureStore.getItemAsync(TURSO_TOKEN_KEY);
  if (!url || !token) return null;
  return { url, token };
}

export async function clearTursoCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(TURSO_URL_KEY);
  await SecureStore.deleteItemAsync(TURSO_TOKEN_KEY);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/auth/storage.test.ts`
Expected: PASS, 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/auth/storage.ts mobile/__tests__/auth/storage.test.ts
git commit -m "feat(mobile): add SecureStore wrappers for auth credentials"
```

---

## Task 6: Google OAuth Flow

**Files:**
- Create: `mobile/src/auth/oauth.ts`

No TDD for this task — `expo-auth-session` is a native module that cannot run in Jest without heavy mocks that add no confidence. Smoke testing happens on-device in Task 14.

**Approach:** use the higher-level `expo-auth-session/providers/google` hook, which handles PKCE, auth-code exchange, and refresh internally. Less code than hand-rolling `AuthRequest`, fewer places to get wrong.

**Prerequisite — Google Cloud Console setup:**
1. Open the same Google Cloud project the desktop app uses.
2. Create a **Web** OAuth 2.0 Client ID (used in development and as the auth-code exchange client). Copy into `mobile/.env` as `EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB`.
3. **Defer the Android client ID** until Task 15 (first EAS build) — you need the SHA-1 fingerprint that `eas credentials` reports after the initial APK build. Until then, the Web client + Expo proxy is sufficient for dev.
4. No iOS client needed (no iOS distribution in v1).

- [ ] **Step 1: Implement the OAuth wrapper**

Create `mobile/src/auth/oauth.ts`:

```typescript
import { useEffect, useRef } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export interface OAuthResult {
  userInfo: GoogleUserInfo;
  refreshToken: string;
  accessToken: string;
}

type Resolver = {
  resolve: (r: OAuthResult) => void;
  reject: (e: Error) => void;
};

/**
 * Hook-based Google OAuth. Caller renders this hook and calls `signIn()`
 * to obtain an `OAuthResult`. The underlying `useAuthRequest` plumbs the
 * browser result back through an effect, so we bridge it to a Promise.
 */
export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
    scopes: ['openid', 'email', 'profile'],
    extraParams: { access_type: 'offline', prompt: 'consent' },
  });

  const pendingRef = useRef<Resolver | null>(null);

  useEffect(() => {
    const pending = pendingRef.current;
    if (!response || !pending) return;

    if (response.type !== 'success') {
      pending.reject(new Error(`OAuth ${response.type}`));
      pendingRef.current = null;
      return;
    }

    const { authentication } = response;
    if (!authentication?.accessToken) {
      pending.reject(new Error('No access token on OAuth response'));
      pendingRef.current = null;
      return;
    }
    if (!authentication.refreshToken) {
      pending.reject(new Error('Google did not return a refresh token — re-auth required'));
      pendingRef.current = null;
      return;
    }

    fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${authentication.accessToken}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch Google user info');
        return r.json() as Promise<GoogleUserInfo>;
      })
      .then((userInfo) => {
        pending.resolve({
          userInfo,
          accessToken: authentication.accessToken,
          refreshToken: authentication.refreshToken!,
        });
      })
      .catch((e) => pending.reject(e instanceof Error ? e : new Error(String(e))))
      .finally(() => {
        pendingRef.current = null;
      });
  }, [response]);

  const signIn = async (): Promise<OAuthResult> => {
    if (!request) throw new Error('OAuth request not ready');
    return new Promise<OAuthResult>((resolve, reject) => {
      pendingRef.current = { resolve, reject };
      promptAsync().catch((e) => {
        pendingRef.current = null;
        reject(e);
      });
    });
  };

  return { signIn, ready: Boolean(request) };
}

/**
 * Refresh flow — same discovery endpoints AuthSession uses internally.
 * Called on app startup from AuthContext when a saved refresh token exists.
 */
export async function refreshAccessToken(refreshToken: string): Promise<OAuthResult> {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB!;
  const body = new URLSearchParams({
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!tokenResp.ok) throw new Error(`Refresh failed: ${tokenResp.status}`);
  const tokenJson = (await tokenResp.json()) as { access_token: string; refresh_token?: string };

  const userResp = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!userResp.ok) throw new Error('Failed to fetch Google user info');
  const userInfo = (await userResp.json()) as GoogleUserInfo;

  return {
    userInfo,
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token ?? refreshToken,
  };
}
```

**Why PKCE instead of client_secret?** Mobile apps cannot safely embed client secrets — they can be extracted from the APK/IPA. PKCE replaces the secret with a per-flow code verifier, which is the Google-recommended flow for native apps. The `useAuthRequest` hook applies PKCE automatically — there is no place in this code where a client secret could leak.

- [ ] **Step 2: Commit**

```bash
git add mobile/src/auth/oauth.ts
git commit -m "feat(mobile): implement Google OAuth via expo-auth-session/providers/google"
```

---

## Task 7: Port useTimer Hook

**Files:**
- Create: `mobile/src/hooks/useTimer.ts`
- Test: `mobile/__tests__/hooks/useTimer.test.ts`

The desktop `useTimer` dispatches `window` events (`timer-saved`, `timer-reset`) and plays audio on pause timeout. The mobile port strips audio and replaces `window` events with callback props, since React Native has no global `window`.

- [ ] **Step 1: Write the failing test**

Create `mobile/__tests__/hooks/useTimer.test.ts`:

```typescript
import { act, renderHook } from '@testing-library/react-native';
import { useTimer } from '@/hooks/useTimer';

describe('useTimer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('starts inactive with zero seconds', () => {
    const { result } = renderHook(() => useTimer({ onSave: jest.fn() }));
    expect(result.current.seconds).toBe(0);
    expect(result.current.isActive).toBe(false);
  });

  it('toggleTimer starts counting', () => {
    const { result } = renderHook(() => useTimer({ onSave: jest.fn() }));
    act(() => result.current.toggleTimer());
    act(() => jest.advanceTimersByTime(3000));
    expect(result.current.seconds).toBe(3);
    expect(result.current.isActive).toBe(true);
  });

  it('resetTimer fires onSave with duration and start time when seconds > 0', () => {
    const onSave = jest.fn();
    const { result } = renderHook(() => useTimer({ onSave }));
    act(() => result.current.toggleTimer());
    act(() => jest.advanceTimersByTime(5000));
    act(() => result.current.resetTimer());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ durationSeconds: 5, startTime: expect.any(String) }),
    );
    expect(result.current.seconds).toBe(0);
  });

  it('resetTimer does not fire onSave if seconds is 0', () => {
    const onSave = jest.fn();
    const { result } = renderHook(() => useTimer({ onSave }));
    act(() => result.current.resetTimer());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('formatTime produces MM:SS', () => {
    const { result } = renderHook(() => useTimer({ onSave: jest.fn() }));
    expect(result.current.formatTime(65)).toBe('01:05');
    expect(result.current.formatTime(3599)).toBe('59:59');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/hooks/useTimer.test.ts`
Expected: FAIL — cannot resolve `@/hooks/useTimer`.

- [ ] **Step 3: Implement the hook**

Create `mobile/src/hooks/useTimer.ts`:

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTimerOptions {
  onSave: (params: { durationSeconds: number; startTime: string }) => void;
}

export function useTimer({ onSave }: UseTimerOptions) {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const secondsRef = useRef(0);
  const startTimeRef = useRef<string | null>(null);

  secondsRef.current = seconds;

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  const toggleTimer = useCallback(() => {
    setIsActive((prev) => {
      const next = !prev;
      if (next && !startTimeRef.current) {
        startTimeRef.current = new Date().toISOString();
      }
      return next;
    });
  }, []);

  const resetTimer = useCallback(() => {
    setIsActive(false);
    if (secondsRef.current > 0 && startTimeRef.current) {
      onSave({ durationSeconds: secondsRef.current, startTime: startTimeRef.current });
    }
    setSeconds(0);
    startTimeRef.current = null;
  }, [onSave]);

  const formatTime = useCallback((totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return { seconds, isActive, toggleTimer, resetTimer, formatTime, minutes: seconds / 60 };
}
```

**Mobile simplifications vs. desktop `useTimer`:**
- No pause countdown / reboot — mobile users are expected to explicitly tap Stop, not leave the app paused.
- No `multiplier` parameter — debug time acceleration is a desktop dev affordance.
- No global events — parent passes `onSave` callback.
- No pause tracking — mobile sessions count as uninterrupted (see Task 4 note on `saveFocusSession`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/hooks/useTimer.test.ts`
Expected: PASS, 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks/useTimer.ts mobile/__tests__/hooks/useTimer.test.ts
git commit -m "feat(mobile): port useTimer hook with callback-based save"
```

---

## Task 8: AuthContext

**Files:**
- Create: `mobile/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Implement the context**

Create `mobile/src/contexts/AuthContext.tsx`:

```typescript
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { initDbClient, resetDbClient } from '@/db/client';
import { upsertUser } from '@/db/queries';
import { useGoogleAuth, refreshAccessToken } from '@/auth/oauth';
import {
  saveRefreshToken,
  getRefreshToken,
  clearRefreshToken,
  saveTursoCredentials,
  getTursoCredentials,
  clearTursoCredentials,
} from '@/auth/storage';
import type { AuthUser } from '@/types';

interface AuthContextType {
  authUser: AuthUser | null;
  needsSetup: boolean;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  completeSetup: (url: string, token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingSub, setPendingSub] = useState<{
    sub: string;
    email: string;
    name: string;
    picture?: string;
  } | null>(null);
  const { signIn } = useGoogleAuth();

  useEffect(() => {
    (async () => {
      try {
        const creds = await getTursoCredentials();
        if (!creds) {
          const refresh = await getRefreshToken();
          if (refresh) setNeedsSetup(true);
          setLoading(false);
          return;
        }

        initDbClient(creds.url, creds.token);

        const refresh = await getRefreshToken();
        if (!refresh) {
          setLoading(false);
          return;
        }

        const { userInfo } = await refreshAccessToken(refresh);
        const user = await upsertUser(userInfo.sub, userInfo.email, userInfo.name, userInfo.picture);
        setAuthUser(user);
      } catch (e) {
        console.error('Session restore failed:', e);
        await clearRefreshToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async () => {
    const { userInfo, refreshToken } = await signIn();
    await saveRefreshToken(refreshToken);

    const creds = await getTursoCredentials();
    if (!creds) {
      setPendingSub(userInfo);
      setNeedsSetup(true);
      return;
    }

    initDbClient(creds.url, creds.token);
    const user = await upsertUser(userInfo.sub, userInfo.email, userInfo.name, userInfo.picture);
    setAuthUser(user);
  }, [signIn]);

  const completeSetup = useCallback(
    async (url: string, token: string) => {
      initDbClient(url, token);
      // Sanity check the connection before persisting.
      const { getDb } = await import('@/db/client');
      await getDb().execute('SELECT 1');

      await saveTursoCredentials(url, token);

      let userInfo = pendingSub;
      if (!userInfo) {
        const refresh = await getRefreshToken();
        if (!refresh) throw new Error('No refresh token on setup');
        const refreshed = await refreshAccessToken(refresh);
        userInfo = refreshed.userInfo;
      }

      const user = await upsertUser(userInfo.sub, userInfo.email, userInfo.name, userInfo.picture);
      setPendingSub(null);
      setNeedsSetup(false);
      setAuthUser(user);
    },
    [pendingSub],
  );

  const logout = useCallback(async () => {
    await clearRefreshToken();
    await clearTursoCredentials();
    resetDbClient();
    setAuthUser(null);
    setNeedsSetup(false);
  }, []);

  return (
    <AuthContext.Provider value={{ authUser, needsSetup, loading, login, logout, completeSetup }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

**Why logout clears Turso credentials (desktop keeps them):** on a shared phone, the next user should not inherit DB access. On desktop, the app is single-user and the credentials stay for convenience.

- [ ] **Step 2: Commit**

```bash
git add mobile/src/contexts/AuthContext.tsx
git commit -m "feat(mobile): add AuthContext mirroring desktop with mobile storage"
```

---

## Task 9: FocusContext

**Files:**
- Create: `mobile/src/contexts/FocusContext.tsx`

- [ ] **Step 1: Implement the context**

Create `mobile/src/contexts/FocusContext.tsx`:

```typescript
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  getObjectives,
  getCategories,
  addObjective as dbAddObjective,
  completeObjective as dbCompleteObjective,
  saveFocusSession,
} from '@/db/queries';
import type { StrategicObjective, ObjectiveCategory } from '@/types';

interface FocusContextType {
  objectives: StrategicObjective[];
  categories: ObjectiveCategory[];
  loading: boolean;
  refreshObjectives: () => Promise<void>;
  addObjective: (text: string, categoryId: number | null) => Promise<void>;
  completeObjective: (id: number) => Promise<void>;
  saveSession: (params: { durationSeconds: number; startTime: string }) => Promise<void>;
}

const FocusContext = createContext<FocusContextType | undefined>(undefined);

export function FocusProvider({ children }: { children: ReactNode }) {
  const { authUser } = useAuth();
  const [objectives, setObjectives] = useState<StrategicObjective[]>([]);
  const [categories, setCategories] = useState<ObjectiveCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshObjectives = useCallback(async () => {
    if (!authUser) return;
    setLoading(true);
    try {
      const [objs, cats] = await Promise.all([
        getObjectives(authUser.id),
        getCategories(authUser.id),
      ]);
      setObjectives(objs);
      setCategories(cats);
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (authUser) refreshObjectives();
  }, [authUser, refreshObjectives]);

  const addObjective = useCallback(
    async (text: string, categoryId: number | null) => {
      if (!authUser) return;
      await dbAddObjective(authUser.id, text, categoryId);
      await refreshObjectives();
    },
    [authUser, refreshObjectives],
  );

  const completeObjective = useCallback(
    async (id: number) => {
      await dbCompleteObjective(id);
      setObjectives((prev) => prev.filter((o) => o.id !== id));
    },
    [],
  );

  const saveSession = useCallback(
    async ({ durationSeconds, startTime }: { durationSeconds: number; startTime: string }) => {
      if (!authUser) return;
      await saveFocusSession(authUser.id, startTime, durationSeconds);
    },
    [authUser],
  );

  return (
    <FocusContext.Provider
      value={{ objectives, categories, loading, refreshObjectives, addObjective, completeObjective, saveSession }}
    >
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error('useFocus must be used within FocusProvider');
  return ctx;
}
```

**Note on `completeObjective` optimistic update:** we remove the objective from local state without waiting for the DB round-trip to feel snappy on mobile. If the DB call fails it surfaces as an unhandled promise rejection — acceptable for a first pass; add a retry toast in a later iteration if needed.

- [ ] **Step 2: Commit**

```bash
git add mobile/src/contexts/FocusContext.tsx
git commit -m "feat(mobile): add FocusContext with objectives and session save"
```

---

## Task 10: Root Layout + Route Gate

**Files:**
- Create: `mobile/app/_layout.tsx`
- Create: `mobile/app/index.tsx`
- Delete: `mobile/App.tsx` (from scaffold)
- Modify: `mobile/package.json` — set `"main": "expo-router/entry"`

- [ ] **Step 1: Set expo-router entry**

Edit `mobile/package.json`, set:

```json
"main": "expo-router/entry",
```

(Replacing the default `node_modules/expo/AppEntry.js` value.)

- [ ] **Step 2: Delete the scaffold App.tsx**

Delete `mobile/App.tsx`.

- [ ] **Step 3: Create the root layout**

Create `mobile/app/_layout.tsx`:

```typescript
import { Stack } from 'expo-router';
import { AuthProvider } from '@/contexts/AuthContext';
import { FocusProvider } from '@/contexts/FocusContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <FocusProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="setup" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </FocusProvider>
    </AuthProvider>
  );
}
```

**Note:** Task 16 replaces this file with a version that also runs the startup update check. Keep this minimal version for now; it's fine up until Task 16.

- [ ] **Step 4: Create the auth-gated index route**

Create `mobile/app/index.tsx`:

```typescript
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { authUser, needsSetup, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (needsSetup) return <Redirect href="/setup" />;
  if (!authUser) return <Redirect href="/login" />;
  return <Redirect href="/(tabs)/objectives" />;
}
```

- [ ] **Step 5: Commit**

```bash
git add mobile/app/_layout.tsx mobile/app/index.tsx mobile/package.json
git rm mobile/App.tsx
git commit -m "feat(mobile): set up expo-router with auth gate"
```

---

## Task 11: Login and QR-Pairing Setup Screens

**Files:**
- Create: `mobile/app/login.tsx`
- Create: `mobile/app/setup.tsx` — QR scanner (primary) + manual entry fallback
- Create: `src/components/PairPhoneModal.tsx` (desktop) — displays QR encoding `{url, token}`
- Modify: desktop settings view to add a "Pair Phone" button that opens the modal
- Install (desktop): `qrcode` (pure JS library, emits canvas/data URL)

- [ ] **Step 1: Create the login screen**

Create `mobile/app/login.tsx`:

```typescript
import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [busy, setBusy] = useState(false);

  const handlePress = async () => {
    setBusy(true);
    try {
      await login();
    } catch (e) {
      Alert.alert('Login failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FocusForge</Text>
      <Text style={styles.subtitle}>Mobile Controller</Text>
      <TouchableOpacity style={styles.button} onPress={handlePress} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in with Google</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#0a0a0a' },
  title: { fontSize: 32, fontWeight: '700', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#888', marginBottom: 48 },
  button: { backgroundColor: '#4285f4', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 2: Create the QR-pairing setup screen**

Create `mobile/app/setup.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '@/contexts/AuthContext';

interface PairPayload {
  url: string;
  token: string;
}

function parsePayload(raw: string): PairPayload | null {
  try {
    const obj = JSON.parse(raw);
    if (typeof obj?.url === 'string' && typeof obj?.token === 'string' && obj.url.startsWith('libsql://')) {
      return { url: obj.url, token: obj.token };
    }
  } catch {
    // fall through
  }
  return null;
}

export default function Setup() {
  const { completeSetup } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [manual, setManual] = useState(false);
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleScan = async ({ data }: { data: string }) => {
    if (scanned || busy) return;
    const payload = parsePayload(data);
    if (!payload) {
      Alert.alert('Invalid QR', 'The scanned code does not look like a FocusForge pairing code.');
      return;
    }
    setScanned(true);
    setBusy(true);
    try {
      await completeSetup(payload.url, payload.token);
    } catch (e) {
      Alert.alert('Setup failed', e instanceof Error ? e.message : String(e));
      setScanned(false);
    } finally {
      setBusy(false);
    }
  };

  const handleManual = async () => {
    if (!url.startsWith('libsql://')) {
      Alert.alert('Invalid URL', 'URL must start with libsql://');
      return;
    }
    if (!token) {
      Alert.alert('Missing token', 'Paste your Turso auth token');
      return;
    }
    setBusy(true);
    try {
      await completeSetup(url.trim(), token.trim());
    } catch (e) {
      Alert.alert('Setup failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (manual) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Manual entry</Text>
        <Text style={styles.help}>
          Paste the URL and token from Turso dashboard → your DB → Generate Token.
        </Text>
        <TextInput
          placeholder="libsql://your-db.turso.io"
          placeholderTextColor="#555"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <TextInput
          placeholder="Auth token"
          placeholderTextColor="#555"
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={styles.input}
        />
        <TouchableOpacity style={styles.button} onPress={handleManual} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Connect</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setManual(false)}>
          <Text style={styles.link}>Back to QR scanner</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission) {
    return <View style={styles.container}><ActivityIndicator color="#fff" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Camera required</Text>
        <Text style={styles.help}>
          FocusForge needs camera access to scan the pairing QR from your desktop.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant permission</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setManual(true)}>
          <Text style={styles.link}>Enter URL and token manually</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleScan}
      />
      <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>Pair with desktop</Text>
        <Text style={styles.overlayHelp}>
          On your desktop: Settings → Pair Phone. Point the camera at the QR code.
        </Text>
        {busy && <ActivityIndicator color="#fff" style={{ marginTop: 12 }} />}
        <TouchableOpacity onPress={() => setManual(true)} style={styles.manualBtn}>
          <Text style={styles.link}>Enter URL and token manually</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0a0a0a' },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, backgroundColor: 'rgba(0,0,0,0.7)' },
  overlayTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  overlayHelp: { fontSize: 13, color: '#ccc' },
  manualBtn: { marginTop: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 8 },
  help: { fontSize: 13, color: '#888', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#333', color: '#fff', padding: 12, borderRadius: 6, marginBottom: 12, fontSize: 14 },
  button: { backgroundColor: '#4285f4', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: '#4285f4', textAlign: 'center', marginTop: 16, fontSize: 13 },
});
```

**Behavior:** camera opens → scans QR → parses JSON `{url, token}` → calls `completeSetup`, which initializes the libsql client, sanity-checks with `SELECT 1`, persists to SecureStore, and lands on the objectives tab. Manual entry remains as a fallback escape hatch.

- [ ] **Step 3: Build the desktop pairing modal**

Install on the desktop side (run from repo root, not `mobile/`):

```bash
npm install qrcode
npm install --save-dev @types/qrcode
```

Create `src/components/PairPhoneModal.tsx`:

```typescript
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { load } from '@tauri-apps/plugin-store';

const AUTO_HIDE_MS = 60_000;

export function PairPhoneModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(AUTO_HIDE_MS / 1000);

  useEffect(() => {
    if (!open) {
      setDataUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const store = await load('.settings.dat', { autoSave: false });
      const url = await store.get<string>('turso_url');
      const token = await store.get<string>('turso_token');
      if (!url || !token) {
        onClose();
        return;
      }
      const payload = JSON.stringify({ url, token });
      const png = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: 320 });
      if (!cancelled) setDataUrl(png);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setRemaining(AUTO_HIDE_MS / 1000);
    const hideTimer = setTimeout(onClose, AUTO_HIDE_MS);
    const tickTimer = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => {
      clearTimeout(hideTimer);
      clearInterval(tickTimer);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="pair-modal-backdrop" onClick={onClose}>
      <div className="pair-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Pair your phone</h2>
        <p>Open FocusForge on your phone and scan this code.</p>
        {dataUrl ? <img src={dataUrl} alt="Pairing QR" width={320} height={320} /> : <div className="pair-modal-loading">Generating…</div>}
        <p className="pair-modal-timer">Hides automatically in {remaining}s</p>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
```

**Security:**
- The QR is only rendered when the user explicitly clicks "Pair Phone".
- It auto-hides after 60 seconds.
- Anyone who photographs the screen during that window gets your Turso token. For extra caution, rotate the Turso token in the Turso dashboard after successful pairing (optional, manual step — not enforced by code).

Wire the button into the existing desktop settings view (exact file depends on current layout — search for the Settings component and add a button + `useState` for the modal's open flag).

- [ ] **Step 4: Commit**

```bash
git add mobile/app/login.tsx mobile/app/setup.tsx src/components/PairPhoneModal.tsx package.json package-lock.json
git commit -m "feat(mobile): QR-based phone pairing with desktop QR modal"
```

---

## Task 12: Tab Navigation + Objectives Screen

**Files:**
- Create: `mobile/app/(tabs)/_layout.tsx`
- Create: `mobile/app/(tabs)/objectives.tsx`
- Create: `mobile/src/components/ObjectiveItem.tsx`
- Create: `mobile/src/components/AddObjectiveInput.tsx`

- [ ] **Step 1: Create the tab layout**

Create `mobile/app/(tabs)/_layout.tsx`:

```typescript
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="objectives" options={{ title: 'Objectives' }} />
      <Tabs.Screen name="timer" options={{ title: 'Timer' }} />
    </Tabs>
  );
}
```

- [ ] **Step 2: Create ObjectiveItem component**

Create `mobile/src/components/ObjectiveItem.tsx`:

```typescript
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { StrategicObjective, ObjectiveCategory } from '@/types';

interface Props {
  objective: StrategicObjective;
  category?: ObjectiveCategory;
  onComplete: () => void;
}

export function ObjectiveItem({ objective, category, onComplete }: Props) {
  return (
    <View style={styles.row}>
      {category && <View style={[styles.chip, { backgroundColor: category.color }]} />}
      <Text style={styles.text}>{objective.text}</Text>
      <TouchableOpacity onPress={onComplete} style={styles.doneBtn}>
        <Text style={styles.doneText}>✓</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  chip: { width: 4, height: 24, borderRadius: 2, marginRight: 12 },
  text: { flex: 1, fontSize: 15, color: '#fff' },
  doneBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  doneText: { color: '#4caf50', fontSize: 22, fontWeight: '700' },
});
```

- [ ] **Step 3: Create AddObjectiveInput component**

Create `mobile/src/components/AddObjectiveInput.tsx`:

```typescript
import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import type { ObjectiveCategory } from '@/types';

interface Props {
  categories: ObjectiveCategory[];
  onAdd: (text: string, categoryId: number | null) => Promise<void>;
}

export function AddObjectiveInput({ categories, onAdd }: Props) {
  const [text, setText] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await onAdd(trimmed, categoryId);
      setText('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        <TouchableOpacity
          onPress={() => setCategoryId(null)}
          style={[styles.chip, categoryId === null && styles.chipActive]}
        >
          <Text style={styles.chipText}>None</Text>
        </TouchableOpacity>
        {categories.map((c) => (
          <TouchableOpacity
            key={c.id}
            onPress={() => setCategoryId(c.id)}
            style={[styles.chip, categoryId === c.id && styles.chipActive, { borderColor: c.color }]}
          >
            <Text style={styles.chipText}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.row}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="New objective…"
          placeholderTextColor="#555"
          style={styles.input}
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
        />
        <TouchableOpacity onPress={handleSubmit} disabled={busy || !text.trim()} style={styles.addBtn}>
          <Text style={styles.addText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 12, borderTopWidth: 1, borderTopColor: '#222' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: '#444', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginBottom: 6 },
  chipActive: { backgroundColor: '#1a1a1a' },
  chipText: { color: '#fff', fontSize: 12 },
  row: { flexDirection: 'row' },
  input: { flex: 1, borderWidth: 1, borderColor: '#333', color: '#fff', padding: 10, borderRadius: 6 },
  addBtn: { backgroundColor: '#4285f4', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 6, marginLeft: 8 },
  addText: { color: '#fff', fontWeight: '600' },
});
```

- [ ] **Step 4: Create objectives screen**

Create `mobile/app/(tabs)/objectives.tsx`:

```typescript
import { FlatList, View, StyleSheet, RefreshControl } from 'react-native';
import { useFocus } from '@/contexts/FocusContext';
import { ObjectiveItem } from '@/components/ObjectiveItem';
import { AddObjectiveInput } from '@/components/AddObjectiveInput';

export default function ObjectivesScreen() {
  const { objectives, categories, loading, refreshObjectives, addObjective, completeObjective } = useFocus();

  return (
    <View style={styles.container}>
      <FlatList
        data={objectives}
        keyExtractor={(o) => String(o.id)}
        renderItem={({ item }) => (
          <ObjectiveItem
            objective={item}
            category={categories.find((c) => c.id === item.category_id)}
            onComplete={() => completeObjective(item.id)}
          />
        )}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshObjectives} />}
        ListEmptyComponent={<View style={{ padding: 24 }} />}
      />
      <AddObjectiveInput categories={categories} onAdd={addObjective} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
});
```

- [ ] **Step 5: Commit**

```bash
git add mobile/app/\(tabs\)/ mobile/src/components/
git commit -m "feat(mobile): add tab navigation and objectives screen"
```

---

## Task 13: Timer Screen

**Files:**
- Create: `mobile/app/(tabs)/timer.tsx`
- Create: `mobile/src/components/TimerDisplay.tsx`

- [ ] **Step 1: Create TimerDisplay component**

Create `mobile/src/components/TimerDisplay.tsx`:

```typescript
import { View, Text, StyleSheet } from 'react-native';

export function TimerDisplay({ formatted, isActive }: { formatted: string; isActive: boolean }) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.time, isActive && styles.active]}>{formatted}</Text>
      <Text style={styles.label}>{isActive ? 'Focusing' : 'Ready'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', padding: 24 },
  time: { fontSize: 72, fontVariant: ['tabular-nums'], color: '#fff', fontWeight: '300' },
  active: { color: '#4caf50' },
  label: { fontSize: 14, color: '#888', marginTop: 8, letterSpacing: 2, textTransform: 'uppercase' },
});
```

- [ ] **Step 2: Create timer screen**

Create `mobile/app/(tabs)/timer.tsx`:

```typescript
import { View, TouchableOpacity, Text, StyleSheet, FlatList, Alert } from 'react-native';
import { useCallback, useState } from 'react';
import { useTimer } from '@/hooks/useTimer';
import { useFocus } from '@/contexts/FocusContext';
import { TimerDisplay } from '@/components/TimerDisplay';

export default function TimerScreen() {
  const { objectives, categories, saveSession, completeObjective } = useFocus();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const onSave = useCallback(
    async ({ durationSeconds, startTime }: { durationSeconds: number; startTime: string }) => {
      try {
        await saveSession({ durationSeconds, startTime });
      } catch (e) {
        Alert.alert('Failed to save session', e instanceof Error ? e.message : String(e));
      }
    },
    [saveSession],
  );

  const { seconds, isActive, toggleTimer, resetTimer, formatTime } = useTimer({ onSave });

  const handleStop = () => {
    resetTimer();
    if (selectedId !== null) {
      completeObjective(selectedId);
      setSelectedId(null);
    }
  };

  return (
    <View style={styles.container}>
      <TimerDisplay formatted={formatTime(seconds)} isActive={isActive} />

      <View style={styles.controls}>
        <TouchableOpacity style={[styles.btn, styles.primary]} onPress={toggleTimer}>
          <Text style={styles.btnText}>{isActive ? 'Pause' : seconds > 0 ? 'Resume' : 'Start'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={handleStop} disabled={seconds === 0}>
          <Text style={styles.btnText}>Stop</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>Working on (optional):</Text>
      <FlatList
        data={objectives}
        keyExtractor={(o) => String(o.id)}
        renderItem={({ item }) => {
          const cat = categories.find((c) => c.id === item.category_id);
          const active = selectedId === item.id;
          return (
            <TouchableOpacity
              onPress={() => setSelectedId(active ? null : item.id)}
              style={[styles.objRow, active && styles.objActive]}
            >
              {cat && <View style={[styles.chip, { backgroundColor: cat.color }]} />}
              <Text style={styles.objText}>{item.text}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  controls: { flexDirection: 'row', justifyContent: 'center', marginBottom: 24 },
  btn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10, marginHorizontal: 8 },
  primary: { backgroundColor: '#4285f4' },
  secondary: { backgroundColor: '#333' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sectionLabel: { color: '#888', fontSize: 12, paddingHorizontal: 16, paddingBottom: 8, letterSpacing: 1 },
  objRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  objActive: { backgroundColor: '#1a2a3a' },
  chip: { width: 4, height: 20, borderRadius: 2, marginRight: 10 },
  objText: { color: '#fff', fontSize: 14 },
});
```

**Behavior:** tapping an objective in the list marks it as "working on". When the user hits Stop, the session is saved AND the selected objective is marked complete in the same motion. Untapping (tap again) clears selection. Stop with no selection just saves the session.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/\(tabs\)/timer.tsx mobile/src/components/TimerDisplay.tsx
git commit -m "feat(mobile): add timer screen with optional objective completion on stop"
```

---

## Task 14: Manual End-to-End Test on Device

No unit tests here — this verifies the full flow on an actual phone against the production Turso DB.

**Prerequisites:**
- Fill in `mobile/.env` with the three Google client IDs from the prerequisite step in Task 6.
- Install Expo Go on your phone from the App Store / Play Store.
- Generate a Turso auth token from the Turso dashboard (same DB as desktop).

- [ ] **Step 1: Start dev server**

Run:
```bash
cd C:\Work\focusforge\mobile
npx expo start
```

Scan the QR code with Expo Go (Android) or the iOS Camera app (iOS).

- [ ] **Step 2: Walk through first-run flow**

1. App launches → login screen appears
2. Tap "Sign in with Google" → browser opens → authorize with `virusescu@gmail.com`
3. Redirects back to app → setup screen opens the camera
4. On desktop: Settings → "Pair Phone" → QR modal appears
5. Point phone camera at desktop screen → scan succeeds → objectives tab appears

**Pass criteria:** objective list matches the desktop's Mission Objectives list exactly. Also verify the desktop QR modal auto-hides after 60 seconds if left untouched.

**Manual-entry fallback:** tap "Enter URL and token manually" on the setup screen — this path must still work (it's the recovery path if the camera is unavailable).

- [ ] **Step 3: Verify add-objective syncs to desktop**

1. On mobile: type "mobile-test-objective" and tap Add
2. On desktop: open FocusForge → refresh / reopen the Objectives view
3. "mobile-test-objective" should appear in the Mission Objectives list

**If this fails:** check that `addObjective` is passing `is_mission: 1` (it is, by default in the SQL).

- [ ] **Step 4: Verify session save appears in desktop stats**

1. On mobile: go to Timer tab, tap Start, wait 60 seconds, tap Stop
2. On desktop: open the stats / sessions view
3. A ~1 minute session should appear at today's date

**Pass criteria:** the session shows up, and the desktop's coin economy attributes it correctly (1 coin/min base rate).

- [ ] **Step 5: Verify complete-on-stop**

1. On mobile: Timer tab → tap an objective → tap Start → wait 30s → tap Stop
2. That objective disappears from the mobile list
3. On desktop: the objective is in the "completed today" view

- [ ] **Step 6: Verify session restore**

1. Force-close the mobile app
2. Reopen it
3. Should land directly on the objectives tab (no login prompt)

**Pass criteria:** refresh token and Turso credentials persist across launches; no re-login needed.

- [ ] **Step 7: Verify in-app update check**

1. Note the installed APK's version (from `mobile/app.json`).
2. On a scratch branch, bump `mobile-update.json` `version` higher than the installed version, push.
3. Force-close and reopen the mobile app.
4. Alert appears titled "Update available" with a button labelled "Update".
5. Tap Update → browser opens, starts downloading the APK from the release URL.
6. Revert `mobile-update.json` on the scratch branch (don't leave the phantom version published).

**Pass criteria:** the alert fires exactly once per app launch when the manifest version is strictly greater than the installed version.

- [ ] **Step 8: Commit the .env.example update if anything changed**

```bash
git add mobile/.env.example
git commit -m "docs(mobile): finalize .env.example based on device test" || echo "nothing to commit"
```

---

## Task 15: APK Build + GitHub Release Distribution

**Files:**
- Create: `mobile/eas.json`
- Create (optional later): `.github/workflows/mobile-release.yml`

No Play Store, no iOS build, no Expo Go dependency. Android APK is built with EAS `preview` profile, downloaded from the EAS dashboard, and attached to a GitHub Release for sideload.

- [ ] **Step 1: Install EAS CLI and sign in**

```bash
npm install -g eas-cli
eas login
```

Use the Expo account you already have (or create one free).

- [ ] **Step 2: Create `mobile/eas.json`**

```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "preview": {
      "android": { "buildType": "apk" },
      "distribution": "internal"
    }
  }
}
```

No `production` profile — we do not publish to stores.

- [ ] **Step 3: Configure project**

```bash
cd C:\Work\focusforge\mobile
eas build:configure
```

Accept the defaults; confirm Android only.

- [ ] **Step 4: First build (also generates the Android SHA-1)**

```bash
eas build --platform android --profile preview
```

Wait ~10 minutes. The dashboard output gives:
1. An APK download URL.
2. A SHA-1 fingerprint for the Android keystore (visible via `eas credentials` → Android → Keystore).

- [ ] **Step 5: Finish Google Cloud Android OAuth client**

In Google Cloud Console:
1. Create an Android OAuth 2.0 Client ID.
2. Package name: `com.focusforge.mobile`.
3. SHA-1: paste from Step 4.
4. Add `EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=<new id>` to `mobile/.env`.
5. Rebuild: `eas build --platform android --profile preview`.

- [ ] **Step 6: Publish to GitHub Releases**

1. Download the APK from EAS dashboard.
2. Tag and release: `git tag mobile-v0.1.0 && git push origin mobile-v0.1.0`.
3. On GitHub, create a Release from the tag, attach `focusforge.apk` as an asset, note the asset URL (needed in Task 16 for `mobile-update.json`).

**Install on phone:** transfer the APK (email, Drive, cable, or direct download from the Release), tap it, approve "install from unknown sources" once, the app installs like any other Android app.

- [ ] **Step 7: (Optional) Automate via GitHub Actions**

Mirror the pattern in `.github/workflows/release.yml`. Triggered on `mobile-v*` tag push:
1. `eas build --platform android --profile preview --non-interactive`
2. Download resulting APK artifact
3. Create/attach to GitHub Release matching the tag

Defer until the manual flow feels painful. The desktop workflow already has the pattern to copy.

- [ ] **Step 8: Commit**

```bash
git add mobile/eas.json
git commit -m "feat(mobile): add EAS Build preview profile for APK sideload"
```

---

## Task 16: In-App Update Check

**Files:**
- Create: `mobile-update.json` at repo root
- Create: `mobile/src/updater/checkForUpdate.ts`
- Modify: `mobile/app/_layout.tsx` — invoke the check once on mount

**Mechanism:** on app startup, fetch a JSON manifest hosted on `raw.githubusercontent.com`. If the manifest's `version` is strictly greater than the installed app's version, show an `Alert` with an Update button that opens the APK's release URL in the phone browser. User downloads the APK and taps to install. Same mental model as the desktop's Tauri updater.

- [ ] **Step 1: Create `mobile-update.json` at repo root**

```json
{
  "version": "0.1.0",
  "apkUrl": "https://github.com/virusescu/focusforge/releases/download/mobile-v0.1.0/focusforge.apk",
  "notes": "Initial release"
}
```

Committed to `master`, served via `https://raw.githubusercontent.com/virusescu/focusforge/master/mobile-update.json`. Bump `version` + `apkUrl` + `notes` every release.

- [ ] **Step 2: Write the failing test**

Create `mobile/__tests__/updater/checkForUpdate.test.ts`:

```typescript
import { checkForUpdate } from '@/updater/checkForUpdate';

const ORIGINAL_FETCH = global.fetch;

describe('checkForUpdate', () => {
  beforeEach(() => {
    (global.fetch as unknown) = jest.fn();
  });
  afterAll(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it('returns null when installed version is current', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '0.1.0', apkUrl: 'x', notes: '' }),
    });
    const result = await checkForUpdate('0.1.0');
    expect(result).toBeNull();
  });

  it('returns manifest when a newer version is available', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '0.2.0', apkUrl: 'u', notes: 'n' }),
    });
    const result = await checkForUpdate('0.1.0');
    expect(result).toEqual({ version: '0.2.0', apkUrl: 'u', notes: 'n' });
  });

  it('returns null on network failure (silent)', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    const result = await checkForUpdate('0.1.0');
    expect(result).toBeNull();
  });

  it('handles patch-level bumps correctly', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '0.1.1', apkUrl: 'u', notes: 'n' }),
    });
    const result = await checkForUpdate('0.1.0');
    expect(result).not.toBeNull();
  });
});
```

- [ ] **Step 3: Implement `checkForUpdate.ts`**

Create `mobile/src/updater/checkForUpdate.ts`:

```typescript
const MANIFEST_URL =
  'https://raw.githubusercontent.com/virusescu/focusforge/master/mobile-update.json';

export interface UpdateManifest {
  version: string;
  apkUrl: string;
  notes: string;
}

function parseVersion(v: string): number[] {
  return v.split('.').map((n) => parseInt(n, 10) || 0);
}

function isNewer(remote: string, installed: string): boolean {
  const r = parseVersion(remote);
  const i = parseVersion(installed);
  const len = Math.max(r.length, i.length);
  for (let k = 0; k < len; k++) {
    const rv = r[k] ?? 0;
    const iv = i[k] ?? 0;
    if (rv > iv) return true;
    if (rv < iv) return false;
  }
  return false;
}

export async function checkForUpdate(
  installedVersion: string,
): Promise<UpdateManifest | null> {
  try {
    const resp = await fetch(MANIFEST_URL, { cache: 'no-store' as RequestCache });
    if (!resp.ok) return null;
    const manifest = (await resp.json()) as UpdateManifest;
    if (!manifest?.version || !manifest?.apkUrl) return null;
    return isNewer(manifest.version, installedVersion) ? manifest : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/updater/checkForUpdate.test.ts`
Expected: PASS, 4 tests green.

- [ ] **Step 5: Wire the check into the root layout**

Edit `mobile/app/_layout.tsx`:

```typescript
import { useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { AuthProvider } from '@/contexts/AuthContext';
import { FocusProvider } from '@/contexts/FocusContext';
import { checkForUpdate } from '@/updater/checkForUpdate';

export default function RootLayout() {
  useEffect(() => {
    (async () => {
      const installed = Constants.expoConfig?.version ?? '0.0.0';
      const update = await checkForUpdate(installed);
      if (update) {
        Alert.alert(
          'Update available',
          `Version ${update.version} is out.\n\n${update.notes}`,
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Update', onPress: () => Linking.openURL(update.apkUrl) },
          ],
        );
      }
    })();
  }, []);

  return (
    <AuthProvider>
      <FocusProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="setup" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </FocusProvider>
    </AuthProvider>
  );
}
```

**Failure behavior:** on network error, `checkForUpdate` returns `null` silently — the app boots normally, no scary error messages. The alert only fires when a strictly newer version is published.

- [ ] **Step 6: Commit**

```bash
git add mobile-update.json mobile/src/updater/checkForUpdate.ts mobile/__tests__/updater/checkForUpdate.test.ts mobile/app/_layout.tsx
git commit -m "feat(mobile): add startup update check against GitHub-hosted manifest"
```

---

## Post-Plan Notes for Future Work

These are intentionally out of scope for v1 but worth tracking:

- **Live session mirroring** — when mobile starts a timer, show it running on desktop in real time. Requires an `active_session` table (single row per user) and 2–3s polling on the desktop side. Not needed for the "controller" use case as-specified.
- **Offline edits** — `@libsql/client/web` is online-only. If the user wants to add objectives on a plane, switch to the libSQL embedded replica for RN. Adds a native module dependency and migration step.
- **Push notifications for session completion** — desktop could ping mobile when a session completes. Requires Expo Push + a lightweight backend, which conflicts with the no-server goal.
- **Biometric unlock** — wrap `SecureStore` reads with `LocalAuthentication` for Face ID / fingerprint gating.
- **EAS Build + App Store distribution** — Expo Go is fine for personal use. Publishing to stores requires `eas build` + Apple / Google developer accounts.
