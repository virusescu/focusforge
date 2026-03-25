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
  - **Interruption Cracks**: Each time the timer is paused mid-session, record a timestamp. In the Day View timeline, render these as thin vertical crack marks inside the session block. Shows at a glance how fragmented a session was. No reason needed — the pattern across the day tells the story.

## 3. Project Forge Rewards (Variable Micro-Rewards)
*Goal: Provide unpredictable, positive reinforcement for sustained focus.*

- **The Loot System**: Every completed forge session has a chance to "extract" a reward (e.g., a new schematic, a UI color accent, or a tactical soundbite). *(Not yet implemented)*
- **Duration Scaling**: Probability and "rarity" of rewards increase with uninterrupted session length.
  - *Short Burst (15m):* Low chance of common drop.
  - *Deep Forge (45m+):* Guaranteed high-quality drop.
- **Collection Log**: A new HUD tab where the operator can view their "Extracted Schematics."
- **Focus**: Purely positive reinforcement. No penalties for stopping, only escalating rewards for continuing.

## 4. High-Fidelity Data Visualization
*Goal: Use new diagnostic data to create a more detailed performance report.*

- **Neural Stability Graph**: Use interrupt frequency and recovery efficiency to generate a "Stability Score" over time. ✅ Partially implemented — coherence score and avg recovery shown per-day, but no trend graph across days.
- **Session Replay**: A way to hover over a specific day and see a summary of the most successful project tags and the primary sources of interruptions. *(Partial — clicking a heatmap cell navigates to that day's analytics. Hover preview not implemented. Project tag breakdown requires tagging feature.)*
