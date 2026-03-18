<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# FocusForge - Unity C# Project

## Project Overview
- **Type**: Gamified productivity timer (Unity Desktop Application)
- **Language**: C#
- **Engine**: Unity 6
- **UI**: UI Toolkit
- **Database**: SQLite (local-first, single-user)
- **Settings**: Local JSON file (`settings.json`)
- **Platform**: Windows (standalone, windowed, 60 FPS)

## Key Concepts
- **Time Slope**: Focus multiplier that grows with sustained session time (1x/1.5x/3x tiers)
- **Resource Tick**: Periodic award of Scrap (base currency). At 60+ min tier, 5% chance of Rare Core
- **Streak**: 4 sessions of 60+ min = 1 Super Core
- **Pause Rules**: >3 min single pause OR >4 pauses/hour = auto-terminate session
- **Interrupt Tracking**: Categorized logging of what broke focus

## Architecture
- `SQLiteService` — DB connection and schema migration
- `SettingsManager` — Load/save settings.json
- `SessionManager` — Timer, pause, start/stop lifecycle
- `MultiplierCalculator` — Time-based tier calculation
- `ResourceTickService` — Currency generation per tick
- `StreakTracker` — Super Core streak counter
- Repository pattern for data access (TaskRepository, SessionRepository, InterruptRepository, InventoryRepository)

## Coding Conventions
- Use C# naming conventions (PascalCase for public members, camelCase for private fields with underscore prefix)
- Follow Unity best practices for MonoBehaviour lifecycle methods
- Use SerializeField attribute for inspector-exposed private fields
- Organize scripts by feature/system in appropriate folders

## Project Structure
- `Assets/Scripts/` - C# game scripts
- `Assets/Scenes/` - Unity scene files
- `Assets/Prefabs/` - Prefab assets
- `Assets/Materials/` - Material assets
- `Assets/Textures/` - Texture assets
- `Assets/Audio/` - Audio assets
- `Assets/UI/` - UI-related assets
- `Assets/Animations/` - Animation assets
- `Assets/Resources/` - Runtime-loaded resources
- `Assets/Editor/` - Editor-only scripts
- `Assets/Plugins/` - Third-party plugins (SQLite, charting)
- `docs/` - Product spec and project plan
