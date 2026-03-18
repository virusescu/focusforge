# FocusForge

A gamified productivity timer built in Unity. Uses a **Time Slope** mechanic to reward sustained focus with exponential resource generation, interrupt tracking to diagnose productivity leaks, and a visual factory metaphor that evolves as you work.

## Status: Pre-MVP

The Unity project has not been created yet. The workspace is scaffolded and ready for Unity Hub project creation.

## Concept

- **Time Slope:** Focus multiplier grows the longer you stay in flow (1x → 1.5x → 3x)
- **Resource Ticks:** Earn Scrap (base currency) every tick. At 60+ minutes, 5% chance of Rare Cores
- **Streak Rewards:** Complete 4 sessions of 60+ minutes to earn a Super Core
- **Pause Stakes:** Pausing too long (>3 min) or too often (>4x/hour) auto-ends the session
- **Interrupt Tracking:** Log what broke your flow (meetings, phone, brain fog, etc.)
- **Analytics:** Daily summaries of focus time and resources earned

See [docs/initialideea.md](docs/initialideea.md) for the full product spec and [docs/projectplan.md](docs/projectplan.md) for the MVP milestone plan.

## Tech Stack

| Component | Choice |
|-----------|--------|
| Engine | Unity 6 |
| Language | C# |
| UI | UI Toolkit |
| Database | SQLite (local) |
| Settings | Local JSON file |
| Platform | Windows (standalone, windowed, 60 FPS) |

## Prerequisites

- [Unity Hub](https://unity.com/download) with Unity 6 installed
- Visual Studio Code with [C# Dev Kit](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csdevkit)

## Getting Started

1. Open Unity Hub → New Project → select a template (e.g., 3D Core) → set location to this folder
2. Unity will populate the `Assets/` folder and generate project settings
3. In Unity: `Edit > Preferences > External Tools` → set External Script Editor to VS Code
4. Click "Regenerate project files" for C# IntelliSense

## Project Structure

```
Assets/
├── Animations/    # Animation clips and controllers
├── Audio/         # Sound effects and music
├── Editor/        # Editor-only scripts
├── Materials/     # Materials and shaders
├── Plugins/       # Third-party plugins (SQLite, charting)
├── Prefabs/       # Reusable prefab assets
├── Resources/     # Runtime-loaded resources
├── Scenes/        # Unity scene files
├── Scripts/       # C# game scripts
├── Textures/      # Image and texture assets
└── UI/            # UI-related assets
docs/
├── initialideea.md   # Full product specification
└── projectplan.md    # MVP milestone plan
```

## Coding Conventions

- **Naming:** PascalCase for public members, `_camelCase` for private fields
- **Inspector fields:** Use `[SerializeField]` for private fields exposed to the Inspector
- **Organization:** Group scripts by feature/system in subfolders under `Assets/Scripts/`
