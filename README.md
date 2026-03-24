# FocusForge

FocusForge is a high-performance productivity HUD (Heads-Up Display) built with **Tauri**, **React**, and **TypeScript**. It features a specialized "Neural Forge" timer designed to help operators maintain deep focus during intense engineering tasks.

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
- Run the unit tests:
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
- **Database**: SQLite
- **Styling**: SCSS (CSS Modules)
- **Testing**: Vitest, React Testing Library

## 🏗 Architecture
FocusForge follows a modular architecture:
- **`src/contexts`**: Centralized state hub for user settings and global data.
- **`src/hooks`**: Specialized custom hooks for timer and system log management.
- **`src/components`**: Modular UI components styled with SCSS Modules.
- **`src/db.ts`**: Database interaction layer using the Tauri SQL plugin.
