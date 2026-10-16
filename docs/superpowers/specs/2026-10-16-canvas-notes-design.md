# Canvas notes, inverted snapping, markdown tables — design

Date: 2026-10-16

## Goal

Three changes to the Buckets page and the markdown editor:

1. **Inverted snapping.** Moving or resizing a panel snaps to the grid by default; Shift gives free, 1-unit movement. (Today it's the other way round, and the user ends up holding Shift all the time.)
2. **Sticky notes on the Buckets canvas.** Colored, movable, resizable notes with markdown content, edited in place.
3. **Markdown tables.** Tables render properly in both the objective details pane and notes.

Out of scope: renaming the Buckets page (dropped; the B shortcut would stop making sense), notes interleaving with buckets in a shared stacking order, notes linking to objectives.

## 1. Snapping

- `SNAP_STEP` stays 20 world units.
- `movePanel` / `resizePanel` in `utils/canvas.ts`: the `snap` parameter keeps its meaning, but callers pass `!e.shiftKey`. When not snapping, values are rounded to whole world units (`Math.round`), so Shift moves in 1-unit steps (1 px at 100% zoom).
- Minimum sizes are applied after snapping/rounding, as today.
- Applies to bucket panels, the Mission panel and notes.
- `canvas.test.ts` is updated: snap = grid values; free = integers.

## 2. Notes

### Data

New table `canvas_notes`:

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `user_id` | INTEGER → users | |
| `content` | TEXT NOT NULL DEFAULT '' | markdown |
| `color` | TEXT | hex, same palette as buckets |
| `x`, `y`, `w`, `h` | REAL | world units; default size 260×200 |
| `sort_order` | INTEGER | stacking among notes (higher = in front) |
| `created_at` | TEXT | |

Created with `CREATE TABLE IF NOT EXISTS` in `initDb`; no migration of existing data. Type `CanvasNote` in `types`.

DB functions in `db.ts`: `getCanvasNotes(userId)`, `addCanvasNote(userId, color, geometry) → id`, `updateCanvasNoteContent(id, content)`, `updateCanvasNoteColor(id, color)`, `updateCanvasNoteGeometry(id, geometry)`, `bringCanvasNoteToFront(userId, id)` (sort_order = user's max + 1), `deleteCanvasNote(id)`.

### State

Hook `hooks/useCanvasNotes.ts`, used only by `BucketsPage` (notes are not needed anywhere else, so `FocusContext` doesn't grow). It loads notes for the signed-in user on mount and exposes `notes`, `addNote`, `updateContent`, `updateColor`, `updateGeometry`, `bringToFront`, `deleteNote`. Edits are optimistic; on DB failure it reloads from the DB (same revert pattern as buckets).

### Shared drag logic

The pointer move/resize logic in `BucketPanel` (threshold before capture, pointer capture, geometry on pointerup, bring to front on drop, save only when changed) moves into `hooks/usePanelDrag.ts`. `BucketPanel` and `CanvasNoteView` both use it. Behaviour of bucket panels doesn't change apart from the snapping inversion.

### `CanvasNoteView` component

- Background and border tinted with the note color, using the same tinting approach as `BucketPanel`.
- **Move:** drag from anywhere on the note, except buttons, links, checkboxes and while editing. Uses the same 3 px threshold so double-click still works.
- **Resize:** corner handle; minimum 160×100.
- **Hover controls:** color swatch picker (bucket palette) and delete. Delete asks for confirmation only if the note has content.
- **View mode:** content rendered with `MarkdownView`; scrolls inside the note (`data-canvas-scroll`, so the wheel scrolls the note instead of zooming). Task checkboxes toggle directly. An empty note shows a muted "Double-click to edit" hint.
- **Edit mode:** double-click → compact `MarkdownToolbar` + textarea filling the note. Same keys as the details pane: Esc saves, Shift+Esc cancels, the Ctrl shortcuts (B/I/S/1/2/3/L/T/D, Ctrl+↑/↓) and auto-link on paste. Clicking outside the note saves.
- **Layering:** notes render after the bucket panels with z-index `NOTE_Z_BASE + stackingOrder` (`NOTE_Z_BASE` above any bucket z-index), so every note is above every bucket. A note being dragged is lifted above the other notes; dropping it calls `bringToFront`. `stackingOrder` from `utils/canvas.ts` is reused.

### NEW_NOTE button

In the Buckets toolbar next to NEW_BUCKET. It creates a note with the default color `#ffcc33`, placed near the top-right of the visible viewport (screen point `(viewportWidth - w*zoom - 24, 24)` converted to world, snapped to the grid), and opens it in edit mode right away.

## 3. Shared markdown and tables

Extract from `ObjectiveDetails`:

- `components/MarkdownView.tsx` renders markdown with `remark-gfm`, `remark-breaks`, the task line index plugin, the blank-line preservation and line map, the task checkbox toggle (prop `onToggleTask(originalLineIndex)`) and external links (opened via the shell). Tables are wrapped in a horizontally scrollable container.
- `components/MarkdownToolbar.tsx` has the toolbar buttons (headings, bold/italic/strike, bullet list, task list, link, table). Prop `compact` for the note version (icons only, smaller).
- `hooks/useMarkdownEditor.ts` holds the editing text state and helpers: `wrapSelection`, `insertTemplate`, `insertLink`, `handleKeyDown` (the Ctrl shortcuts plus Esc/Shift+Esc calling `onSave`/`onCancel`) and `handlePaste`.
- `components/Markdown.module.scss` holds the rendered markdown styles currently in `ObjectiveDetails.module.scss`, plus **table styles**: collapsed borders, a header row with a subtle background, cell padding, alignment from `:---:` / `---:`, and zebra rows. The colors use the existing theme variables and work on tinted note backgrounds.

`ObjectiveDetails` is rewritten on top of these, with no behaviour change except that tables now look right.

## Testing

- `utils/canvas.test.ts`: snap and free rounding.
- `db.test.ts`: canvas notes CRUD, bring to front.
- `components/MarkdownView.test.tsx`: a table renders `table/th/td`; checkbox toggle reports the original line index (including with blank-line padding).
- `hooks/useMarkdownEditor.test.ts`: wrap/unwrap, template insertion, Esc saves, Shift+Esc cancels.
- `components/CanvasNoteView.test.tsx`: double-click enters edit mode, Esc saves content, Shift+Esc cancels, delete, color change.
- `components/BucketsPage.test.tsx`: NEW_NOTE creates a note in edit mode; notes are stacked above panels.
- The existing `ObjectiveDetails`/`BucketPanel` tests keep passing.

## Docs

- `docs/architecture.md`: `CanvasNoteView`, `MarkdownView`, `MarkdownToolbar`, the `useCanvasNotes`/`usePanelDrag`/`useMarkdownEditor` hooks, inverted Shift behaviour, NEW_NOTE.
- `docs/database.md`: the `canvas_notes` table.
- `README.md` Key Features, and the `docs/IDEAS.md` status list.
