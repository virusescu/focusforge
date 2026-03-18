# FocusForge — MVP Project Plan

## Milestones Overview

| # | Milestone | Description |
|---|-----------|-------------|
| M0 | Project Bootstrap | Unity project created, dependencies installed, folder structure finalized |
| M1 | Data Layer | SQLite integration, schema creation, settings file, repository pattern |
| M2 | Core Session Engine | Timer, multiplier logic, pause rules, resource tick, streak tracking |
| M3 | Planning Terminal UI | Task CRUD, category assignment, critical path flagging |
| M4 | Active Forge UI | Session screen with timer, controls, placeholder visuals, interrupt modal |
| M5 | Analytics Lab UI | Daily summary view with third-party charting |
| M6 | Polish & Integration | End-to-end flow, edge cases, config validation, build pipeline |

---

## M0 — Project Bootstrap

- [ ] Create Unity project (Unity 6) in this workspace via Unity Hub
- [ ] Install SQLite plugin for Unity (e.g., `sqlite-net` or `SQLite4Unity3d`)
- [ ] Set `Application.targetFrameRate = 60`
- [ ] Configure windowed mode (non-fullscreen, resizable)
- [ ] Set up Assembly Definitions for Scripts (`FocusForge.Runtime`, `FocusForge.Editor`)
- [ ] Create `settings.json` template in `StreamingAssets/` or user data folder
- [ ] Verify project compiles and runs with an empty scene

---

## M1 — Data Layer

### M1.1 — SQLite Service
- [ ] Create `SQLiteService.cs` — manages DB connection lifecycle (open/close/migrate)
- [ ] Create DB file in `Application.persistentDataPath`
- [ ] Implement schema migration (create tables on first run)

### M1.2 — Repository Classes
- [ ] `TaskRepository.cs` — CRUD for Tasks table
- [ ] `SessionRepository.cs` — CRUD for Sessions table
- [ ] `InterruptRepository.cs` — CRUD for Interrupts table
- [ ] `InventoryRepository.cs` — CRUD for Inventory table (scaffolded, minimal usage in MVP)

### M1.3 — Settings Manager
- [ ] `SettingsManager.cs` — Load/save `settings.json` from disk
- [ ] Expose settings as a singleton or ScriptableObject
- [ ] Default values: tickSeconds=60, pauseLimit=180s, maxPauses=4, rareDropChance=0.05, streakTarget=4

---

## M2 — Core Session Engine

### M2.1 — Session Timer
- [ ] `SessionManager.cs` — Start, pause, resume, stop session
- [ ] Track elapsed active time (excluding pauses)
- [ ] Track pause count and individual pause durations

### M2.2 — Multiplier System
- [ ] `MultiplierCalculator.cs` — Given elapsed time, return current multiplier tier
- [ ] Emit events on tier change (for UI/visual state updates)

### M2.3 — Resource Tick
- [ ] `ResourceTickService.cs` — Award resources on each tick interval
- [ ] Apply multiplier to Scrap yield
- [ ] At tier 3 ($t \ge 60$), roll 5% chance for Rare Core instead of Scrap
- [ ] Accumulate totals on the active Session record

### M2.4 — Pause Rules
- [ ] Enforce single pause max duration (3 min → auto-terminate)
- [ ] Track rolling 1-hour window of pause events (>4 → auto-terminate)
- [ ] On auto-terminate: save session with `TerminationReason`, keep earned rewards

### M2.5 — Streak Tracker
- [ ] `StreakTracker.cs` — Count consecutive sessions with $t \ge 60$
- [ ] Award Super Core when streak reaches 4, reset counter
- [ ] Persist streak counter (in settings.json or a dedicated DB field)

---

## M3 — Planning Terminal UI

### M3.1 — Task List View
- [ ] UI Toolkit layout: scrollable list of tasks
- [ ] Display task title, category, critical path flag, completion status
- [ ] Sort: critical path tasks at top, then by creation date

### M3.2 — Task Editor
- [ ] Create new task form (title, category dropdown, critical path toggle)
- [ ] Edit existing task
- [ ] Delete task (with confirmation)
- [ ] Mark task as completed

### M3.3 — Session Launcher
- [ ] Select a task from the list to start a session
- [ ] "Start Session" button → transitions to Active Forge screen

---

## M4 — Active Forge UI

### M4.1 — Session HUD
- [ ] Timer display (MM:SS or HH:MM:SS)
- [ ] Current multiplier tier label + visual indicator
- [ ] Scrap counter (running total)
- [ ] Rare Core counter (running total)
- [ ] Pause budget display (pauses remaining, current pause duration if paused)

### M4.2 — Controls
- [ ] Pause / Resume button
- [ ] Stop Session button (voluntary end, saves rewards)
- [ ] Emergency Stop button → opens Interrupt modal

### M4.3 — Interrupt Modal
- [ ] Category selector (Meeting, Colleague, BrainFog, Physical, Phone)
- [ ] Optional description text field
- [ ] Submit → logs interrupt, ends session

### M4.4 — Placeholder Visuals
- [ ] 3 placeholder prefabs representing factory states (colored panels with text)
- [ ] Swap active prefab based on current multiplier tier
- [ ] Simple transition effect (fade or instant swap)

---

## M5 — Analytics Lab UI

### M5.1 — Daily Summary View
- [ ] Query sessions grouped by day
- [ ] Display per-day: total focus time, total Scrap, total Rare Cores, session count
- [ ] Scrollable list or simple table layout

### M5.2 — Charting
- [ ] Integrate third-party Unity charting library (evaluate options during M0)
- [ ] Simple bar chart: focus minutes per day for the last 7/14/30 days

### M5.3 — Lifetime Stats
- [ ] Total Scrap earned (all time)
- [ ] Total Rare Cores earned (all time)
- [ ] Total Super Cores earned (all time)
- [ ] Longest single session
- [ ] Current hyperfocus streak count

---

## M6 — Polish & Integration

### M6.1 — Navigation
- [ ] Screen manager: Planning Terminal ↔ Active Forge ↔ Analytics Lab
- [ ] Prevent navigation away from Active Forge while session is running (confirm dialog)

### M6.2 — Edge Cases
- [ ] App closed mid-session → auto-save session with TerminationReason = "AppClosed"
- [ ] Empty task list → disable "Start Session" button
- [ ] Settings file missing → regenerate with defaults

### M6.3 — Build
- [ ] Windows standalone build profile
- [ ] Set product name, company name, icon (placeholder)
- [ ] Test built executable end-to-end

---

## Dependency Order

```
M0 (Bootstrap)
 └─► M1 (Data Layer)
      ├─► M2 (Session Engine) — needs repositories + settings
      └─► M3 (Planning Terminal UI) — needs TaskRepository
           └─► M4 (Active Forge UI) — needs session engine + task selection
                └─► M5 (Analytics Lab) — needs session data to display
                     └─► M6 (Polish) — integration of all parts
```

---

## Tech Decisions (MVP)

| Decision | Choice |
|----------|--------|
| Unity version | Unity 6 |
| UI framework | UI Toolkit |
| Database | SQLite (via sqlite-net or SQLite4Unity3d) |
| Settings storage | Local JSON file (`settings.json`) |
| Charting | Third-party (TBD — evaluate during M0) |
| Art style (MVP) | Placeholder colored shapes + text labels |
| Gemini API | Not used in MVP |
| Platform | Windows only |
| FPS target | 60 |
