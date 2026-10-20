# FocusForge: Strategic Blueprints

> **GUIDANCE: DOPAMINE-DRIVEN DESIGN**
> FocusForge is built for the ADHD brain. To combat dopamine deficiency, every feature must prioritize **novelty, visceral feedback, and immediate micro-rewards**. Avoid "administrative" tasks; favor "tactical achievements."

---

## Implementation Status

All core systems are implemented and shipping:

- **Task Management** — Objective pool with drag-to-reorder, lock-on targeting, neutralization with GlitchOverlay, Ctrl+Enter shortcut
- **Visceral Momentum** — Performance tiers, segmented progress ring, pause limit enforcement, neural heat activity map, interruption cracks
- **Sound Engine** — Full Web Audio API synthesis (start, pause, reset, click, hover, key, denied, objective completion)
- **Analytics** — Day view timeline, operator diagnostics, global stats, heatmap drill-down, session deletion, keyboard navigation
- **Intelligence Hub** — Focus-by-hour patterns, day-of-week analysis, session length distribution, fragmentation index
- **Objective Categories** — Color-coded categories with inline assignment, drag-and-drop reorder
- **Kill Rate** — Objective throughput metric (day/week/all-time) in operator diagnostics
- **Vault (Score & Progression)** — Coins as a score (no spending), streaks, daily challenge, prestige titles (12 ranks), seasonal resets with archives. Tool shop, streak repair and reward toasts were removed — see [economy.md](economy.md)
- **Canvas sticky notes** — Done: colored, movable, resizable markdown notes on the Buckets canvas
- **Google OAuth** — Multi-user auth via system browser callback
- **Cloud Database** — Turso (LibSQL) with user_id scoping
- **OTA Updates** — Tauri updater plugin, GitHub Actions CI/CD, signed releases, update prompt on startup

---

## Future Ideas

### 1. Project Forge Rewards (Variable Micro-Rewards)
*Goal: Provide unpredictable, positive reinforcement for sustained focus.*

- **The Loot System**: Every completed forge session has a chance to "extract" a reward (e.g., a new schematic, a UI color accent, or a tactical soundbite).
- **Duration Scaling**: Probability and "rarity" of rewards increase with uninterrupted session length.
  - *Short Burst (15m):* Low chance of common drop.
  - *Deep Forge (45m+):* Guaranteed high-quality drop.
- **Collection Log**: A new HUD tab where the operator can view their "Extracted Schematics."
- **Focus**: Purely positive reinforcement. No penalties for stopping, only escalating rewards for continuing.

### 2. Advanced Analytical Screens (The Neuro-Visualizer)
*Goal: Transform boring metrics into visceral, game-like visualizations for the ADHD brain.*

- **The Context-Switching Ghost (Fragmented Flow)**: Semi-transparent "electrical arcs" connect objective completion dots to the sessions they happened in. Tangled arcs = high task switching; thick, glowing arcs = deep flow. Visualizes the hidden cost of "skipping" between tasks without using judgmental language.
- **The "Dopamine Hot Zone" Overlay**: A secondary heat-layer on the 18-hour timeline highlighting hours with the highest objective completion density. Pulsing high-contrast colors (Electric Blue). Identifies the operator's "Prime Time."
- **The Combo Meter (Momentum Tracking)**: A "Streak Counter" tracking consecutive forge days or objectives neutralized without a reboot. Reaching milestones unlocks temporary UI color shifts or new audio sets.

### 3. Category-Based Analytics Integration
*Goal: Extend objective categories into the analytics layer for deeper pattern recognition.*

- **Timeline Coloring**: Objective completion dots on the Day View timeline colored by category. Uncategorized objectives get a 1px orange outline stroke.
- **Kill Rate Breakdown**: Kill Rate metric split by category: "3 hard / 5 normal / 2 easy neutralized."
- **Pattern Tracking**: Track category completion ratios to surface patterns like "you avoid hard tasks on Fridays."

---

## Ideas Backlog (Oct 2026)

Small, practical ideas. Nothing here is started. Keep each one simple.

### 4. Quick Capture Hotkey (wanted)
*Goal: add a task from anywhere on the machine without opening the app.*

- **Trigger**: a system-wide shortcut (e.g. `Ctrl+Shift+Alt+T`) via `tauri-plugin-global-shortcut`. Configurable in Settings. Registration can fail if another app owns the combo, so show an in-app message.
- **Popup**: a second small borderless, centered, always-on-top Tauri window (about 480x140), hidden at startup and styled like the HUD. The shortcut shows it and focuses the text box. Enter saves, Esc or clicking away hides it. Optional bucket and category pickers.
- **Saving**: the popup does not touch the database. It emits an event to the main window, which already holds the login and Turso connection, and adds the task through the normal code path.
- **Caveats**: only works while the app is running. Closing the app entirely means no listener, so this probably needs a tray icon where closing the window hides it (a behaviour change, to be decided). Focus and always-on-top behaviour need checking on a real desktop. Needs a Tauri permission entry and docs/tests. Estimate: about half a day.

### 5. Collapsible Regions in the Details Pane (wanted)
*Goal: fold long task details without any new syntax to learn.*

- **Design**: a chevron next to each `#`, `##` and `###` heading hides everything under it until the next heading of the same or higher level.
- **Where**: lives in `MarkdownView`, so Canvas notes get it for free. Checkboxes and `[c]` copy buttons must keep working.
- **State**: everything starts expanded. Remember collapsed sections per task on this machine.
- **Estimate**: small to medium, a few hours with tests.

### 6. Command Palette (`Ctrl+K`)
Type to jump to any task, note or bucket, or run an action such as "new Bug from template". Cheap, since everything it needs already exists.

### 7. Time per Task
Show focus time per task on the card and in Analytics. Only works if sessions record the active task, so check that first.

### 8. Recurring Templates
"Create Weekly review every Monday". Builds on templates, with scheduling ideas borrowed from alarms.

### 9. End-of-Day Wrap-up
A short summary when the day ends (what was finished, how long was focused) that offers to move stale tasks forward.

### Housekeeping Under Consideration
- Remove some of the trackers and clean up history after a season ends. Undecided. Removing history is hard to undo, so decide after seeing what feels like noise over a full season.
