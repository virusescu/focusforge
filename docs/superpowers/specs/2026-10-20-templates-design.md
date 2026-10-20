# Task Templates — Design

**Date:** 2026-10-20
**Status:** Awaiting approval

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
3. Every saved template gets its own button under the "Add Objective..." box in the left sidebar.
   Clicking it opens a popup with one input per field and a **bucket picker**; confirming creates the task.
4. The normal "Add Objective..." box also gets a bucket picker (today new tasks always land in Unsorted).
5. Templates and categories can both be managed from the **Settings** popup, in addition to where
   categories can already be opened today (category dot picker, canvas).
6. Templates persist in the user's Turso database like everything else.

## Non-goals (v1)

- Field types, default values, required/optional flags, dropdowns, or conditional sections.
- Reordering template buttons by drag (they appear in creation order).
- Template buttons anywhere except the left sidebar (not in canvas bucket panels).
- Import/export or sharing of templates.
- Creating a task from a template silently (no popup), or from the keyboard.
- Updating tasks already created from a template when the template changes.

## Anti-goals

- Converting a task must never delete or alter the task.
- Ordinary text must not turn into fields by accident: prices (`$5`), shell variables in notes, and
  currency in markdown must have a way to stay literal (see escaping below).
- A template must never produce a task with a leftover `$name` the user was never asked about.

## Placeholder rules

- A field is `$` followed by a letter or `_`, then letters, digits or `_`: `/\$[A-Za-z_][A-Za-z0-9_]*/`.
  `$5` and a lone `$` are not fields.
- Names are case-sensitive (`$Id` and `$id` are two fields).
- `$$` is an escape: it is not a field and becomes a single literal `$` when a task is created.
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
- A small popup asks for the template **name** (prefilled with the task's title, user-editable) and
  shows a live preview of the fields detected in the task's title and details. Save is disabled
  with an empty name. A template with zero fields is allowed (it then behaves like a one-click preset).
- The template copies the task's title (`text`), its details markdown, and its category. It does not
  copy bucket, Mission flag, or completion state.
- Names should be unique per user, case-insensitively; saving a duplicate name is refused with a
  message in the popup.

### Creating a task from a template

- Under the add box, a wrapping row of buttons, one per template, labelled with the template name.
  The row is absent when there are no templates.
- Clicking opens the popup: template name as the heading; one text input per field, in field order,
  labelled with the field name as written (`issueId`); a **bucket picker**; **Create** and **Cancel**.
  The first input is focused; Enter creates (if allowed), Escape cancels. Escape closes only the popup.
- The bucket picker lists all buckets that can hold tasks (custom buckets and Unsorted, not the
  Mission pseudo-bucket) and defaults to Unsorted.
- The new task gets: title and details with values substituted, the template's category, the chosen
  bucket, and is added to Mission (same as the add box does today).
- A template with no fields still opens the popup (for the bucket picker) — it is not created silently.

### Bucket picker on the main add box

- A compact bucket selector beside the existing category dot, defaulting to Unsorted, resetting to
  Unsorted after each add. Shift+Enter (add to top) keeps working.

### Managing templates and categories from Settings

- The Settings popup gets a section with two buttons: **TEMPLATES** and **CATEGORIES**.
- CATEGORIES opens the existing category manager (same behaviour, including drag sorting).
- TEMPLATES opens a template manager listing every template with: name, title, details (raw
  markdown, multi-line), category, a live list of detected fields, and delete (with a confirmation
  step). Name, title, details and category are editable; changes save on blur or via an explicit
  Save (builder's call), with the same unique-name rule.
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
| `name` | unique per user, case-insensitive (enforced in code) |
| `title` | text with placeholders |
| `details` | markdown with placeholders; empty string when none |
| `category_id` | nullable, references `objective_categories`; set to NULL when that category is deleted |
| `sort_order` | creation order (v1 has no reordering) |
| `created_at` | timestamp |

Fields are never stored; they are always derived from `title` + `details`.

## Constraints

- Follow existing patterns: DB functions in `src/db.ts`, optimistic state in a context or hook,
  pure logic in `src/utils`, tests next to code, docs updated in the same change (`docs/database.md`,
  `docs/architecture.md`, README).
- Both the sidebar and the Settings popup must see template changes immediately (shared state, not two
  independent loads).
- Pure functions for extracting fields and filling a template, fully unit-tested, including the
  escaping and single-pass rules above.
- `addObjective` currently cannot set `details`; creating from a template needs title, details,
  category and bucket in one create (builder decides how).
- Deleting a category must not break templates (`category_id` becomes NULL).

## Left to the builder

- File and component names; whether template state lives in `FocusContext` or a new context/hook.
- Exact look of the popup, the button row and the bucket selector, following the existing HUD style.
- Whether the template manager saves on blur or via a Save button.
- Wording of validation messages.

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

## Calls I made (please check)

1. Syntax is `$name` with `$$` as the escape (the user wrote `$title`, `$issueId`).
2. Field names are shown as written; no prettifying.
3. New tasks from a template go into Mission, like the add box.
4. A template stores the category but not the bucket (the bucket is always picked at creation).
5. Template names are unique per user, case-insensitive.
6. No drag-reordering of templates in v1.
7. Template buttons appear only in the left sidebar.
8. Editing a template's name in the manager to one that already exists shows an error and keeps the
   draft; nothing is saved until the name is valid.
9. The bucket picker only chooses the bucket. Shift+Enter ("add to top") keeps its current meaning
   (top of the Mission list); inside the chosen bucket the task is appended, as today.
10. If the source task has no category, the template has none.
11. Many templates: the button row wraps and scrolls after about three rows.
