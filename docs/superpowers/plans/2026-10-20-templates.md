# Task Templates Implementation Plan

> **For agentic workers:** Execute task by task (superpowers:executing-plans); each task is test-first and ends with a green run of its tests.

**Goal:** Save tasks as templates with `$field` placeholders; create tasks from them through a popup (fields, bucket, category, Mission); manage templates and categories from Settings.

**Architecture:** Pure `utils/templates.ts` (extract fields, fill text, `$$` escape). A `templates` table + DB functions. Template state in `FocusContext` (shared by sidebar, canvas panels and Settings). Small modal components, a `TemplateButtons` row reused in the sidebar and canvas panels, remembered bucket/category in `localStorage`.

**Spec:** `docs/superpowers/specs/2026-10-20-templates-design.md`

## Global constraints

- Field regex `/\$[A-Za-z_][A-Za-z0-9_]*/`; `$$` is the only escape and prints one `$`; `$5` and a lone `$` stay literal; one-pass substitution; names case-sensitive; first-appearance order (title, then details).
- Template names are NOT unique. Templates have `color` and `sort_order`. Deleting a category sets `templates.category_id` to NULL explicitly.
- Remembered bucket/category live in `localStorage`, never in the DB.
- Modals: Escape closes only the modal; keys typed in a modal never reach the HUD shortcuts or Settings.

## Review focus

- `$$bla` prints `$bla`; `$$$x` prints `$` + value of x; a value containing `$other` is not re-expanded.
- Empty-title result disables Create; a template with zero fields still opens the popup.
- A remembered bucket/category that was deleted falls back cleanly.
- Opening Settings managers must not trigger Settings' own Enter/Escape.

## Tasks

1. **Template text utilities** — `src/utils/templates.ts`: `extractFields(title, details): string[]`, `fillTemplate(text, values): string`; tests for every rule above.
2. **Data layer** — `Template` type; `templates` table in `initDb`; `getTemplates/addTemplate/updateTemplate/deleteTemplate/reorderTemplates`; `deleteCategory` nulls `templates.category_id`; `addObjective` accepts `details`. Tests in `db.test.ts`.
3. **State** — `FocusContext`: `templates`, `addTemplate`, `updateTemplate`, `deleteTemplate`, `reorderTemplates` (optimistic), `addObjective` option `details`. Tests in `FocusContext.test.tsx`.
4. **Remembered picks** — `src/utils/lastPicks.ts`: `loadLastPicks()`, `saveLastPicks()`; tests.
5. **Create-template popup + menu item** — `SaveTemplateModal` (name, color, field preview); "Create template from task" in the right-click menu of sidebar rows and canvas cards.
6. **Create-from-template popup + buttons** — `CreateFromTemplateModal` and `TemplateButtons`; placed under the sidebar add box and in every canvas panel.
7. **Add-box pickers** — bucket selector on the sidebar add box; remember bucket and category.
8. **Settings managers** — `TemplateManagerModal` (drag-sortable, editable); TEMPLATES and CATEGORIES buttons in `SettingsModal`, which suspends its own keys while one is open.
9. **Docs and verification** — `architecture.md`, `database.md`, README; full test run, build, lint on touched files.
