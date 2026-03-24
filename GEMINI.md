# GEMINI.md - FocusForge Project

## Project Overview
**FocusForge** is a high-performance productivity HUD (Heads-Up Display) built with **Tauri**, **React**, and **TypeScript**. It features a specialized "Neural Forge" timer designed to help operators maintain deep focus during intense engineering tasks.

## Tech Stack
- **Frontend**: React 19 (TypeScript), Vite 8.
- **Backend**: Tauri 2.
- **State Management**: React Context (`UserContext`) for shared state and Custom Hooks (`useTimer`, `useSystemLog`) for specialized logic.
- **Database**: SQLite via Tauri SQL Plugin.
- **Styling**: SCSS (CSS Modules).
- **Testing**: Vitest + React Testing Library.

## Architecture & Principles
- **Centralized User State**: Operator settings (name, email, multiplier) are managed via `UserProvider`.
- **Logic Extraction**: Heavy logic (timer, system logs) is extracted into custom hooks to keep components focused on UI.
- **Tauri-Ready**: Components are designed to work within the Tauri window environment, utilizing drag regions and system-level window controls.
- **TDD First**: Core logic and components are covered by unit and integration tests.

## Key Files
- `src/contexts/UserContext.tsx`: The primary state hub for the application.
- `src/hooks/useTimer.ts`: Manages the focus timer and global timer events.
- `src/hooks/useSystemLog.ts`: Generates and manages the scrolling system log.
- `src/db.ts`: Handles SQLite database initialization and operations.
- `src/types/index.ts`: Centralized TypeScript definitions.

## Key Scripts
- `npm dev`: Start the Vite dev server.
- `npm tauri dev`: Start the Tauri desktop application in development mode.
- `npm test`: Run the full suite of unit tests.
- `npm run build`: Compile the application for production.
