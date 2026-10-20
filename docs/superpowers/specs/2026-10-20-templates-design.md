# Task Templates — Design

**Date:** 2026-10-20
**Status:** Awaiting approval (revised after the user's answers)

## Intent and why

Some tasks are the same shape every time: a bug ticket needs the same title style, the same
links, the same checklist, with only an issue id (or a few words) changing. Today the user retypes or
duplicates and hand-edits. A **template** is a saved task whose title and details contain
`$placeholders`. Creating a task from it asks for the placeholder values once and produces a finished task
(title, markdown details, category) in the bucket the user picks.

Example. Template **Bug**:

- Title: `$title`
- Details:
  ```
  Bugfixing for issue id: $issueId.
  Link: [Jaas Link](http://ea.jaas.com/browse/$issueId)
  ```
- Fields derived: `title`, `issueId` (asked once each, even though `issueId` appears twice).

## Goals

1. Right-click a task → **Create template from task** saves a template from that task. The task
   itself stays untouched; the user deletes it later if they want.
2. Fields come from the text: every `$name` in the template's title or details is a field.
3. Every template has a **name**, a **color**, and a **position** in an ordered list.
4. Every saved template gets its own button, in the template's color, under the "Add Objective..." box
   in the left sidebar **and** under the add box of every panel on the Canvas (each bucket panel and the
   Mission panel). Clicking it opens a popup with one input per field, a **bucket picker** and a
   **category picker**; confirming creates the task.
5. The normal "Add Objective..." box also gets a bucket picker (today new tasks always land in Unsorted).
   Both the add box and the template popup remember the last bucket and category picked (stored locally
   on this machine only, not in the database).
6. Templates and categories can both be managed from the **Settings** popup, in addition to where
   categories can already be opened today (category dot picker, canvas).
7. Templates persist in the user's Turso database like everything else.

## Non-goals (v1)

- Field types, default values, required/optional flags, dropdowns, or conditional sections.
- Dragging the template *buttons* themselves to reorder (order is changed in the template manager).
- Import/export or sharing of templates.
- Creating a task from a template silently (no popup), or from the keyboard.
- Updating tasks already created from a template when the template changes.
- Syncing the remembered bucket/category between machines.

## Anti-goals

- Converting a task must never delete or alter the task.
- Ordinary text must not turn into fields by accident: prices (`$5`), a lone `$`, and currency in
  markdown stay literal; a way to write a literal `$name` exists (`$$name`, see below).
- A template must never produce a task with a leftover `$name` the user was never asked about.

## Placeholder rules

- A field is `$` followed by a letter or `_`, then letters, digits or `_`: `/\$[A-Za-z_][A-Za-z0-9_]*/`.
  `$5` and a lone `$` are not fields and are left exactly as typed.
- Names are case-sensitive (`$Id` and `$id` are two fields).
- `$$` is the only way to get a `$` that is followed by a name: it is not a field and becomes a single
  literal `$` when a task is created. So `$$bla` prints as `$bla`, while `$bla` is a field.
  The same rule applies when extracting fields, so `$$HOME` is never a field.
- Field order is first appearance, scanning the title first and then the details.
- A field used several times is asked once and replaced everywhere (title and details).
- Substitution is a single pass over the template text; a value that itself contains `$name`
  or `$$` is inserted verbatim and not re-expanded.
- Values may be empty, except that the resulting **title** must not be empty (the create button is
  disabled while it would be).
- Fields inside fenced code blocks and inline code are fields like anywhere else; the user escapes
  literal dollars with `$$`.

## Behaviour

### Creating a template

- Right-click a task (left sidebar row or canvas card) → menu item **Create template from task**
  (next to Duplicate and Copy text).
- A small popup asks for the template **name** (prefilled with the task's title, user-editable) and a
  **color**, and shows a live preview of the fields detected in the task's title and details. Save is
  disabled with an empty name. A template with zero fields is allowed.
- The color defaults to the task's category color, or the app's accent color when the task has no category.
- The template copies the task's title (`text`), its details markdown, and its category. It does not
  copy bucket, Mission flag, or completion state.
- The new template goes to the end of the template order.
- Template names do not have to be unique; the manager lets the user rename any template at any time.

### Creating a task from a template

- A wrapping row of buttons, one per template in template order, each drawn in the template's color
  and labelled with its name. The row appears under the add box in the left sidebar and under the add
  box of every Canvas panel, and is absent when there are no templates. After about three rows it scrolls.
- Clicking opens the popup: template name as the heading; one text input per field, in field order,
  labelled with the field name as written (`issueId`); a **bucket picker**; a **category picker**; an
  **Add to Mission** checkbox; **Create** and **Cancel**. The first input is focused; Enter creates (if
  allowed), Escape cancels. Escape closes only the popup.
- Bucket picker: lists all buckets that can hold tasks (custom buckets and Unsorted, not the Mission
  pseudo-bucket).
  - Opened from a Canvas bucket panel: preselected to that panel's bucket.
  - Opened from the Canvas Mission panel or the left sidebar: preselected to the last bucket used for
    creating a task (add box or popup), falling back to Unsorted.
  - The user can always change it.
- Category picker: includes "no category". Preselected to the template's own category if it has one,
  otherwise to the last category used for creating a task, otherwise none.
- Add to Mission is checked by default, everywhere (decided by the user after review), and can be unchecked.
- The new task gets: title and details with values substituted, the chosen category, the chosen
  bucket, and the Mission flag per the checkbox.
- A template with no fields still opens the popup (for bucket and category) — it is never created silently.
- The popup stays open until the save succeeds; the button is grayed and reads SAVING... meanwhile. On
  failure it stays open with everything typed intact and an error, so the user can retry. The remembered
  bucket/category are stored only after a successful create.
- If a remembered bucket or category was deleted since, the picker falls back as if nothing were
  remembered.

### Bucket and category on the main add box

- A compact bucket selector beside the existing category dot. Both selections are remembered
  (locally) after each add, instead of resetting. Shift+Enter ("add to top") keeps its current meaning
  (top of the Mission list); inside the chosen bucket the task is appended, as today.

### Managing templates and categories from Settings

- The Settings popup gets a section with two buttons: **TEMPLATES** and **CATEGORIES**.
- CATEGORIES opens the existing category manager (same behaviour, including drag sorting).
- TEMPLATES opens a template manager listing every template, **drag-sortable** (this order is the
  order of the buttons everywhere), each with: name, color picker, title, details (raw markdown,
  multi-line), category, a live list of detected fields, and delete (with a confirmation step). All of
  these are editable. Changes save on blur or via an explicit Save (builder's call). Names may repeat.
- Settings currently binds Enter (apply and close) and Escape (cancel) on `window`. While a manager
  opened from Settings is on screen, those Settings shortcuts must not fire, and Escape closes only the
  manager.
- The template manager never creates, edits or deletes tasks.

## Data

New table `templates` (created with `CREATE TABLE IF NOT EXISTS` in `initDb`, like `canvas_notes`):

| Column | Notes |
|---|---|
| `id` | integer primary key |
| `user_id` | owner |
| `name` | free text, not unique |
| `title` | text with placeholders |
| `details` | markdown with placeholders; empty string when none |
| `color` | hex color of the template's button |
| `category_id` | nullable, references `objective_categories`; set to NULL by `deleteCategory` |
| `sort_order` | position in the template order (rewritten 0..n after a drag) |
| `created_at` | timestamp |

Fields are never stored; they are always derived from `title` + `details`.

The remembered bucket and category are two `localStorage` keys, not database columns.

## Facts about the existing code the builder can rely on

- A task's details live in the `objectives.details` column as **raw markdown** and are rendered by
  `MarkdownView` in the details pane. A template's `details` has the same shape. Placeholders are
  resolved (and `$$` becomes `$`) once, when the task is created; the stored task text is final and
  contains no placeholder syntax.
- The right-click menu (`ContextMenu`, with Duplicate and Copy text on sidebar rows and canvas cards)
  already exists in the working tree but is **not yet committed**; it must be committed before this
  work starts, and "Create template from task" is a third item in that same menu.
- `deleteCategory` already clears `objectives.category_id` with an explicit `UPDATE` rather than
  relying on a foreign key; do the same for `templates.category_id`.
- Categories are already drag-sortable (`CategoryManagerModal`, `reorderCategories`); the template
  manager's sorting can follow the same pattern.

## Constraints

- Follow existing patterns: DB functions in `src/db.ts`, optimistic state in a context or hook,
  pure logic in `src/utils`, tests next to code, docs updated in the same change (`docs/database.md`,
  `docs/architecture.md`, README).
- The sidebar, the Canvas panels and the Settings manager must all see template changes immediately
  (shared state, not independent loads).
- Pure functions for extracting fields and filling a template, fully unit-tested, including the
  escaping and single-pass rules above.
- `addObjective` currently cannot set `details`; creating from a template needs title, details,
  category, bucket and the Mission flag in one create (builder decides how).
- Deleting a category must not break templates (`category_id` becomes NULL).

## Left to the builder

- File and component names; whether template state lives in `FocusContext` or a new context/hook.
- Exact look of the popup, the button row and the bucket selector, following the existing HUD style.
- Whether the template manager saves on blur or via a Save button.
- Wording of validation messages.

## Calls I made (please check)

1. Syntax is `$name` with `$$` as the escape (the user wrote `$title`, `$issueId`).
2. Field names are shown as written; no prettifying.
3. The template stores its category (copied from the source task) but not a bucket; bucket and
   category are both choosable in the creation popup.
4. If a template has its own category, the popup preselects it; the remembered "last category" is only
   used when the template has none. (This is the one place "remember my last pick" and "template
   default" could disagree.)
5. A lone `$` or `$` followed by a digit stays literal.
6. The Add to Mission checkbox is checked by default, on every surface.
7. Template order is changed only in the manager, not by dragging the buttons.
8. Opened from a Canvas bucket panel, the popup preselects that panel's bucket instead of the remembered one.
9. The template color defaults to the source task's category color.
10. Many templates: the button row wraps and scrolls after about three rows.
