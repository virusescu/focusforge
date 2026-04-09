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
- **Vault (Game Economy)** — Coin earnings, tool shop (8 tools), streaks, daily challenges, prestige titles (10 ranks), seasonal resets with archives
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

