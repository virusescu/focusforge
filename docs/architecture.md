# Architecture

FocusForge is a Tauri 2 desktop app. The UI is React 19 + TypeScript (Vite), the
backend is a thin Rust shell, and all persistent data lives in a per-user
[Turso](https://turso.tech) (LibSQL) cloud database that the frontend talks to
directly via `@libsql/client`.

```
┌──────────────────────────── Tauri window (WebView2) ────────────────────────────┐
│  React app (src/)                                                               │
│    contexts ── hooks ── components                                              │
│        │                                                                        │
│        ├── src/db.ts ──────────── HTTPS ───────────▶  Turso DB (user's own)     │
│        ├── src/auth.ts ────────── HTTPS ───────────▶  Google OAuth endpoints    │
│        └── invoke() ──┐                                                         │
│                       ▼                                                         │
│  Rust (src-tauri/src/)  oauth.rs  ◀── localhost callback from system browser    │
│  Plugins: shell · store · updater · log (debug only)                            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Related docs: [database.md](database.md) · [economy.md](economy.md) · [release.md](release.md)

---

## Startup and auth flow

`src/main.tsx` mounts `<AuthProvider>` around `<App>`. `App` gates on auth state:

| State | Screen |
|---|---|
| `loading` | `INITIALIZING_SYSTEM...` splash |
| no user, no pending setup | `LoginScreen` |
| `needsSetup` | `SetupScreen` (asks for Turso DB URL + auth token) |
| logged in | provider tree + `HudApp` |

**Login** (`src/auth.ts` + `src-tauri/src/oauth.rs`):

1. `get_available_port` (Rust) binds `127.0.0.1:0` to find a free port.
2. `wait_for_oauth_callback(port)` (Rust) starts a one-shot `tiny_http` server.
3. The system browser opens Google's consent page with `redirect_uri=http://localhost:<port>`.
4. Rust receives the redirect, extracts `code`, returns it to JS, and shows a "you can close this tab" page.
5. JS exchanges the code for tokens, fetches the Google user profile, and stores the **refresh token** in the Tauri store (`auth.json`).

**Session restore:** on launch `AuthContext` reads the store. If Turso credentials
and a refresh token are both present it calls `initDbClient` → `initDb` (schema +
migrations) → `refreshAccessToken` → `upsertUser`. If the refresh fails the stored
auth is deleted and the user sees the login screen.

**Tauri store keys** (`auth.json`): `auth` (`{ refresh_token, google_sub }`),
`turso_url`, `turso_auth_token`.

## Provider tree

```
AuthProvider            (main.tsx)
└─ UserProvider         settings for the logged-in user
   └─ FocusProvider     timer, sessions, objectives, categories
      └─ GameProvider   coins, streaks, daily challenge, prestige, seasons
         └─ AlarmProvider
            └─ HudApp
```

Order matters: `FocusProvider` reads `useUser()` (debug speed), and `GameProvider`
only needs `useAuth()` but listens to events emitted from inside `FocusProvider`.

### Contexts

| Context | File | Owns | Notes |
|---|---|---|---|
| **Auth** | `contexts/AuthContext.tsx` | `authUser`, `needsSetup`, `login`, `logout`, `completeSetup` | Also initialises the DB client. |
| **User** | `contexts/UserContext.tsx` | `user` (settings row), `name`/`email`/`avatar` from Google, `updateSettings` | Settings: `debug_speed`, `experience_lvl`, `day_start_hour`, `day_end_hour`. |
| **Focus** | `contexts/FocusContext.tsx` | Timer state (via `useTimer`), recent sessions, 21-day stats, global stats, objective pool, `missionObjectives`, buckets and `objectivesByBucket`, bucket operations (add/rename/recolor/move/resize/delete, move or reorder objectives within buckets, `setObjectiveMission`), categories, active/viewed objective, glitch overlay state | Objective and bucket edits are optimistic; the DB write runs after and `refreshData()` reverts on failure. |
| **Game** | `contexts/GameContext.tsx` | Season, coins, streak, daily challenge, prestige titles, archives, `coinGain` (header flash), `startNewSeason` | `useGame()` returns safe defaults instead of throwing outside its provider. |
| **Alarm** | `contexts/AlarmContext.tsx` | Alarms CRUD, `activeAlarm`, snooze state | Polls every 5 s; snooze state is in memory only. |

Every context except Game follows the same pattern: a `XProvider` plus a
`useX()` hook that throws if used outside the provider.

## Event bus

Cross-context communication uses `window` `CustomEvent`s rather than shared
context, so the timer hook and the game economy stay decoupled.

| Event | Emitted by | Payload | Listeners |
|---|---|---|---|
| `timer-active` | `useTimer.toggleTimer` (start/resume) | — | `FocusContext` (status), `useSystemLog` |
| `timer-paused` | `useTimer.toggleTimer` (pause) | — | `FocusContext`, `useSystemLog` |
| `timer-reset` | `useTimer.resetTimer`, pause-limit auto reset | — | `FocusContext`, `useSystemLog` |
| `timer-saved` | `useTimer.resetTimer` when `seconds > 0` | `{ durationSeconds, startTime, pauseTimes[] }` | `FocusContext` (persist session), `GameContext` (award coins) |
| `objective-neutralized` | `FocusContext.neutralizeObjective` | `{ baseBounty }` | `GameContext` (award bounty) |

### Session lifecycle

1. **Space** → `toggleTimer` → `startTime` recorded on first activation → `timer-active`.
2. Pausing records a pause timestamp. It only counts as a pause if the session is resumed (or ended while paused).
3. While paused, a countdown runs. At **60 s** (`PAUSE_LIMIT`) the session auto-ends.
4. **Escape** (or the pause limit) → `resetTimer` → `timer-saved` with duration and pauses.
5. `FocusContext` saves the session if it lasted **≥ 60 s** (`focus_sessions` + `session_pauses`).
6. `GameContext` computes the reward (see [economy.md](economy.md)), writes a coin transaction, updates streak and daily state, plays sounds and flashes `+N ⟐` in the header.

In dev builds the timer runs at `debug_speed` × real time (set in Settings).

## Views and navigation

`HudApp` (in `App.tsx`) holds a `view` state: `hud | analytics | intel | vault | buckets`.
Switching away from the HUD while the timer is not idle shows `NavigationGuard`.
Confirming ends (and saves) the session first.

The app also checks for updates on startup (`@tauri-apps/plugin-updater` `check()`)
and shows `UpdatePrompt` if one is available.

## Components

| Component | Purpose |
|---|---|
| `Header` | Title bar / drag region, coin counter + `+N` flash, streak bars, season timer, prestige rank, version, window controls. |
| `SidebarLeft` | Mission list (each row has a left stripe in its bucket's color; hover shows the bucket name) with drag-and-drop reordering (`@dnd-kit`, drag from anywhere on the row; pointer only), inline edit (F2), category dots, remove-from-Mission button, a BUCKETS button that opens the Buckets page, forge progress, streak/daily/multiplier readout. |
| `BucketsPage` | The Buckets view: an infinite pan/zoom canvas (CSS-transformed world, viewport saved in `localStorage` key `bucket_canvas_viewport`) with one `BucketPanel` per bucket plus the Mission panel. Handles card drag-and-drop between panels, NEW_BUCKET, the details drawer and the category manager. Also renders the `CanvasNoteView` sticky notes (loaded via `useCanvasNotes`) in a layer above all panels (`NOTE_Z_BASE`), owns `editingNoteId` (one note is edited at a time), and has a NEW_NOTE button that adds a `#ffcc33` 260×200 note near the top-right of the view, opened for editing. |
| `BucketPanel` | One colored panel on the canvas. It can be moved by its header and resized from its corner (minimum 200×120; moves/resizes snap to a 20-unit grid, hold Shift to move/resize freely in whole units, via `usePanelDrag`). Every panel's color is editable, including Mission and Unsorted; the name of every panel except Mission is editable. Delete is available for custom buckets only. Panels stack by `sort_order` (`stackingOrder` in `utils/canvas.ts`); dropping a moved or resized panel calls `bringBucketToFront`, so the last one dragged stays on top, and the order is saved. Holds a sortable list of cards and an add box. |
| `CanvasNoteView` | A sticky note on the Buckets canvas, tinted with its color. Drag it from anywhere except controls and resize it from the corner (minimum 160×100). On hover it shows a color input and delete (delete asks for confirmation if the note has text). Double-click edits it in place with a compact `MarkdownToolbar`: Esc or clicking outside saves, Shift+Esc cancels. Task checkboxes toggle without entering edit mode. The last note moved comes to the front among notes. |
| `MarkdownView` | Shared GFM renderer (used by objective details and notes): task toggles, external links, scrollable styled tables, blank-line preservation. |
| `MarkdownToolbar` | Shared formatting toolbar, in normal and compact variants. |
| `ObjectiveCard` | A sortable objective card used in bucket panels and the Mission panel, dragged from anywhere on the card (not while renaming): category dot, inline rename (double-click / F2), details, Mission toggle, delete. |
| `BucketTag` | Colored dot + bucket name in the bucket's color. Used in the LOCKED_ON label and the details header. |
| `MainDisplay` | The "Neural Forge" timer ring, active objective (its LOCKED_ON label shows the objective's bucket), hold-to-charge neutralize, global keyboard shortcuts. |
| `SidebarRight` | Activity map (21-day heatmap → opens Analytics for a day), recent forges, system log, and the big nav buttons (Buckets, Analytics, Alarms, Intelligence Hub, Vault; they shrink to fit narrow widths). Hosts `ObjectiveDetails` when the details panel is open. Resizable (280–700 px). |
| `ObjectiveDetails` | Markdown notes editor for an objective, built on `MarkdownView` / `MarkdownToolbar` / `useMarkdownEditor`, with toolbar, shortcuts, auto-link on paste and line reordering. The header shows the title and the objective's bucket (`BucketTag`). |
| `AnalyticsView` | Day view timeline, session edit/delete, completed objectives, kill rate, category management. Reads the DB directly. |
| `IntelligenceHub` | Focus by hour, focus by day, session length distribution, fragmentation index, clean-forge ratio. Reads the DB directly. |
| `VaultPage` | Season overview, daily challenge, streak status, prestige ranks, seasonal archive, economy help. |
| `SettingsModal` | Debug speed, experience level, day start/end hours, logout. |
| `AlarmsModal` / `AlarmOverlay` | Manage recurring alarms; full-screen overlay when one fires (snooze/dismiss). |
| `SeasonTransitionModal` | Shown when the active season has ended; archives it and starts the next. |
| `CategoryManagerModal`, `CategoryDotPicker`, `CompletedObjectivesModal` | Category CRUD and pickers, completed-objective browser. |
| `GlitchOverlay` | Full-screen glitch effect when an objective is neutralized. |
| `FireBackground` | Animated background that reacts to timer state. |
| `LoginScreen`, `SetupScreen`, `UpdatePrompt`, `NavigationGuard`, `WindowControls`, `Footer` | Auth gate, Turso setup, update prompt, leave-session guard, custom window buttons, footer. |

## Hooks and utilities

| Module | Purpose |
|---|---|
| `hooks/useTimer.ts` | Pure timer state machine (seconds, pause countdown, pause timestamps) that emits the timer events. |
| `hooks/useSystemLog.ts` | Flavour-text log fed by timer events, using messages from `logData.ts`. |
| `hooks/usePanelDrag.ts` | Pointer move/resize drag for canvas panels and notes; snaps to the 20-unit grid by default, Shift moves/resizes freely in whole units. |
| `hooks/useMarkdownEditor.ts` | Shared markdown editing logic (shortcuts, formatting, auto-link on paste, line reordering) used by objective details and notes. |
| `hooks/useCanvasNotes.ts` | Loads and mutates the user's canvas notes (add, update, delete, bring to front) against the DB. |
| `utils/gameEconomy.ts` | Pure economy functions with no side effects (see [economy.md](economy.md)). |
| `utils/canvas.ts` | Pure viewport/geometry math for the Buckets canvas (screen↔world, zoom at cursor with 0.25–2 clamp, recenter, panel move/resize, `snapToGrid`) plus viewport persistence. |
| `utils/markdown.ts` | Pure markdown helpers shared by the markdown view and editor. |
| `utils/audio.ts` | `soundEngine`: every UI sound is synthesised with the Web Audio API, with no audio assets. |
| `utils/dateUtils.ts`, `utils/statusHint.ts`, `utils/logger.ts` | Date helpers, footer status hints, logging. |

## Keyboard shortcuts

**HUD (global, ignored while typing in an input):**

| Key | Action |
|---|---|
| Space | Start / pause timer |
| Escape | End session (saves it), unless the details panel is open |
| Ctrl+Enter | Neutralize the active objective (timer must be running) |
| Enter | Open details for the active objective |
| A / I / V / B | Analytics / Intelligence Hub / Vault / Buckets |
| ↑ / ↓ | Select previous / next objective |
| Shift+↑ / Shift+↓ / Shift+Home / Shift+End | Reorder the selected objective |
| F2 | Rename objective |
| Shift+Enter (in add box) | Add objective to the top of the list |

**Analytics:** ← / → previous/next day · Space jump to today · Escape back.

**Buckets page:** drag background / middle mouse pan · wheel zoom (around the cursor) ·
Space recenter origin (keeps zoom) · F2 rename card · Escape back (closes the details drawer first) ·
moves and resizes snap to a 20-unit grid by default, Shift moves/resizes freely in whole units · double-click a note to edit it · Esc saves and Shift+Esc cancels in a note. Keys are ignored while typing in an input.

**Details editor:** Ctrl+B / I / S bold / italic / strikethrough (toggle) ·
Ctrl+1/2/3 headings · Ctrl+L bullet · Ctrl+T task · Ctrl+D duplicate line ·
Ctrl+↑/↓ move line · Escape save · Shift+Escape cancel · paste a URL over selected text to make a link.

## Rust backend (`src-tauri/`)

| File | Purpose |
|---|---|
| `src/main.rs` | Entry point; hides the console window in release builds. |
| `src/lib.rs` | Registers plugins (shell, store, updater; log in debug only) and the two OAuth commands. |
| `src/oauth.rs` | `get_available_port`, `wait_for_oauth_callback`. |
| `tauri.conf.json` | Window (1520×960, frameless, transparent), bundle and updater endpoint config. |
| `capabilities/default.json` | Permissions: core, window close/minimize/drag, `shell:allow-open`, store, updater. |

## Testing

Vitest + React Testing Library + jsdom (`vite.config.ts`, setup in
`src/setupTests.ts`). Tests sit next to the code they test (`*.test.ts(x)`).
Tauri APIs and `@libsql/client` are mocked. Run `npm test`, or `npm run test:watch`
to watch.

## Security notes

These are known properties of the current design, recorded so they stay visible:

- **Turso credentials** (URL and auth token) and the Google **refresh token** are kept in the Tauri store file `auth.json` in the app data directory, in plain text.
- **The Google client ID and secret** are compiled into the frontend bundle (`VITE_*` variables). For "Desktop app" OAuth clients Google does not treat the secret as confidential, but anyone with the installer can extract it.
- **The OAuth flow** uses a loopback redirect with no `state` parameter and no PKCE.
- **Content Security Policy** is disabled (`"csp": null` in `tauri.conf.json`).
