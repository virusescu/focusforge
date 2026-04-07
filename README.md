# FocusForge

FocusForge is a desktop productivity HUD (Heads-Up Display) built with **Tauri 2**, **React 19**, and **TypeScript**. It combines a precision focus timer with a full gamification economy — coins, tools, streaks, prestige ranks, and seasonal resets — designed to reinforce sustained deep work through game-loop psychology.

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (latest LTS)
- [Rust](https://www.rust-lang.org/) (for Tauri)
- A [Turso](https://turso.tech/) database with credentials in `.env`:
  ```
  VITE_TURSO_DATABASE_URL=...
  VITE_TURSO_AUTH_TOKEN=...
  ```

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Development
- Run the web version in your browser:
  ```bash
  npm run dev
  ```
- Run the Tauri desktop application:
  ```bash
  npm run tauri dev
  ```

### Testing
- Run the unit & integration tests:
  ```bash
  npm test
  ```
- Run tests in watch mode:
  ```bash
  npm run test:watch
  ```

### Building & Releasing
The `deploy_release.ps1` script handles versioning and builds:
1. Auto-increments the patch version across `tauri.conf.json`, `Cargo.toml`, and `package.json`
2. Commits the version bump
3. Runs `npm run tauri build` to produce a Windows MSI installer

## Tech Stack
- **Frontend**: React 19, TypeScript 5.9, Vite 8
- **Desktop**: Tauri 2 (Rust)
- **Database**: Turso (cloud LibSQL) via `@libsql/client`
- **Auth**: Google OAuth
- **Audio**: Custom Web Audio API synthesis (zero external assets)
- **Styling**: SCSS (CSS Modules)
- **Icons**: Lucide React
- **Drag & Drop**: @dnd-kit
- **Testing**: Vitest, React Testing Library

## Key Features

### Neural Forge Timer
Precision focus timer with keyboard-first controls (Space, Escape, Ctrl+Enter). Includes a charge mechanic — hold-click to build charge and neutralize the active objective. Synthesized audio feedback on every interaction.

### Objectives & Categories
Drag-and-drop prioritized objectives with custom color-coded categories. Inline editing, completion tracking, and kill-rate analytics.

### Analytics View
21-day focus heatmap with an interactive day-view timeline (00:00–24:00). Sessions rendered as horizontal bars with objective completion overlays. Zoomable and draggable for detailed inspection.

### Intelligence Hub
Aggregated diagnostics: focus-by-hour heatmap, day-of-week patterns, session length distribution, and fragmentation analysis (pause counts per session).

### Vault (Game Economy)
Full coin economy with earning, spending, and progression:

- **Coin Earnings**: 1 coin/min base, scaled by duration milestones (up to 2x at 60+ min), pause penalties, streak multipliers (up to 3x), and daily challenge bonuses.
- **Tool Shop**: 8 purchasable tools — passive income generators and active session multipliers, culminating in the Elite Workstation prestige tool.
- **Streaks**: Consecutive work-day chains (Mon–Fri) where completing the daily challenge (3 sessions of 30+ min) extends the streak. Broken streaks can be repaired with coins.
- **Prestige Titles**: 10 ranks from Initiate to Forge Legend, unlocked by total coins earned per season.
- **Seasons**: Quarterly resets (Q1–Q4). All coins and tools reset, but full snapshots are archived with badges and stats.

### Reward Toasts
Post-session notification showing base coins, multipliers applied, streak status, and total earned. Accompanied by coin and milestone sound effects.

## Architecture
- **`src/contexts/`** — State providers: Auth, Focus (timer/objectives), Game (economy), User (settings)
- **`src/components/`** — UI components: MainDisplay, AnalyticsView, IntelligenceHub, VaultPage, SidebarLeft, Header, etc.
- **`src/hooks/`** — Reusable logic: `useTimer`, `useSystemLog`
- **`src/utils/`** — Audio synthesis engine, game economy calculations, logging
- **`src/db.ts`** — Turso database layer (100+ functions covering all tables)
- **`src/auth.ts`** — Google OAuth flow
- **`src-tauri/`** — Rust backend with Tauri plugins (logging, shell, store)

## Keyboard Shortcuts
| Key | Action |
|-----|--------|
| Space | Start / Pause timer |
| Escape | Reset timer |
| Ctrl+Enter | Neutralize objective |
| A | Toggle Analytics |
| I | Toggle Intelligence Hub |
| V | Toggle Vault |
