# FocusForge

A Unity application built with C#.

## Prerequisites

- [Unity Hub](https://unity.com/download) installed
- Unity Editor (recommended: latest LTS version)
- Visual Studio Code with [C# Dev Kit](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csdevkit) extension

## Getting Started

1. **Create the Unity project**: Open Unity Hub, click "New project", select a template (e.g., 3D Core), and set the project location to this folder (`F:\personal\focusforge`). Unity will populate the existing `Assets/` folder and generate the remaining project files.

2. **Open in VS Code**: In Unity Editor, go to `Edit > Preferences > External Tools` and set the External Script Editor to Visual Studio Code. Double-click any script to open the project in VS Code.

3. **Regenerate project files**: In Unity, go to `Edit > Preferences > External Tools` and click "Regenerate project files" to create the `.sln` and `.csproj` files needed for C# IntelliSense.

## Project Structure

```
Assets/
├── Animations/    # Animation clips and controllers
├── Audio/         # Sound effects and music
├── Editor/        # Editor-only scripts
├── Materials/     # Materials and shaders
├── Plugins/       # Third-party plugins
├── Prefabs/       # Reusable prefab assets
├── Resources/     # Runtime-loaded resources
├── Scenes/        # Unity scene files
├── Scripts/       # C# game scripts
├── Textures/      # Image and texture assets
└── UI/            # UI-related assets
```

## Coding Conventions

- **Naming**: PascalCase for public members, `_camelCase` for private fields
- **Inspector fields**: Use `[SerializeField]` for private fields exposed to the Inspector
- **Organization**: Group scripts by feature/system in subfolders under `Assets/Scripts/`
