# FocusForge: Strategic Blueprints

This document tracks approved ideas and architectural directions for future development cycles.

## 1. The Strategic Forge (Task Management)
*Goal: Give focus sessions context and actionable goals.*

- **Project Tagging**: Allow operators to assign a name/tag to a session before initiating the forge (e.g., `CORE_REFACTOR`, `UI_POLISH`).
- **Project Analytics**: In the Analytics View, provide a breakdown (e.g., total hours per tag) to show where the most "neural energy" was spent during the week.
- **Minimalist Task List**: A dedicated sidebar component for "Active Objectives." 
  - Input-driven: `Enter` to add, `Space` to toggle status.
  - Keeps the operator focused on specific sub-tasks during a deep-dive session.

## 2. Advanced Session Diagnostics
*Goal: Capture more granular data about the flow of work and distractions.*

- **Interrupt Tracking**:
  - Add a feature to mark a session as "Interrupted" instead of just "Halted."
  - **Interruption Logs**: Prompt for a brief reason code (e.g., `COMM_INBOUND`, `SENSORY_DISTRACTION`, `URGENT_MAINTENANCE`).
  - **Visual Impact**: Show these interruptions as "cracks" or specific markers in the Analytics Day View timeline.
- **Explicit Break Tracking**:
  - Formally track "Recovery Phases" (the time between focus sessions).
  - Categorize breaks (e.g., `Scheduled Rest` vs `Forced Recovery`).
  - Visualize these as "cool-down" periods on the timeline to help the operator find their optimal focus/rest ratio.

## 3. High-Fidelity Data Visualization
*Goal: Use new diagnostic data to create a more detailed performance report.*

- **Neural Stability Graph**: Use interrupt frequency and recovery efficiency to generate a "Stability Score" over time.
- **Contextual Heatmaps**: Enhance the Activity Map to show not just duration, but "Success Rate" (sessions completed without interruptions).
- **Session Replay**: A way to hover over a specific day and see a summary of the most successful project tags and the primary sources of interruptions.
