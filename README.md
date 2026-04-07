# FocusForge

FocusForge is a desktop productivity HUD (Heads-Up Display) built with **Tauri 2**, **React 19**, and **TypeScript**. It combines a precision focus timer with a full gamification economy — coins, tools, streaks, prestige ranks, and seasonal resets — designed to reinforce sustained deep work through game-loop psychology.

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (latest LTS)
- [Rust](https://www.rust-lang.org/) (for Tauri)
- A [Turso](https://turso.tech/) account — FocusForge uses Turso as its database. Each user brings their own database. Create a free account at [turso.tech](https://turso.tech), create a database, and copy the **Database URL** and **Auth Token**. The app will ask for these on first launch — no `.env` needed for end users.
- A Google OAuth client ID and secret — create a **Desktop App** OAuth client in [Google Cloud Console](https://console.cloud.google.com) and copy the credentials into your `.env` file (see `.env.example`).

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your Google OAuth credentials:
   ```
   VITE_GOOGLE_CLIENT_ID=your-client-id
   VITE_GOOGLE_CLIENT_SECRET=your-client-secret
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
  Or simply: `run_debug.bat`

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

Run `deploy_release.bat` to ship a new version:
1. Auto-increments the patch version across `tauri.conf.json`, `Cargo.toml`, and `package.json`
2. Commits the version bump, tags it, and pushes to GitHub
3. GitHub Actions takes over — builds, signs, and publishes the release automatically

Monitor the build at `github.com/virusescu/focusforge/actions`. The finished installer appears under [Releases](https://github.com/virusescu/focusforge/releases).

**First-time setup:** Before the first release, follow [`docs/ota-guide.md`](docs/ota-guide.md) to generate signing keys and add the required GitHub repository secrets:

| Secret | Purpose |
|--------|---------|
| `TAURI_SIGNING_PRIVATE_KEY` | Signs release artifacts |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Key password |
| `VITE_GOOGLE_CLIENT_ID` | Baked into the build for OAuth |
| `VITE_GOOGLE_CLIENT_SECRET` | Baked into the build for OAuth |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for release notifications |
| `TELEGRAM_CHAT_ID` | Telegram chat ID to receive notifications |

### OTA Updates

Installed copies check for updates on startup. If a new version is available, users see a prompt to install and restart. No manual download needed after the initial install.

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
