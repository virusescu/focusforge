# GEMINI.md - FocusForge Project

## Project Overview
**FocusForge** is a high-performance productivity HUD (Heads-Up Display) built with **Tauri**, **React**, and **TypeScript**. It features a specialized "Neural Forge" timer and a data-driven analytics suite designed to help operators track and optimize deep focus sessions.

## Tech Stack
- **Frontend**: React 19 (TypeScript), Vite 8.
- **Backend**: Tauri 2 (Rust).
- **State Management**: React Context (`UserContext`, `FocusContext`) and Custom Hooks (`useTimer`, `useSystemLog`).
- **Database**: SQLite via Tauri SQL Plugin for session persistence.
- **Audio**: Custom synthesized UI sounds using Web Audio API (`src/utils/audio.ts`).
- **Styling**: SCSS (CSS Modules) with modern HUD aesthetics and global custom scrollbars.
- **Testing**: Vitest + React Testing Library (30+ tests with comprehensive API mocking).

## Key Features
- **Neural Forge**: A specialized focus timer with synthetic audio feedback and interactive progress visualization.
- **Activity Map**: A 21-day heatmap tracking focus depth with interactive hover tooltips and day-selection.
- **System Analytics**: A dedicated page featuring:
  - **Day View Visualizer**: A 18-hour timeline (8 AM to 2 AM) showing session coverage.
  - **Diagnostic Report**: Advanced metrics including Neural Coherence, Recovery Efficiency, and Peak Intensity.
  - **Intensity Log**: A complete history of sessions with delete capabilities and cross-highlighting with the visualizer.
  - **Keyboard Mastery**: Full keyboard support (Arrows for navigation, Space for today/toggle, Escape for back/reboot).
- **Tactile Feedback**: A custom audio engine providing mechanical "clicks," "pings," and status tones for all interactions.

## Architecture & Principles
- **Centralized Data**: All user settings and focus history are managed via Context providers, ensuring consistent state across HUD and Analytics views.
- **Tauri Integration**: Deep integration with Tauri for window management, drag regions, and local SQLite database access.
- **TDD First**: Every core utility, context, and component is verified via a robust test suite that mocks system-level APIs.

## Key Files
- `src/contexts/FocusContext.tsx`: Manages session tracking, database saving, and global analytics.
- `src/components/AnalyticsView.tsx`: The primary analytics suite and visualization engine.
- `src/utils/audio.ts`: The synthetic sound engine for HUD feedback.
- `src/db.ts`: The SQLite interaction layer with support for complex aggregation and time-window queries.

## Key Scripts
- `npm dev`: Start the Vite dev server.
- `npm tauri dev`: Start the Tauri desktop application.
- `npm test`: Run the full suite of unit and integration tests.
- `npm run build`: Perform a clean production build check.
