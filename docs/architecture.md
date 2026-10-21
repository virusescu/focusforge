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
| `timer-active` | `useTimer.toggleTimer` (start/resume) | — | `FocusContext` (status) |
| `timer-paused` | `useTimer.toggleTimer` (pause) | — | `FocusContext` |
| `timer-reset` | `useTimer.resetTimer`, pause-limit auto reset | — | `FocusContext` |
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
Navigation never touches the timer: it keeps running while you visit another view, and the HUD shows it again when you return.

The app also checks for updates on startup (`@tauri-apps/plugin-updater` `check()`)
and shows `UpdatePrompt` if one is available.

## Components

| Component | Purpose |
|---|---|
| `Header` | Title bar / drag region, coin counter + `+N` flash, streak bars, season timer, prestige rank, version, window controls. |
| `SidebarLeft` | Mission list (each row has a left stripe in its bucket's color; hover shows the bucket name) with drag-and-drop reordering (`@dnd-kit`, drag from anywhere on the row; pointer only), inline edit (F2 or Rename in the menu; rows have no buttons, and double-click activates the task), category dots, each row carrying its bucket's color (a 1px border plus a dark shade as background; the selected row's text is bold; the active row, the main target, gets a 2px border and a 32px tab at its right end filled with the bucket color, with a turning crosshair and pulsing dot; the tab is always in the row, pinned to its right edge, and grows out of / retracts into that edge with a width transition, `utils/color.ts` `readableOn` picks the icon color), a right-click menu (Rename, Remove from Mission, Duplicate: copies text, category, details and bucket, and the copy lands right below the original; Copy text; Delete), and a large CANVAS button under the list that opens the Canvas page. The add box has a bucket selector (`BucketSelect`, each bucket shown with a small color rectangle) beside the category dot and no Add button (Enter adds, Shift+Enter adds to the top); the bucket and category last used are remembered (locally, `utils/lastPicks.ts`) instead of resetting, and `TemplateButtons` sit under it. The right-click menu also has "Create template from task". The sidebar is resizable (280–600 px, saved in `localStorage` key `left_sidebar_width`). |
| `BucketsPage` | The Canvas view (user-facing name; the code, the `buckets` view id and the `bucket_canvas_viewport` key keep the old name): an infinite pan/zoom canvas (CSS-transformed world, viewport saved in `localStorage` key `bucket_canvas_viewport`) with one `BucketPanel` per bucket plus the Mission panel. Handles card drag-and-drop between panels, NEW_PANEL (adds a bucket), the details drawer and the category manager. The details drawer opens when a task is clicked (clicking another task switches it) and is resized by dragging its left edge (280 px minimum, always leaving 160 px of canvas; the width is not remembered). Pressing elsewhere does not close it: only Escape does (the pane has no close button), and that also deselects the task. Space flies to the bucket of the task selected last since the canvas opened (else the Mission panel) and double-clicking anywhere on a panel (header, empty space, cards, footer; not on buttons, inputs or a card's category dot) flies to that panel and focuses it (the focused panel shows normally, the others fade to 30%; Tab / Shift+Tab focus the next / previous panel and fly to it, the order is set in the TAB_ORDER dialog (toolbar), by default the virtual panels first (Mission, Deadlines) then the rest by id, and a new panel goes last; Escape clears the focus after closing the category manager and the drawer, and before leaving the page): a 600 ms animation that ends at 100% zoom (ease-in-out cubic, with pan x, pan y and zoom all moving together on the same curve), aiming at the middle of the space not covered by the drawer; a wheel, pan or new fly stops the one in progress; the ORIGIN button still centers on (0,0). Also renders the `CanvasNoteView` sticky notes (loaded via `useCanvasNotes`) in a layer above all panels (`NOTE_Z_BASE`), owns `editingNoteId` (one note is edited at a time), and has a NEW_NOTE button that adds a `#ffcc33` 260×200 note near the top-right of the view, opened for editing. |
| `BucketPanel` | One colored panel on the canvas. It can be moved by its header and resized from its corner (minimum 200×120; moves/resizes snap to a 20-unit grid, hold Shift to move/resize freely in whole units, via `usePanelDrag`). Every panel's color is editable, including Mission and Unsorted. The header has no buttons: a right-click on it offers Rename (every panel except Mission and Deadlines) and Delete (custom buckets only; it asks first), and double-clicking it flies to the panel. The `deadlines` panel (always present, like Mission) is titled DEADLINES, cannot be renamed or deleted, has no add box or template buttons, and lists every open task with a deadline from any bucket, soonest first; a header button flips the order (remembered in `localStorage` `deadlines_sort_dir`). Its cards cannot be dragged (and nothing can be dropped on it); click opens the details, right-click has the usual menu (Add to Mission among it). Panels stack by `sort_order` (`stackingOrder` in `utils/canvas.ts`); dropping a moved or resized panel calls `bringBucketToFront`, so the last one dragged stays on top, and the order is saved. Holds a sortable list of cards and an add box (no Add button, Enter adds), with `TemplateButtons` above it inside the same footer (one divider, even spacing; the dialog starts on that panel's bucket and Add to Mission is checked). Deleting a custom bucket asks in a `ConfirmDialog`. |
| `CanvasNoteView` | A sticky note on the Buckets canvas, tinted with its color. Drag it from anywhere except controls and resize it from the corner (minimum 160×100). It has no hover buttons; a right-click menu (`ContextMenu`) offers Copy (the rendered note: rich HTML plus plain text), Duplicate (an offset copy with the same text, color and size, in front), Change color (opens a hidden color input) and Delete (a note with text asks first in a `ConfirmDialog`; an empty one is deleted at once). Right-click inside the editor keeps the native menu. Double-click edits it in place with a compact `MarkdownToolbar`: Esc or clicking outside saves, Shift+Esc cancels. Task checkboxes toggle without entering edit mode. The last note moved comes to the front among notes. |
| `MarkdownView` | Shared GFM renderer (used by objective details and notes): task toggles, external links, scrollable styled tables, blank-line preservation. Fenced code blocks get a copy button (plain text). A `[c]` anywhere on a line makes just that line copyable: the marker is hidden, and hovering the line shows a copy button (click: rendered rich text + plain text; Shift+click: that line's markdown). `[c]` inside inline code or a code block is left alone. |
| `MarkdownToolbar` | Shared formatting toolbar (headings, bold/italic/strikethrough, lists, link, table, code block), in normal and compact variants. The code block button wraps the selection (or inserts an empty block with the cursor inside) in a fenced block, always on its own lines. |
| `ObjectiveCard` | A sortable objective card used in bucket panels and the Mission panel, dragged from anywhere on the card (not while renaming): category dot, inline rename (F2 / Rename in the menu; cards have no buttons, and double-clicking one flies to its panel), and a right-click menu (Rename, Details, Add to / Remove from Mission, Duplicate, Copy text, Create template from task, Delete). Clicking a card selects it and opens the details drawer. In the Mission panel the whole card is tinted with a dark shade of its bucket's color, besides the colored left border; its 1px border is in that color; a selected card's text is bold (a card without a tint also gets a lighter 2px border). Cards in the Deadlines panel are tinted the same way. A card with a deadline shows its `DeadlineBadge`. |
| `DeadlineBadge` | A task's deadline as an icon (and the date with `showText`): a muted clock when far off, a yellow warning triangle today and tomorrow, a red ringing alarm clock once passed (a red background behind the date). Rows in the Mission list and on canvas cards show just the icon; the Deadlines panel cards show the date too. Refreshes every minute (`hooks/useNow.ts`). |
| `DeadlineControl` | The deadline in the details header, on the right opposite the bucket tag: `NO_DEADLINE` until clicked, which saves the next working day (Mon–Fri) at 19:00 at once. Then the date ("24 Dec 14:30"; the year only when it is not this one): clicking it opens the system dark `datetime-local` picker (every change saves, past dates allowed) and an X removes the deadline. Yellow for today and tomorrow, red with an animated icon once passed. |
| `TabOrderModal` | The TAB_ORDER dialog (toolbar button on the canvas): drag the panels into the order Tab walks them in; saved as `buckets.tab_order`. |
| `BucketTag` | Colored dot + bucket name in the bucket's color. Used in the LOCKED_ON label and the details header. |
| `MainDisplay` | The "Neural Forge" timer ring, active objective (its LOCKED_ON label shows the objective's bucket), hold-to-charge neutralize, global keyboard shortcuts. |
| `SidebarRight` | `OperatorPanel` on top, then the activity map (21-day heatmap in two rows → opens Analytics for a day), recent forges, and the big nav buttons (Buckets, Analytics, Alarms, Intelligence Hub, Vault; they shrink to fit narrow widths). Hosts `ObjectiveDetails` when the details panel is open. Resizable (280–700 px). |
| `BucketSelect` | Bucket drop-down used by the sidebar add box and the template dialog: a trigger and a portalled list (z-index 20000) where every bucket shows a small rectangle in its color beside its name. Keyboard: arrows/Home/End move, Enter/Space pick, Escape closes just the list (`data-handles-escape` makes `ModalFrame` leave that Escape alone). Replaces the native `<select>`, which cannot draw colors. |
| `ObjectiveDetails` | Markdown notes editor for an objective, built on `MarkdownView` / `MarkdownToolbar` / `useMarkdownEditor`, with toolbar, shortcuts, auto-link on paste and line reordering. The header shows the title and the objective's bucket (`BucketTag`). The header has no close button (Escape closes it), so the title uses the full width. It closes on a press outside it by default (HUD sidebar); the canvas drawer passes `closeOnOutsidePress={false}`. |
| `AnalyticsView` | Day view timeline, session edit/delete, completed objectives, kill rate, category management. Reads the DB directly. |
| `IntelligenceHub` | Focus by hour, focus by day, session length distribution, fragmentation index, clean-forge ratio. Reads the DB directly. |
| `VaultPage` | Season overview, daily challenge, streak status, prestige ranks, seasonal archive, economy help. |
| `SettingsModal` | Debug speed, experience level, day start/end hours, logout, and a MANAGE section with TEMPLATES (opens `TemplateManagerModal`) and CATEGORIES (opens `CategoryManagerModal`). While a manager is open Settings' own Enter (apply) and Escape (cancel) stand down; the managers are portalled after Settings so they stack above it, and Escape closes only the manager. |
| `AlarmsModal` / `AlarmOverlay` | Manage recurring alarms; full-screen overlay when one fires (snooze/dismiss). |
| `SeasonTransitionModal` | Shown when the active season has ended; archives it and starts the next. |
| `CategoryManagerModal`, `CategoryDotPicker`, `CompletedObjectivesModal` | Category CRUD (rows are drag-sortable by a grip handle; the order is `sort_order` and drives every picker) and pickers, completed-objective browser. |
| `GlitchOverlay` | Full-screen glitch effect when an objective is neutralized. |
| `FireBackground` | Animated background that reacts to timer state. |
| `ConfirmDialog` | In-app replacement for `window.confirm` on destructive actions (built on `ModalFrame`): title, message, a red confirm button and Cancel. It starts focused on Cancel and has no Enter-to-confirm, so a stray key cannot delete anything. Used for deleting a note and deleting a bucket. |
| `ModalFrame` | Shared shell for the template dialogs: portal to `document.body` at z-index 10500, Escape (captured) closes only that dialog, typed keys never reach the HUD shortcuts or Settings, Enter in a text input submits. The frame itself is focusable and takes focus on open (so a template without fields still captures the keyboard) and is a `data-details-barrier` (clicking it does not close the details pane). It does not close on a backdrop click. |
| `SaveTemplateModal` | "Create template from task": name (prefilled with the task title), color (defaults to the task's category color), and a live list of the fields found. Copies the task's title, details and category; the task is untouched. Like the creation dialog it stays open until the save succeeds and shows an error on failure. |
| `CreateFromTemplateModal` / `TemplateButtons` | `TemplateButtons` is the row of template buttons (template order, each in its color, wraps and scrolls after about three rows) under the sidebar add box and under the add box of every canvas panel. A button opens `CreateFromTemplateModal`: one input per field, a bucket picker, a category picker and an Add to Mission checkbox. Bucket: the panel's bucket when opened from a bucket panel, else the last bucket used, else Unsorted. Category: the template's own, else the last used, else none. Add to Mission starts checked everywhere. Create stays open and shows SAVING... until the save succeeds; on failure it keeps what was typed and shows an error so the user can retry (the remembered bucket/category are only stored on success). |
| `TemplateManagerModal` | Opened from Settings. Drag-sortable list of templates; edit name, color, title, details and category (text saves on blur, category at once, color when the picker closes rather than on every drag step), see the detected fields live, delete with a confirmation. Names may repeat; spaces around a name are trimmed and an emptied name reverts. |
| `ContextMenu` | Small right-click menu rendered in a portal on `document.body` (the canvas world is CSS-scaled, which would offset a fixed-position menu). Closes on outside press, Escape (captured, so Escape does not also end the session or leave the page) and window blur/resize; clicks inside it do not bubble to the row that opened it. |
| `OperatorPanel` | Operator name/avatar (opens Settings), multiplier, daily and streak progress, forge (prestige) progress. Lives at the top of `SidebarRight`. |
| `LoginScreen`, `SetupScreen`, `UpdatePrompt`, `WindowControls`, `Footer` | Auth gate, Turso setup, update prompt, custom window buttons (minimize, maximize, close; F11 toggles maximize), footer. |

## Hooks and utilities

| Module | Purpose |
|---|---|
| `hooks/useTimer.ts` | Pure timer state machine (seconds, pause countdown, pause timestamps) that emits the timer events. |
| `hooks/usePanelDrag.ts` | Pointer move/resize drag for canvas panels and notes; snaps to the 20-unit grid by default, Shift moves/resizes freely in whole units. |
| `hooks/useMarkdownEditor.ts` | Shared markdown editing logic (shortcuts, formatting, auto-link on paste, line reordering) used by objective details and notes. |
| `hooks/useCanvasNotes.ts` | Loads and mutates the user's canvas notes (add, update, delete, bring to front) against the DB. |
| `hooks/useEscapeToClose.ts` | While a popup is open, Escape closes just that popup (window capture, stops the key so it does not also end the session, leave the page or close a dialog). Used by `CategoryDotPicker` (when given `onClose`) and `BucketSelect`. |
| `utils/gameEconomy.ts` | Pure economy functions with no side effects (see [economy.md](economy.md)). |
| `utils/canvas.ts` | Pure viewport/geometry math for the Buckets canvas (screen↔world, zoom at cursor with 0.25–2 clamp, recenter and `centerOn` a world point, `viewAt`/`easeInOutCubic` for the animated fly, panel move/resize, `snapToGrid`) plus viewport persistence. |
| `utils/templates.ts` | `extractFields(title, details)` and `fillTemplate(text, values)`. A field is `$name` (letter or `_`, then letters/digits/`_`); `$$` is the only escape and prints one `$`; `$5` and a lone `$` stay literal; fill is one pass, values are never re-expanded. |
| `utils/deadline.ts` | Pure deadline helpers: `deadlineState` (`overdue` once passed, `soon` for today and tomorrow by local calendar day, else `later`), `formatDeadline`, `defaultDeadline` (next working day 19:00), the `datetime-local` conversions and `sortByDeadline`. Deadlines are ISO strings in UTC. |
| `utils/buckets.ts` | `isHoldingBucket`: custom and Unsorted buckets hold tasks; Mission and Deadlines are views over them. `focusOrder`: the order Tab walks the panels in. |
| `utils/lastPicks.ts` | The bucket and category last used to create a task, kept in `localStorage` (`last_bucket_id`, `last_category_id`; this machine only), plus fallbacks when a remembered one was deleted. |
| `utils/markdown.ts` | Pure markdown helpers shared by the markdown view and editor. |
| `utils/audio.ts` | `soundEngine`: every UI sound is synthesised with the Web Audio API. A few longer sounds are played from files in `public/sounds/`; the two long ones (activating a task, completing one) share a channel, so starting either cuts off whichever is still playing. |
| `utils/dateUtils.ts`, `utils/statusHint.ts`, `utils/logger.ts` | Date helpers, footer status hints, logging. |

## Keyboard shortcuts

**HUD (global, ignored while typing in an input):**

| Key | Action |
|---|---|
| Space | Start / pause timer |
| Escape | End session (saves it), unless the details panel is open |
| Ctrl+Enter | Neutralize the active objective (timer must be running) |
| Enter | Open details for the active objective |
| A / I / V / B | Analytics / Intelligence Hub / Vault / Canvas |
| ↑ / ↓ | Select previous / next objective |
| Shift+↑ / Shift+↓ / Shift+Home / Shift+End | Reorder the selected objective |
| F2 | Rename objective |
| F11 | Maximize / restore the window (any view) |
| Shift+Enter (in add box) | Add objective to the top of the list |
| Enter / Escape (template dialogs) | Create (or save) / close just that dialog |

**Analytics:** ← / → previous/next day · Space jump to today · Escape back.

**Canvas page:** drag any empty space (the background, or empty space inside a panel below its tasks) / middle mouse pan · plain wheel zooms anywhere (around the cursor; only the details drawer and a note's text box keep their own wheel scrolling) · **Shift+wheel over a list that has a scrollbar scrolls that list**, elsewhere it zooms too · **Shift held before pressing pans from anywhere** (over tasks, panels and notes, without starting their drag; real buttons, text boxes, the details drawer and dialogs are excluded) ·
Tab / Shift+Tab next / previous focused panel (once one is focused by double-click) · Space fly (animated, to 100% zoom) to the last selected task's bucket (else Mission), within the space beside the drawer · F2 rename card · Escape back (closes the details drawer first) ·
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
| `tauri.conf.json` | Window (1520×960, frameless, transparent, `shadow: false` so Windows 11 does not round the corners and clip the page's 1px outline), bundle and updater endpoint config. |
| `capabilities/default.json` | Permissions: core, window close/minimize/toggle-maximize/drag, `shell:allow-open`, store, updater. |

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
