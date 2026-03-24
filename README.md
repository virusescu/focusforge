# FocusForge

FocusForge is a high-performance productivity HUD (Heads-Up Display) built with **Tauri**, **React**, and **TypeScript**. It features a specialized "Neural Forge" timer designed to help operators maintain deep focus during intense engineering tasks, powered by a local SQLite engine and high-fidelity data analytics.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (latest LTS)
- [Rust](https://www.rust-lang.org/) (for Tauri)

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

## 🛠 Tech Stack
- **Frontend**: React 19, TypeScript, Vite 8
- **Backend**: Tauri 2 (Rust)
- **Database**: SQLite (Local persistence)
- **Audio**: Custom Web Audio Synthesis
- **Styling**: SCSS (CSS Modules)
- **Testing**: Vitest, React Testing Library

## 🏗 Key Features
- **Neural Forge**: Precision focus timer with synthetic audio status feedback.
- **Activity Map**: 21-day focus heatmap with interactive tooltips and contextual navigation.
- **System Analytics**: Full-page data visualization featuring:
  - **Day-View Visualizer**: Timeline-based session tracking from 8 AM to 2 AM.
  - **Operator Diagnostics**: Detailed consistency, intensity, and volume metrics.
  - **Forge Log**: Session history management with cross-highlighting.
- **Keyboard Mastery**: Full application control via keyboard shortcuts (Space, Escape, Arrow Keys, 'A').
- **Tactile Audio**: Synthesized mechanical feedback for every UI interaction.

## 📁 Architecture
- **`src/contexts`**: State hubs for operator settings and focus analytics.
- **`src/hooks`**: Reusable logic for timers and system logs.
- **`src/utils/audio.ts`**: Synthetic sound engine for zero-asset tactile feedback.
- **`src/db.ts`**: High-performance SQLite interaction layer.
