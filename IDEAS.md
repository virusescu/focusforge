# FocusForge: Strategic Blueprints

> **GUIDANCE: DOPAMINE-DRIVEN DESIGN**
> FocusForge is built for the ADHD brain. To combat dopamine deficiency, every feature must prioritize **novelty, visceral feedback, and immediate micro-rewards**. Avoid "administrative" tasks; favor "tactical achievements."

---

## Implementation Status

### ✅ Implemented

**Task Management (MISSION_OBJECTIVES)**
- **Objective Pool**: Add, delete, and drag-to-reorder objectives in the SidebarLeft. Persisted via SQLite via Tauri.
- **Lock-On**: Clicking an objective sets it as the active target. The active objective is shown in the MainDisplay HUD with a `LOCKED_ON` label and a `NEUTRALIZE` button.
- **Target Neutralization**: Completing an active objective triggers the full GlitchOverlay event — full-screen glitch animation, scanlines, noise, B&W flash, `OBJECTIVE_COMPLETED` message with letter-by-letter reveal, and an audio boom/chime sequence.
- **Keyboard shortcut**: `Ctrl+Enter` neutralizes the active objective while the timer is running.

**Visceral Momentum**
- **Performance Tiers**: As session time increases, the boost banner escalates — `80% → 120% → 150% → 180% PERFORMANCE` at 0/15/30/60-minute milestones.
- **Segmented Progress Ring**: The timer circle is divided into three arc segments (0–15m, 15–30m, 30–60m), each filling independently. Exceeding 60m triggers a "LIMIT_EXCEEDED" state.
- **Pause Limit Enforcement (Neural Sync Rule)**: If the timer is paused mid-session, a countdown shows `PAUSE_LIMIT_ENFORCED / REBOOT_IN [time]`. The pause limit is 60 seconds. If not resumed in time, the session is auto-saved and reset. Visual urgency: yellow at <30s remaining, red at <10s.
- **Neural Heat (Activity Map)**: The 21-day heatmap in SidebarRight uses color interpolation — black → dark brown → vibrant orange → bright coral — as daily focus minutes increase. Cells glow at higher values.
- **Sound Engine**: Web Audio API synthesizer with distinct sounds for start, pause, reset/reboot, click, hover, key, denied, and objective completion (boom + chime cascade, with `/sounds/objective-complete.mp3` fallback).
- **Interruption Cracks**: Each time the timer is paused mid-session, thin vertical crack marks appear inside the session block in the Day View timeline. Shows at a glance how fragmented a session was. ✅ Implemented.

**Analytics**
- **Day View Timeline**: Sessions shown as blocks on an 8am–2am timeline. Hover highlights sessions cross-referenced in the session list.
- **Operator Diagnostics**: `NEURAL_COHERENCE` (consistency score based on avg session length vs 30m target), `AVG_RECOVERY` (mean idle time between forges), `PEAK_INTENSITY`, `FORGE_VOLUME` (day / week / all-time).
- **Global Stats**: All-time total, all-time peak, week total, month total.
- **Activity Map drill-down**: Clicking any heatmap cell navigates to that day's analytics view.
- **Session deletion**: Individual sessions can be removed from the Analytics detail list.
- **Keyboard navigation**: Arrow keys to change day, Escape to return to HUD, Space to jump to today.

**Other**
- **Keyboard Shortcuts**: Space = toggle timer, Escape = reset/save, `A` = open analytics.
- **System Log**: Real-time event feed in SidebarRight (timer events, objective events, session saves).
- **User Profile**: Name, avatar, experience level shown in SidebarLeft operator card.

---

## 1. The Strategic Forge (Task Management)
*Goal: Give focus sessions context and actionable goals.*

- **Target Neutralization (Single-Task Focus)**: ✅ Implemented — see above.

## 2. Visceral Momentum (Real-time Feedback)
*Goal: Make the act of focusing feel like an evolving achievement.*

- **Neural Heat**: ✅ Partially implemented.
  - **Visuals**: Activity map heatmap color-codes days by focus intensity. ✅
  - **Purpose**: Provides visual proof of "momentum" without being distracting.
- **Intervention Tracking**:
  - **Neural Sync Rule**: Auto-reset if pause exceeds limit. ✅ Implemented (60s limit).

## 3. Project Forge Rewards (Variable Micro-Rewards)
*Goal: Provide unpredictable, positive reinforcement for sustained focus.*

- **The Loot System**: Every completed forge session has a chance to "extract" a reward (e.g., a new schematic, a UI color accent, or a tactical soundbite). *(Not yet implemented)*
- **Duration Scaling**: Probability and "rarity" of rewards increase with uninterrupted session length.
  - *Short Burst (15m):* Low chance of common drop.
  - *Deep Forge (45m+):* Guaranteed high-quality drop.
- **Collection Log**: A new HUD tab where the operator can view their "Extracted Schematics."
- **Focus**: Purely positive reinforcement. No penalties for stopping, only escalating rewards for continuing.

## 4. Kill Rate (Day View Enhancement)
*Goal: Surface objective throughput alongside existing daily diagnostics.*

- **Kill Rate Metric**: Add `KILL_RATE` to the existing Operator Diagnostics table (alongside Neural Coherence, Peak Intensity, etc.). Shows objectives neutralized for day / week / all-time, computed from `objectives.completed_at` timestamps.
- **Purpose**: Gives the operator a quick count of "how many targets did I take down" right next to the focus time stats they already see.

## 5. Operator Intelligence Hub (Separate Stats Page)
*Goal: A dedicated analytics page for long-term pattern recognition across all sessions. Separate from the Day View — this is the macro picture.*

- **Focus Time by Hour-of-Day**:
  - **Visuals**: Horizontal or vertical histogram bucketing total accumulated focus minutes by hour (0–23). Derived from `focus_sessions.start_time` + `duration_seconds`, splitting sessions that span hour boundaries.
  - **Purpose**: Identifies the operator's "Prime Time" — which hours of the day consistently produce the most focus. Helps plan deep work around natural brain rhythms.
- **Focus by Day-of-Week**:
  - **Visuals**: 7-bar chart (Mon–Sun) showing average or total focus time per weekday across all tracked history.
  - **Purpose**: Reveals weekly patterns at a glance — "Fridays are dead," "Sundays are surprisingly strong." Helps the operator set realistic expectations per day.
- **Session Length Distribution**:
  - **Visuals**: Histogram bucketed by duration: <5m, 5–15m, 15–30m, 30–45m, 45–60m, 60m+. Each bucket shows the count of sessions that fall within that range.
  - **Purpose**: Shows whether the operator tends toward short bursts or deep forges. Watching the distribution shift toward longer sessions over weeks is a strong motivator.
- **Fragmentation Index**:
  - **Visuals**: Derived from `session_pauses` — average number of pauses per session, trended over time (e.g., weekly rolling average). Also show a "Clean Forge Ratio": percentage of sessions completed with zero pauses.
  - **Purpose**: Rewards uninterrupted focus. Watching the clean forge ratio climb is satisfying positive reinforcement.

## 6. Objective Categories (Tagging System)
*Goal: Classify objectives by difficulty or type, giving visual distinction and enabling category-based analytics.*

- **Data Model**:
  - New `objective_categories` table: `id` (INTEGER PK), `label` (TEXT), `color` (TEXT, hex code), `sort_order` (INTEGER).
  - Add `category_id` (INTEGER, nullable FK → `objective_categories.id`) to the `objectives` table. NULL = uncategorized / default.
  - Ship with built-in defaults: **Hard** (`#ff4444`, red), **Normal** (`#ffffff`, white), **Easy** (`#888888`, gray). User-configurable later.
- **Sidebar Visuals (Objective Pool)**:
  - Each objective's bullet/pip is colored to match its category. Hard objectives get a red bullet, Normal white, Easy gray.
  - Category assignment via a small inline color-dot picker when adding or editing an objective — fast, no dropdowns, no friction.
- **Analytics Integration** *(Future — see Section 8)*

## 7. Advanced Analytical Screens (The Neuro-Visualizer)
*Goal: Transform boring metrics into visceral, game-like visualizations that provide immediate feedback and long-term pattern recognition for the ADHD brain.*

- **The Context-Switching Ghost (Fragmented Flow)**:
  - **Visuals**: Semi-transparent "electrical arcs" connect objective completion dots to the sessions they happened in. Tangled arcs = high task switching; thick, glowing arcs = deep flow.
  - **Purpose**: Visualizes the hidden cost of "skipping" between tasks without using judgmental language.
- **The "Dopamine Hot Zone" Overlay**:
  - **Visuals**: A secondary heat-layer on the 18-hour timeline highlighting hours with the highest objective completion density. These zones pulse with high-contrast colors (e.g., Electric Blue).
  - **Purpose**: Identifies the operator's "Prime Time" to help them plan deep work when their brain is naturally most "online."
- **The Combo Meter (Momentum Tracking)**:
  - **Visuals**: A high-octane "Streak Counter" tracking consecutive forge days or objectives neutralized without a reboot. Reaching milestones unlocks temporary UI color shifts or new audio sets.
  - **Purpose**: Provides immediate micro-rewards for consistency, gamifying the act of showing up daily.

## 8. Category-Based Analytics Integration
*Goal: Extend objective categories into the analytics layer for deeper pattern recognition.*

- **Timeline Coloring**: Objective completion dots on the Day View timeline are colored by category. Uncategorized objectives get a 1px orange outline stroke for visibility.
- **Kill Rate Breakdown**: Kill Rate metric split by category: "3 hard / 5 normal / 2 easy neutralized."
- **Pattern Tracking**: Over time, track category completion ratios to surface patterns like "you avoid hard tasks on Fridays."

