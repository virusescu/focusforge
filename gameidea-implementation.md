# FocusForge Gamification — Expanded Design & Implementation Plan

## Table of Contents

1. [Design Overview](#design-overview)
2. [UX/UI Specification](#uxui-specification)
3. [Database Schema](#database-schema)
4. [State Management Architecture](#state-management-architecture)
5. [Coin Economy Engine](#coin-economy-engine)
6. [Audio Design](#audio-design)
7. [Implementation Phases](#implementation-phases)

---

## Design Overview

### Core Principle

FocusForge Gamification layers an incremental idle-game economy on top of the existing focus timer. The game is a **dopamine reinforcement loop** for ADHD — it rewards sustained focus with tangible, compounding progression while staying invisible during active work. The game should never compete with focus for attention; it rewards focus after the fact.

### System Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│  Existing FocusForge                                            │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────────┐  │
│  │  Timer    │  │  Objectives  │  │  Analytics / Intel Hub    │  │
│  │ (useTimer)│  │  (FocusCtx)  │  │  (AnalyticsView, Intel)  │  │
│  └────┬─────┘  └──────┬───────┘  └───────────────────────────┘  │
│       │               │                                         │
│       │  timer-saved   │  objective-completed                    │
│       └───────┬───────┘                                         │
│               ▼                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  NEW: Game Economy Layer (GameContext)                    │   │
│  │  ┌────────────┐  ┌─────────┐  ┌──────────┐  ┌────────┐  │   │
│  │  │ Coin Engine │  │ Streaks │  │  Tools   │  │Seasons │  │   │
│  │  └────────────┘  └─────────┘  └──────────┘  └────────┘  │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  NEW: Vault Page UI                                      │   │
│  │  Season Overview │ Tool Shop │ Cosmetics │ Archive        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  MODIFIED: Header — Coin counter, streak indicator        │   │
│  │  MODIFIED: SidebarLeft — VAULT nav button                 │   │
│  │  NEW: RewardToast — Post-session coin notification        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

The Game Economy Layer is a **read-only consumer** of focus events. It never modifies timer behavior, session data, or objective state. It only observes completions and calculates rewards.

---

## UX/UI Specification

### 1. Header Modifications (`Header.tsx`)

The existing header shows: status indicator, operator rank, title, settings button, version, window controls.

**New elements** added to the right side of the header, between version and window controls:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ● FORGING    OPERATOR_RANK: LEAD_ENGINEER     FOCUS_FORGE           │
│                                                                      │
│              ⟐ 1,250        DAY 3/4 ▮▮▮▯      S2 · 45d    ⚙  v0.x │
│              coins          streak             season                │
└──────────────────────────────────────────────────────────────────────┘
```

- **Coin counter** (`⟐ 1,250`): Gold-tinted text (`#f0c040`), monospace. Uses a hexagonal coin icon (Unicode ⟐ or custom SVG). Number animates up when coins are earned (CSS counter transition via `transition: all 0.3s`).
- **Streak indicator** (`DAY 3/4`): 4 small bars, filled bars use `--primary` (#ee682b), unfilled use `--text-muted`. On streak completion (4/4), briefly pulses with `--secondary` glow.
- **Season timer** (`S2 · 45d`): Shows current season number + days remaining. Uses `--text-secondary` color. Turns `--primary` in last 7 days.

Implementation: These are simple `<span>` elements inside the existing `header__right` section. Data comes from `useGame()` context hook.

### 2. SidebarLeft Modifications (`SidebarLeft.tsx`)

**New button** added below the existing INTELLIGENCE_HUB button:

```
┌─────────────────────┐
│ ▸ SYSTEM_ANALYTICS   │
│ ▸ INTELLIGENCE_HUB   │
│ ▸ FORGE_VAULT        │  ← NEW
└─────────────────────┘
```

- Styled identically to existing nav buttons (same `.navButton` class).
- Click triggers `onNavigate('vault')` following existing navigation pattern.
- Keyboard shortcut: `V` (added alongside existing `A` for analytics, `I` for intel).
- Subject to the same `NavigationGuard` modal when timer is active.

### 3. Vault Page (New Component: `VaultPage.tsx`)

Full-page view, same structural pattern as AnalyticsView — takes the full content area when active. Has its own `VaultPage.module.scss`.

**Layout**:

```
┌────────────────────────────────────────────────────────────────────┐
│  ◂ BACK_TO_HUD                              FORGE_VAULT   S2 2026 │
│────────────────────────────────────────────────────────────────────│
│                                                                    │
│  ┌─── SEASON OVERVIEW ─────────────────────────────────────────┐  │
│  │                                                              │  │
│  │  ⟐ 1,250 COINS    SESSIONS: 47    STREAKS: 5/13            │  │
│  │                                                              │  │
│  │  ┌─ DAILY CHALLENGE ──────────────────────────────────────┐  │  │
│  │  │  SESSIONS TODAY: ██░ 2/3         BONUS: LOCKED          │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │  ┌─ STREAK STATUS ───────────────────────────────────────┐  │  │
│  │  │  DAY 3/4  ▮▮▮▯    MULTIPLIER: 1.35x                   │  │  │
│  │  │  [EXTEND_STREAK — 200 ⟐]                               │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │  ┌─ INCOME REPORT ───────────────────────────────────────┐  │  │
│  │  │  PASSIVE: +35 ⟐/hr    ACTIVE: +40% per session         │  │  │
│  │  │  PEAK FOCUS BONUS: +20% (45m+ unbroken)                │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─── TOOL SHOP ───────────────────────────────────────────────┐  │
│  │                                                              │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │  │
│  │  │ ☕          │  │ 🖥          │  │ 🪑          │             │  │
│  │  │ COFFEE_MKR │  │ STAND_DESK │  │ ERGO_CHAIR │             │  │
│  │  │            │  │            │  │            │             │  │
│  │  │ +5 ⟐/hr   │  │ +15% active│  │ +10 ⟐/hr  │             │  │
│  │  │            │  │            │  │            │             │  │
│  │  │ [OWNED ✓]  │  │ [300 ⟐]   │  │ [400 ⟐]   │             │  │
│  │  └────────────┘  └────────────┘  └────────────┘             │  │
│  │                                                              │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │  │
│  │  │ 🎧          │  │ 🖥🖥         │  │ 💡          │             │  │
│  │  │ NC_HEADPHN │  │ 2ND_MONIT  │  │ SMART_LITE │             │  │
│  │  │            │  │            │  │            │             │  │
│  │  │ +25% activ │  │ +20 ⟐/hr  │  │ +30% activ │             │  │
│  │  │            │  │            │  │            │             │  │
│  │  │ [500 ⟐]   │  │ [LOCKED🔒] │  │ [LOCKED🔒] │             │  │
│  │  └────────────┘  └────────────┘  └────────────┘             │  │
│  │                                                              │  │
│  │  ┌─────────────────────────────┐                             │  │
│  │  │ ⚡ ELITE_WORKSTATION         │                             │  │
│  │  │ +40% active + 100 ⟐/hr     │                             │  │
│  │  │ [LOCKED🔒 — 2,000 ⟐]       │                             │  │
│  │  └─────────────────────────────┘                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─── COSMETICS ───────────────────────────────────────────────┐  │
│  │  SOUND_PACKS    │    THEMES    │    TITLES                   │  │
│  │  ─────────────────────────────────────────                   │  │
│  │  Mechanical Bliss  [OWNED ✓]   Neon Burn [100 ⟐]            │  │
│  │  Digital Rain      [150 ⟐]     Ice Grid  [200 ⟐]            │  │
│  │  ...                           ...                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─── SEASONAL ARCHIVE ───────────────────────────────────────┐   │
│  │                                                              │  │
│  │  ┌──── S1 2026 ────┐  ┌──── S4 2025 ────┐                   │  │
│  │  │ "Spring Focused" │  │ "Winter Peak"    │                   │  │
│  │  │ 52,340 ⟐ final  │  │ 41,200 ⟐ final  │                   │  │
│  │  │ 8 tools · 12 str│  │ 6 tools · 9 str │                   │  │
│  │  │ ████████████████ │  │ ████████████████ │                   │  │
│  │  │ [VIEW_DETAILS]   │  │ [VIEW_DETAILS]   │                   │  │
│  │  └──────────────────┘  └──────────────────┘                   │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

**Section details**:

**Season Overview Card**: Glassmorphic card (`--bg-card` with `backdrop-filter: blur(12px)`) consistent with existing cards in SidebarLeft. Contains three inline sub-cards for daily challenge, streak status, and income report. Daily challenge progress bar uses `--primary` fill on `--bg-darker` track. Streak bars are small rectangles (12×4px each). "EXTEND_STREAK" button styled like existing nav buttons with cost shown; disabled (dimmed, `--text-muted`) if insufficient coins.

**Tool Shop**: Grid of tool cards (3 columns, CSS Grid `grid-template-columns: repeat(3, 1fr)` with the Elite Workstation spanning full width as a prestige item). Each card is a bordered rectangle (`1px solid var(--border)`) with:
- Tool icon (emoji or simple SVG, displayed large at 24px)
- Tool name in `--font-mono` uppercase
- Effect description in `--text-secondary`
- Purchase button or "OWNED ✓" state

**Card States**:
- **Available**: Border `--border`, buy button with `--primary` background. On hover, border glows `--primary-glow`, `box-shadow: 0 0 12px var(--primary-glow)`. Click plays `soundEngine.playClick()` + purchase confirmation sound.
- **Owned**: Border `--secondary`, "OWNED ✓" text in `--secondary`. Subtle steady glow `box-shadow: 0 0 8px var(--secondary-glow)`.
- **Locked**: Border `--text-muted`, entire card at `opacity: 0.4`. Lock icon. Tooltip on hover: "Requires [prerequisite tool] first" or "Not enough coins". Tools are locked if the preceding tool in their tier hasn't been bought (passive tools unlock linearly, active tools unlock linearly, Elite requires all others).
- **Insufficient funds**: Same as available but buy button dimmed, uses `--text-muted` text.

**Cosmetics Section**: Tabbed sub-section (SOUND_PACKS | THEMES | TITLES). Each tab shows a scrollable list. Each item is a horizontal row: name, preview button (for sounds: plays clip; for themes: shows color swatch; for titles: shows badge preview), and price/owned state. Same card styling conventions.

**Seasonal Archive**: Horizontal scrollable row of archive cards (CSS `overflow-x: auto`, custom scrollbar from `index.scss`). Each card shows season badge (colored icon matching the quarter theme), final stats summary, and a "VIEW_DETAILS" link that expands the card inline (or opens a modal) showing full breakdown: all tools owned, cosmetics, streaks completed, peak coins/hour, total sessions.

### 4. Post-Session Reward Toast (New Component: `RewardToast.tsx`)

A non-blocking notification that appears in the **bottom-right** of the viewport after session completion.

```
┌─────────────────────────────┐
│  SESSION_COMPLETE            │
│                              │
│  +62 ⟐  (+20% peak focus)   │
│  STREAK: DAY 2/4            │
│  DAILY: 2/3 sessions        │
│                              │
│  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ │
└─────────────────────────────┘
```

**Behavior**:
- Appears 0.5s after session save completes (gives DB time to commit).
- Slides in from right (`transform: translateX(100%) → translateX(0)`, 0.3s ease-out).
- Stays visible for 3 seconds.
- Auto-dismisses by fading out (`opacity: 1 → 0`, 0.5s).
- Coin number does a brief count-up animation (0 → 62 over 0.4s using `requestAnimationFrame`).
- If daily challenge completes (3rd session), shows "DAILY_BONUS_UNLOCKED — 2x" in `--secondary` with a brief flash.
- If streak milestone hit, shows "STREAK_COMPLETE — 4/4" in `--primary` with glow.
- No click handler — pure notification, no interaction needed.
- Uses `position: fixed; bottom: 20px; right: 20px; z-index: 1000`.

### 5. Season Transition Modal (New Component: `SeasonTransitionModal.tsx`)

Appears when the app detects the current date has passed the season end date.

```
┌──────────────────────────────────────────────────┐
│                                                  │
│            SEASON_COMPLETE                        │
│                                                  │
│            ◆ S1 2026 — "Spring Focused" ◆        │
│                                                  │
│     TOTAL COINS: 52,340     SESSIONS: 142        │
│     STREAKS: 8/13           TOOLS: 8/8           │
│                                                  │
│     ─────────────────────────────────────        │
│                                                  │
│     YOUR FORGE HAS BEEN ARCHIVED.                │
│     A NEW SEASON AWAITS.                         │
│                                                  │
│              [ BEGIN_S2_2026 ]                    │
│                                                  │
└──────────────────────────────────────────────────┘
```

- Background: Full-screen dark overlay with blur (same pattern as NavigationGuard).
- Badge: Large centered emblem with seasonal color.
- Stats: Key numbers in a 2×2 grid.
- CTA button: Single action "BEGIN_S{N}" that triggers the seasonal reset.
- Plays a special season-complete fanfare sound (longer, more ceremonial than regular rewards).
- Cannot be dismissed without clicking the button — ensures the player sees their achievement.

### 6. Navigation Changes (`App.tsx`)

Add `'vault'` to the view union type:

```typescript
// Current: type View = 'hud' | 'analytics' | 'intel'
// New:     type View = 'hud' | 'analytics' | 'intel' | 'vault'
```

Add keyboard shortcut `V` in the existing `handleKeyDown` handler, subject to the same NavigationGuard logic. Back button on Vault returns to HUD (Escape key also works, same as analytics/intel).

---

## Database Schema

All new tables are prefixed with `game_` to clearly separate game economy from core focus data. Added to the existing `initDb()` function in `src/db.ts`.

### New Tables

```sql
-- Tracks the current season and its start/end boundaries
game_seasons (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  season_number INTEGER NOT NULL,        -- 1, 2, 3, 4 (quarter of year)
  year          INTEGER NOT NULL,        -- 2026
  start_date    TEXT NOT NULL,           -- '2026-04-01'
  end_date      TEXT NOT NULL,           -- '2026-06-30'
  is_active     INTEGER NOT NULL DEFAULT 1, -- 0 = archived, 1 = current
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, season_number, year)
)

-- Current mutable game state for the active season
game_state (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL,
  season_id           INTEGER NOT NULL REFERENCES game_seasons(id),
  coins               REAL NOT NULL DEFAULT 0,
  total_coins_earned  REAL NOT NULL DEFAULT 0,   -- lifetime within season (never decremented)
  current_streak_days INTEGER NOT NULL DEFAULT 0, -- 0-4
  streak_last_date    TEXT,                       -- last work-day that counted toward streak
  streaks_completed   INTEGER NOT NULL DEFAULT 0, -- how many 4-day streaks finished
  sessions_today      INTEGER NOT NULL DEFAULT 0, -- resets daily
  sessions_today_date TEXT,                       -- date of last session count reset
  daily_bonus_active  INTEGER NOT NULL DEFAULT 0, -- 1 if 3 sessions hit today
  peak_coins_per_hour REAL NOT NULL DEFAULT 0,
  UNIQUE(user_id, season_id)
)

-- Static tool definitions (seeded once, read-only during gameplay)
game_tool_definitions (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,          -- 'COFFEE_MAKER'
  display_name    TEXT NOT NULL,          -- 'Coffee Maker'
  description     TEXT NOT NULL,          -- '+5 coins/hour passive'
  cost            INTEGER NOT NULL,
  effect_type     TEXT NOT NULL,          -- 'passive' | 'active' | 'prestige'
  passive_per_hour REAL NOT NULL DEFAULT 0,
  active_percent  REAL NOT NULL DEFAULT 0,
  icon            TEXT NOT NULL,          -- emoji or icon key
  unlock_order    INTEGER NOT NULL,       -- linear unlock sequence per type
  prerequisite_id INTEGER REFERENCES game_tool_definitions(id) -- NULL for first in chain
)

-- Tools the user has purchased in the current season
game_owned_tools (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  season_id     INTEGER NOT NULL REFERENCES game_seasons(id),
  tool_id       INTEGER NOT NULL REFERENCES game_tool_definitions(id),
  purchased_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, season_id, tool_id)
)

-- Static cosmetic definitions
game_cosmetic_definitions (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,            -- 'MECHANICAL_BLISS'
  display_name  TEXT NOT NULL,            -- 'Mechanical Bliss'
  category      TEXT NOT NULL,            -- 'sound_pack' | 'theme' | 'title'
  description   TEXT NOT NULL,
  cost          INTEGER NOT NULL,
  icon          TEXT NOT NULL,
  preview_data  TEXT                      -- JSON: sound file path, color scheme, etc.
)

-- Cosmetics the user has purchased (persist across seasons — cosmetics are permanent)
game_owned_cosmetics (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  cosmetic_id   INTEGER NOT NULL REFERENCES game_cosmetic_definitions(id),
  purchased_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, cosmetic_id)
)

-- Individual coin transaction log (for audit/display, not for computing balance)
game_coin_transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  season_id   INTEGER NOT NULL REFERENCES game_seasons(id),
  amount      REAL NOT NULL,              -- positive = earned, negative = spent
  reason      TEXT NOT NULL,              -- 'session_complete', 'passive_income', 'tool_purchase', 'cosmetic_purchase', 'streak_extend'
  metadata    TEXT,                       -- JSON: { session_id, multipliers applied, etc. }
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
)

-- Archived season snapshots (immutable once written)
game_season_archives (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id               INTEGER NOT NULL,
  season_id             INTEGER NOT NULL REFERENCES game_seasons(id),
  season_label          TEXT NOT NULL,     -- 'S1 2026'
  season_name           TEXT NOT NULL,     -- 'Spring Focused'
  badge_color           TEXT NOT NULL,     -- hex color for badge theme
  final_coins           REAL NOT NULL,
  total_coins_earned    REAL NOT NULL,
  total_sessions        INTEGER NOT NULL,
  total_streaks         INTEGER NOT NULL,
  tools_purchased       TEXT NOT NULL,     -- JSON array of tool names
  cosmetics_purchased   TEXT NOT NULL,     -- JSON array of cosmetic names
  peak_coins_per_hour   REAL NOT NULL,
  longest_streak        INTEGER NOT NULL,  -- longest consecutive streak run
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, season_id)
)

-- Tracks daily streak data for break detection
game_streak_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  season_id   INTEGER NOT NULL REFERENCES game_seasons(id),
  date        TEXT NOT NULL,              -- '2026-04-07'
  had_session INTEGER NOT NULL DEFAULT 0, -- 1 if at least one session completed
  streak_day  INTEGER NOT NULL DEFAULT 0, -- which day in the current streak (1-4)
  UNIQUE(user_id, season_id, date)
)
```

### New DB Functions (added to `src/db.ts`)

Following the existing pattern of exported async functions that call `getDb()`:

```
-- Season management
initOrGetActiveSeason(userId)         → game_seasons row (creates if missing)
archiveSeason(userId, seasonId)       → writes to game_season_archives, sets is_active=0
getSeasonArchives(userId)             → game_season_archives[] ordered by created_at DESC

-- Game state
getGameState(userId, seasonId)        → game_state row
updateGameState(userId, seasonId, partialState) → UPDATE game_state SET ...
resetGameStateForNewSeason(userId, seasonId) → INSERT new game_state row

-- Coin transactions
addCoinTransaction(userId, seasonId, amount, reason, metadata) → INSERT + UPDATE game_state.coins
getCoinTransactions(userId, seasonId, limit?) → game_coin_transactions[]

-- Tools
seedToolDefinitions()                 → INSERT OR IGNORE static tool data
getToolDefinitions()                  → game_tool_definitions[]
getOwnedTools(userId, seasonId)       → game_owned_tools[] JOIN game_tool_definitions
purchaseTool(userId, seasonId, toolId, cost) → INSERT owned + addCoinTransaction(-cost)

-- Cosmetics
seedCosmeticDefinitions()             → INSERT OR IGNORE static cosmetic data
getCosmeticDefinitions()              → game_cosmetic_definitions[]
getOwnedCosmetics(userId)             → game_owned_cosmetics[] (not season-scoped)
purchaseCosmetic(userId, cosmeticId, cost, seasonId) → INSERT owned + addCoinTransaction(-cost)

-- Streaks
recordDailyActivity(userId, seasonId, date) → UPSERT game_streak_log
getStreakLog(userId, seasonId)         → game_streak_log[]
```

---

## State Management Architecture

### GameContext (`src/contexts/GameContext.tsx`)

New context following the exact pattern of FocusContext:

```typescript
interface GameState {
  // Season
  season: GameSeason | null;
  seasonDaysRemaining: number;

  // Economy
  coins: number;
  totalCoinsEarned: number;
  passiveIncomePerHour: number;
  activeMultiplierPercent: number;

  // Streak
  currentStreakDays: number;        // 0-4
  streaksCompletedThisSeason: number;
  streakMultiplier: number;         // computed: 1.0 + (streaksCompleted * 0.1), max 1.5x at day 4

  // Daily challenge
  sessionsToday: number;
  dailyBonusActive: boolean;

  // Tools & cosmetics
  toolDefinitions: ToolDefinition[];
  ownedToolIds: Set<number>;
  cosmeticDefinitions: CosmeticDefinition[];
  ownedCosmeticIds: Set<number>;

  // Archives
  archives: SeasonArchive[];

  // UI state
  loading: boolean;
  rewardToast: RewardToastData | null;  // non-null triggers toast display
  showSeasonTransition: boolean;

  // Actions
  purchaseTool: (toolId: number) => Promise<boolean>;
  purchaseCosmetic: (cosmeticId: number) => Promise<boolean>;
  extendStreak: () => Promise<boolean>;
  startNewSeason: () => Promise<void>;
  dismissRewardToast: () => void;
  refreshGameData: () => Promise<void>;
}
```

**Provider placement** in component tree:

```
AuthProvider
  └─ UserProvider
     └─ FocusProvider
        └─ GameProvider    ← NEW (needs access to auth user + focus events)
           └─ App views
```

**Key behaviors**:

1. **On mount**: Calls `initOrGetActiveSeason(userId)` to ensure a season exists. Loads all game state, tools, cosmetics, archives. Seeds tool/cosmetic definitions if first run.

2. **Session completion listener**: Listens to the existing `timer-saved` CustomEvent (same event FocusContext uses). When fired:
   - Computes coin reward: `base (50) × peakFocusMultiplier × streakMultiplier × dailyBonusMultiplier × activeToolMultiplier`
   - Peak focus: if `durationSeconds >= 2700` (45min) AND `pauseTimes.length === 0` → 1.2x
   - Streak multiplier: `1.0 + (currentStreakDays / 4 * 0.5)` — so day 0 = 1.0x, day 1 = 1.125x, day 2 = 1.25x, day 3 = 1.375x, day 4 = 1.5x
   - Active tool multiplier: `1.0 + (sum of active tool percents / 100)`
   - Daily bonus: if `sessionsToday >= 3` → 2.0x
   - Writes coin transaction, updates game state, updates `sessionsToday`, checks daily challenge, checks streak advancement.
   - Sets `rewardToast` with computed data to trigger the toast UI.

3. **Passive income tick**: `setInterval` every 60 seconds (not every second — avoid unnecessary re-renders). If a session is active (reads `timerStatus` from FocusContext or the `timer-active` event), accumulates `passiveIncomePerHour / 60` coins per tick. Batches DB writes every 5 minutes to avoid excessive writes.

4. **Streak logic** (runs on mount + after session save):
   - Gets current date (work-day only: Mon=1 through Fri=5).
   - If weekend, do nothing.
   - If `streak_last_date` is yesterday (work-day wise, accounting for Fri→Mon gap): streak continues.
   - If `streak_last_date` is today: already counted, no change.
   - If `streak_last_date` is older than yesterday: streak broken, reset to day 1.
   - When `currentStreakDays` reaches 4: increment `streaksCompleted`, reset to 0, award streak milestone.

5. **Season transition check** (runs on mount):
   - Compares `new Date()` against `season.end_date`.
   - If past end date: sets `showSeasonTransition = true`. No automatic actions — waits for user to click "BEGIN" in the modal.
   - `startNewSeason()`: archives current season, creates new season, resets game state.

---

## Coin Economy Engine

### Reward Calculation (Pure Function)

```typescript
interface SessionRewardInput {
  durationSeconds: number;
  pauseCount: number;
  currentStreakDays: number;           // 0-4
  streaksCompletedThisSeason: number;
  sessionsToday: number;              // count BEFORE this session
  ownedActiveToolPercents: number[];  // [15, 25] for Standing Desk + NC Headphones
}

interface SessionRewardOutput {
  baseCoins: number;
  peakFocusBonus: boolean;
  peakFocusMultiplier: number;
  streakMultiplier: number;
  dailyBonusMultiplier: number;
  activeToolMultiplier: number;
  totalCoins: number;
  dailyChallengeJustCompleted: boolean;
}

function calculateSessionReward(input: SessionRewardInput): SessionRewardOutput {
  const base = 50;

  const peakFocus = input.durationSeconds >= 2700 && input.pauseCount === 0;
  const peakMult = peakFocus ? 1.2 : 1.0;

  const streakMult = 1.0 + (input.currentStreakDays / 4 * 0.5);

  const sessionsTodayAfter = input.sessionsToday + 1;
  const dailyMult = sessionsTodayAfter >= 3 ? 2.0 : 1.0;
  const dailyJustCompleted = input.sessionsToday < 3 && sessionsTodayAfter >= 3;

  const activePercent = input.ownedActiveToolPercents.reduce((sum, p) => sum + p, 0);
  const activeMult = 1.0 + activePercent / 100;

  const total = Math.round(base * peakMult * streakMult * dailyMult * activeMult);

  return {
    baseCoins: base,
    peakFocusBonus: peakFocus,
    peakFocusMultiplier: peakMult,
    streakMultiplier: streakMult,
    dailyBonusMultiplier: dailyMult,
    activeToolMultiplier: activeMult,
    totalCoins: total,
    dailyChallengeJustCompleted: dailyJustCompleted,
  };
}
```

This function is **pure** — no side effects, no DB access. Fully testable. The GameContext calls it and then persists the results.

### Passive Income Calculation

```typescript
function calculatePassiveIncomePerHour(ownedPassiveTools: ToolDefinition[]): number {
  return ownedPassiveTools.reduce((sum, tool) => sum + tool.passive_per_hour, 0);
}
```

Passive income accrues every minute (1/60th of hourly rate). Written to DB every 5 minutes in a batch. On app startup, computes gap since last passive tick and awards back-pay (capped at 8 hours to prevent overnight exploit — this is a work tool, not a passive income farm).

### Streak Extension Cost

```typescript
function getStreakExtendCost(currentStreakDays: number): number {
  return 100 + currentStreakDays * 50;
}
```

---

## Audio Design

New sounds added to `src/utils/audio.ts` following existing synthesized patterns:

### `playCoinEarned()`
Brief metallic chime: 2 stacked sine oscillators at 1200Hz and 1800Hz, 0.08s duration, volume 0.06. Fast attack, medium decay. Triggers on session reward.

### `playPurchase()`
Descending two-note sequence: 880Hz → 660Hz square wave, 0.1s per note, volume 0.05. Mechanical "ka-ching" feel. Triggers on tool/cosmetic purchase.

### `playStreakMilestone()`
Rising 4-note arpeggio: 440 → 550 → 660 → 880Hz sine, 0.08s per note with slight overlap, volume 0.08. Celebratory but brief. Triggers when 4-day streak completes.

### `playSeasonComplete()`
Extended fanfare: 3-note chord (440+660+880Hz) held for 1.5s with slow volume swell (0 → 0.1 over 0.5s, hold 0.5s, fade 0.5s). Layered with a low sub-bass hit at 80Hz. Only plays on season transition modal.

### `playDailyBonusUnlocked()`
Two quick ascending pings: 1000Hz → 1500Hz sine, 0.05s each, volume 0.07. Triggers when 3rd session of the day completes.

---

## Implementation Phases

### Phase 1: Database Foundation & Game State Core

**Goal**: Establish all game tables, seed data, and the core `GameContext` — no UI yet.

**Step 1.1: Create game database tables**
- **File**: `src/db.ts`
- Add all 8 `game_*` CREATE TABLE statements to the existing `initDb()` function, after the current table creation block (around line ~50-70 in the current file).
- Use `CREATE TABLE IF NOT EXISTS` matching the existing pattern.
- Add the static seed functions: `seedToolDefinitions()` and `seedCosmeticDefinitions()` that run `INSERT OR IGNORE` for each tool/cosmetic item.
- Call both seed functions at the end of `initDb()`.

**Step 1.2: Implement game DB query functions**
- **File**: `src/db.ts`
- Add all functions listed in the [New DB Functions](#new-db-functions-added-to-srcdbts) section.
- Follow existing patterns: `export async function functionName(...)`, call `const db = getDb()`, use `db.execute({ sql, args })`.
- `initOrGetActiveSeason(userId)`: Determine current quarter from `new Date()`, check for existing active season, create if missing. Quarter boundaries: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec.
- `purchaseTool()` and `purchaseCosmetic()`: Use a transaction pattern — check balance, deduct coins, insert ownership, log transaction. If balance insufficient, throw error.
- `archiveSeason()`: SELECT all relevant data, INSERT into `game_season_archives` as a snapshot, UPDATE `game_seasons` SET `is_active=0`.

**Step 1.3: Add game TypeScript types**
- **File**: `src/types/index.ts`
- Add interfaces: `GameSeason`, `GameState`, `ToolDefinition`, `OwnedTool`, `CosmeticDefinition`, `OwnedCosmetic`, `CoinTransaction`, `SeasonArchive`, `StreakLogEntry`, `RewardToastData`, `SessionRewardInput`, `SessionRewardOutput`.

**Step 1.4: Implement the coin economy engine**
- **File**: `src/utils/gameEconomy.ts` (new file)
- Implement `calculateSessionReward()`, `calculatePassiveIncomePerHour()`, `getStreakExtendCost()`, `getStreakMultiplier()`, `getSeasonLabel()`, `getSeasonName()`, `getSeasonBadgeColor()`.
- All functions are **pure** — no imports from db or contexts.

**Step 1.5: Create GameContext**
- **File**: `src/contexts/GameContext.tsx` (new file)
- Implement `GameProvider` and `useGame()` hook following the FocusContext pattern.
- On mount: initialize season, load game state, load tools + owned tools, load cosmetics + owned cosmetics, load archives.
- Listen to `timer-saved` CustomEvent: compute reward via `calculateSessionReward()`, persist via `addCoinTransaction()` + `updateGameState()`, set `rewardToast` state.
- Passive income interval: every 60s, if timer active, accumulate. Batch write every 5 min.
- Streak detection: on mount + after session, evaluate work-day logic.
- Season transition: on mount, check if current date > season end date.
- Expose all state + actions via context value.

**Step 1.6: Wire GameProvider into the component tree**
- **File**: `src/App.tsx`
- Import `GameProvider`, wrap it around the children of `FocusProvider`.
- No UI changes yet — just the provider in the tree.

**Step 1.7: Write tests for the game economy engine**
- **File**: `src/utils/gameEconomy.test.ts` (new file)
- Test `calculateSessionReward()` with various input combinations:
  - Base case (no bonuses): expect 50 coins.
  - Peak focus (45min, 0 pauses): expect 60 coins.
  - Streak at day 3: expect correct multiplier.
  - Daily bonus active: expect 2x.
  - All multipliers stacked: verify compounding math.
  - Active tools: verify percentage stacking.
- Test `getStreakExtendCost()` for each streak day (0-4).
- Test `calculatePassiveIncomePerHour()` with various tool combinations.
- Test `getSeasonLabel()`, `getSeasonName()`, `getSeasonBadgeColor()` for all 4 quarters.

**Step 1.8: Write tests for GameContext**
- **File**: `src/contexts/GameContext.test.tsx` (new file)
- Mock `../db` module (all game DB functions).
- Mock `./AuthContext` and `./FocusContext`.
- Test: initial load populates state correctly.
- Test: `timer-saved` event triggers reward calculation and state update.
- Test: `purchaseTool()` deducts coins and adds to owned set.
- Test: streak breaks correctly when day is missed.
- Test: season transition flag sets when date exceeds end.
- Test: passive income accumulates on interval.

---

### Phase 2: Header Integration & Reward Toast

**Goal**: Make the game economy visible in the existing HUD — coin counter in header, reward toast after sessions.

**Step 2.1: Add game indicators to Header**
- **File**: `src/components/Header.tsx`
- Import `useGame()` hook.
- Add a new `<div className={styles.gameIndicators}>` section in the header's right area.
- Inside: coin counter (`<span className={styles.coinCount}>⟐ {coins.toLocaleString()}</span>`), streak bars (4 `<span>` elements with conditional `styles.streakFilled` class), season timer (`<span>S{n} · {daysLeft}d</span>`).
- Coin counter: when `rewardToast` is non-null, briefly add `styles.coinPulse` class (CSS animation that scales up 1.1x and back).

**Step 2.2: Style the header game indicators**
- **File**: `src/components/Header.module.scss`
- `.gameIndicators`: `display: flex; align-items: center; gap: 16px; margin-right: 12px;`
- `.coinCount`: `color: #f0c040; font-family: var(--font-mono); font-size: 13px; transition: transform 0.3s;`
- `.coinPulse`: `animation: coinBounce 0.4s ease-out;`
- `@keyframes coinBounce { 50% { transform: scale(1.15); } 100% { transform: scale(1); } }`
- `.streakBar`: `width: 12px; height: 4px; background: var(--text-muted); border-radius: 1px;`
- `.streakFilled`: `background: var(--primary);`
- `.streakComplete`: `background: var(--secondary); box-shadow: 0 0 6px var(--secondary-glow);`
- `.seasonTimer`: `color: var(--text-secondary); font-size: 11px;`
- `.seasonUrgent`: `color: var(--primary);` (last 7 days)

**Step 2.3: Implement RewardToast component**
- **File**: `src/components/RewardToast.tsx` (new file)
- Reads `rewardToast` and `dismissRewardToast` from `useGame()`.
- If `rewardToast` is null, renders nothing.
- When non-null: renders fixed-position toast with coin breakdown, streak status, daily challenge progress.
- Coin count-up animation: `useEffect` with `requestAnimationFrame` loop, incrementing displayed number from 0 to `totalCoins` over 400ms.
- Auto-dismiss: `useEffect` with 3.5s `setTimeout` calling `dismissRewardToast()`.
- Entry animation: CSS `@keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`.
- Exit: `styles.exiting` class added 0.5s before dismiss, triggers `opacity → 0` transition.

**Step 2.4: Style RewardToast**
- **File**: `src/components/RewardToast.module.scss` (new file)
- `.toast`: `position: fixed; bottom: 20px; right: 20px; z-index: 1000; background: var(--bg-card); backdrop-filter: var(--glass); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; min-width: 260px; animation: slideIn 0.3s ease-out;`
- `.title`: `font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 8px;`
- `.coinAmount`: `font-size: 20px; color: #f0c040; font-family: var(--font-mono); font-weight: 600;`
- `.bonusTag`: `font-size: 11px; color: var(--secondary); margin-left: 8px;`
- `.streakLine`, `.dailyLine`: `font-size: 12px; color: var(--text-secondary); margin-top: 4px;`
- `.dailyComplete`: `color: var(--secondary); text-shadow: 0 0 8px var(--secondary-glow);`

**Step 2.5: Mount RewardToast in App**
- **File**: `src/App.tsx`
- Import and render `<RewardToast />` inside the GameProvider, outside the view switch — so it appears as a global overlay regardless of which view is active.

**Step 2.6: Add game audio sounds**
- **File**: `src/utils/audio.ts`
- Add methods to the existing `SoundEngine` class: `playCoinEarned()`, `playPurchase()`, `playStreakMilestone()`, `playDailyBonusUnlocked()`, `playSeasonComplete()`.
- Follow existing oscillator patterns (create osc → gain → destination → schedule).
- Wire into GameContext: play `playCoinEarned()` on session reward, `playStreakMilestone()` on streak completion, `playDailyBonusUnlocked()` on daily challenge completion.

---

### Phase 3: Vault Page — Season Overview & Tool Shop

**Goal**: Build the Vault page with the first two sections: season dashboard and tool purchasing.

**Step 3.1: Add Vault navigation**
- **File**: `src/App.tsx`
  - Add `'vault'` to the view type.
  - Add `case 'vault': return <VaultPage onBack={() => setView('hud')} />;` in the view switch.
- **File**: `src/components/SidebarLeft.tsx`
  - Add "FORGE_VAULT" button below "INTELLIGENCE_HUB", same styling, calls `onNavigate('vault')`.
- **File**: `src/components/MainDisplay.tsx` (keyboard handler)
  - Add `case 'v': navigate('vault');` alongside existing 'a' and 'i' handlers.
- **File**: `src/components/NavigationGuard.tsx`
  - No changes needed — already guards all navigation via the `pendingNavigation` pattern.

**Step 3.2: Create VaultPage component shell**
- **File**: `src/components/VaultPage.tsx` (new file)
- Props: `onBack: () => void`.
- Structure: Back button header (same pattern as AnalyticsView), then vertically stacked sections.
- Import `useGame()` for all data.
- Keyboard: Escape → `onBack()`.

**Step 3.3: Implement Season Overview section**
- Inside `VaultPage.tsx` (or extracted as `VaultSeasonOverview.tsx` if it grows large).
- Three sub-cards in a horizontal flex row:
  - **Daily Challenge**: Progress bar (`<div>` with width % = `sessionsToday / 3 * 100`), session count text, bonus status (LOCKED / ACTIVE).
  - **Streak Status**: 4 streak bars (same component logic as header but larger), multiplier text, "EXTEND_STREAK" button. Button calls `extendStreak()`, disabled if `coins < getStreakExtendCost(currentStreakDays)` or streak not broken.
  - **Income Report**: Passive rate, active multiplier %, peak focus bonus explanation. All computed from `useGame()` state.

**Step 3.4: Implement Tool Shop section**
- Inside `VaultPage.tsx` or extracted as `VaultToolShop.tsx`.
- CSS Grid layout: `grid-template-columns: repeat(3, 1fr); gap: 16px;`.
- Map over `toolDefinitions`, for each tool render a card:
  - Icon (emoji, large), name, description, effect text, cost.
  - State logic: `isOwned = ownedToolIds.has(tool.id)`, `isLocked = tool.prerequisite_id && !ownedToolIds.has(tool.prerequisite_id)`, `canAfford = coins >= tool.cost`.
  - Click handler: if !owned && !locked && canAfford → `purchaseTool(tool.id)`. Play `soundEngine.playPurchase()`. Coin counter in header will react via context update.
  - Elite Workstation card: full-width (`grid-column: 1 / -1`), larger, uses `--primary` accent border when available, `--secondary` when owned.

**Step 3.5: Style VaultPage**
- **File**: `src/components/VaultPage.module.scss` (new file)
- Follow existing styling conventions: `--bg-card`, glassmorphism, `--font-mono` for labels, monospace uppercase naming convention for headings.
- `.vault`: `padding: 24px; max-width: 900px; margin: 0 auto; overflow-y: auto;` (scrollable within content area).
- `.sectionTitle`: `font-family: var(--font-mono); font-size: 11px; letter-spacing: 2px; color: var(--text-muted); border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 16px;`
- Tool card states: use existing design token combinations documented in the UX spec.
- Hover transitions: `transition: border-color 0.2s, box-shadow 0.2s;`

---

### Phase 4: Vault Page — Cosmetics & Seasonal Archive

**Goal**: Complete the Vault page with cosmetics store and the seasonal archive browser.

**Step 4.1: Implement Cosmetics section**
- Inside `VaultPage.tsx` or extracted as `VaultCosmetics.tsx`.
- Tab bar with 3 tabs: SOUND_PACKS, THEMES, TITLES. Use local state `activeTab` to switch content.
- Tab styling: horizontal flex, active tab has `border-bottom: 2px solid var(--primary)`, inactive use `--text-muted`.
- Each cosmetic item is a horizontal row: icon, name, description, preview button, price/owned badge.
- Preview button for sounds: calls a preview function (e.g., `soundEngine.playPreview(cosmetic.preview_data)`). For themes: shows a small color swatch inline. For titles: shows the title badge text.
- Purchase: same pattern as tools — `purchaseCosmetic(id)`, play purchase sound, update context.
- Cosmetics persist across seasons (owned_cosmetics table has no season_id constraint).

**Step 4.2: Implement Seasonal Archive section**
- Inside `VaultPage.tsx` or extracted as `VaultArchive.tsx`.
- Horizontal scrollable row: `display: flex; overflow-x: auto; gap: 16px; padding-bottom: 8px;` with the existing custom scrollbar styles from `index.scss`.
- Each archive card:
  - Badge icon (colored circle/hexagon using `badge_color` from archive).
  - Season label ("S1 2026") and name ("Spring Focused").
  - Stats: final coins, tools count, streaks count.
  - Small bar visualization: a mini progress bar showing `total_coins_earned` relative to max across all archived seasons (so users can compare visually).
  - "VIEW_DETAILS" button: toggles an expanded state (local `expandedArchiveId` state) that shows full breakdown below the card row — all tools purchased, cosmetics, peak coins/hour, longest streak.
- If no archives yet: show placeholder text "NO_ARCHIVED_SEASONS — Complete your first season to see it here."

**Step 4.3: Implement Season Transition Modal**
- **File**: `src/components/SeasonTransitionModal.tsx` (new file)
- Reads `showSeasonTransition` and `startNewSeason` from `useGame()`.
- If `showSeasonTransition` is false, renders nothing.
- Full-screen overlay: same backdrop pattern as `NavigationGuard.tsx` (`position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); z-index: 2000;`).
- Centered content card with season badge, final stats (2×2 grid), narrative text, and single CTA button.
- CTA button calls `startNewSeason()` → archives current season, creates new one, resets game state, dismisses modal.
- Plays `soundEngine.playSeasonComplete()` on mount (once).
- Not dismissible via Escape or clicking outside — must click the button.

**Step 4.4: Mount SeasonTransitionModal in App**
- **File**: `src/App.tsx`
- Render `<SeasonTransitionModal />` inside `GameProvider`, as a sibling to `<RewardToast />`.

**Step 4.5: Style archive and transition modal**
- **File**: `src/components/VaultPage.module.scss` — add archive card styles.
- **File**: `src/components/SeasonTransitionModal.module.scss` (new file) — overlay, centered card, badge, stats grid, button. Use `--primary` for the CTA button background, seasonal `badge_color` for the badge element.

---

### Phase 5: Polish, Cosmetic Effects & Testing

**Goal**: Finalize all game behaviors, add visual polish, comprehensive testing, and edge case handling.

**Step 5.1: Implement cosmetic effects system**
- **File**: `src/utils/cosmeticEffects.ts` (new file)
- Sound packs: Map cosmetic IDs to alternative audio functions. When a sound pack is "active" (most recently purchased, or user-selected), override the default `playObjectiveComplete()` / `playCoinEarned()` etc. with the pack's variants. Store active sound pack ID in `game_state` or `user_settings`.
- Themes: Map cosmetic IDs to CSS variable overrides. When a theme is active, inject a `<style>` tag or use `document.documentElement.style.setProperty()` to override `--primary`, `--secondary`, `--bg-darker` etc. Store active theme ID.
- Titles: Map cosmetic IDs to title text. Display active title in the operator card in `SidebarLeft.tsx` (below the name, in `--text-secondary` italic).

**Step 5.2: Edge case handling**
- **File**: `src/contexts/GameContext.tsx`
- **Midnight rollover**: If the user is working past midnight, `sessionsToday` must reset. Check `sessions_today_date` against current date on each session save; if different, reset count.
- **Passive income cap**: Cap back-pay on startup to 8 working hours (prevent overnight/weekend exploit). Calculate: `min(hoursSinceLastTick, 8) * passiveRate`.
- **Weekend streak logic**: Friday is a valid work day. If user completes a session on Friday, streak continues. Monday should check against Friday (not Sunday). The gap between Friday and Monday is not a "missed day."
- **Season boundary at midnight**: If a session starts before season end and finishes after, the coins go to the current (ending) season. The transition modal appears next time the app opens/refreshes.
- **No sessions yet this season**: Ensure all UI gracefully handles zero state — 0 coins, no tools, no streaks, empty archive.

**Step 5.3: Passive income visibility**
- In the header coin counter: when passive income ticks, briefly flash the coin count (add/remove `styles.passiveTick` class which does a subtle color pulse, not the full bounce used for session rewards).
- In the Vault income report: show "PASSIVE_EARNINGS_THIS_SESSION: +{n} ⟐" as a running counter during active sessions.

**Step 5.4: Write comprehensive Vault page tests**
- **File**: `src/components/VaultPage.test.tsx` (new file)
- Mock `useGame()` with various states.
- Test: renders season overview with correct data.
- Test: tool cards show correct states (owned, locked, available, insufficient funds).
- Test: clicking purchasable tool calls `purchaseTool()`.
- Test: locked tools are not clickable.
- Test: cosmetic tabs switch content.
- Test: archive cards render with correct data.
- Test: empty archive shows placeholder.

**Step 5.5: Write RewardToast tests**
- **File**: `src/components/RewardToast.test.tsx` (new file)
- Test: renders nothing when `rewardToast` is null.
- Test: renders coin breakdown when toast data present.
- Test: shows daily bonus text when `dailyChallengeJustCompleted` is true.
- Test: auto-dismiss calls `dismissRewardToast()` after timeout.

**Step 5.6: Write SeasonTransitionModal tests**
- **File**: `src/components/SeasonTransitionModal.test.tsx` (new file)
- Test: renders nothing when `showSeasonTransition` is false.
- Test: renders modal with stats when true.
- Test: clicking CTA calls `startNewSeason()`.

**Step 5.7: Integration / end-to-end smoke tests**
- **File**: `src/integration/gameLoop.test.tsx` (new file)
- Full provider tree (AuthProvider → UserProvider → FocusProvider → GameProvider).
- Simulate: dispatch `timer-saved` event → verify GameContext state updates (coins, sessions_today, streak).
- Simulate: 3 sessions in one day → verify daily bonus activates.
- Simulate: 4 consecutive work days → verify streak completion.
- Simulate: purchase tool → verify coins deducted, tool in ownedToolIds.
- Simulate: season end → verify archive created, state reset.

**Step 5.8: Final polish pass**
- Review all new SCSS files for consistency with existing design tokens.
- Verify all new keyboard shortcuts don't conflict with existing ones.
- Ensure all new audio sounds are balanced volume-wise with existing sounds.
- Verify NavigationGuard still works correctly for the Vault view.
- Test with `debug_speed` setting to verify timer multiplier doesn't affect coin economy (coins should be based on real duration, not debug-accelerated duration).

---

## File Summary

### New Files
| File | Purpose |
|------|---------|
| `src/utils/gameEconomy.ts` | Pure functions for coin/streak/season calculations |
| `src/utils/gameEconomy.test.ts` | Tests for economy engine |
| `src/utils/cosmeticEffects.ts` | Cosmetic effect application (sounds, themes, titles) |
| `src/contexts/GameContext.tsx` | Game state management provider |
| `src/contexts/GameContext.test.tsx` | Tests for GameContext |
| `src/components/VaultPage.tsx` | Main Vault page component |
| `src/components/VaultPage.module.scss` | Vault page styles |
| `src/components/VaultPage.test.tsx` | Tests for Vault page |
| `src/components/RewardToast.tsx` | Post-session reward notification |
| `src/components/RewardToast.module.scss` | Toast styles |
| `src/components/RewardToast.test.tsx` | Tests for RewardToast |
| `src/components/SeasonTransitionModal.tsx` | Season-end modal |
| `src/components/SeasonTransitionModal.module.scss` | Modal styles |
| `src/components/SeasonTransitionModal.test.tsx` | Tests for modal |
| `src/integration/gameLoop.test.tsx` | Integration tests for full game loop |

### Modified Files
| File | Changes |
|------|---------|
| `src/db.ts` | Add 8 game tables to `initDb()`, add ~15 new query functions, add seed functions |
| `src/types/index.ts` | Add ~12 new interfaces for game entities |
| `src/App.tsx` | Add `'vault'` view, mount GameProvider, mount RewardToast + SeasonTransitionModal |
| `src/components/Header.tsx` | Add coin counter, streak bars, season timer |
| `src/components/Header.module.scss` | Styles for game indicators |
| `src/components/SidebarLeft.tsx` | Add "FORGE_VAULT" navigation button |
| `src/components/MainDisplay.tsx` | Add 'V' keyboard shortcut |
| `src/utils/audio.ts` | Add 5 new sound synthesis methods to SoundEngine |
