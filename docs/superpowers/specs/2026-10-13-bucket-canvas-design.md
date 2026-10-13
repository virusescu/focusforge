# Bucket Canvas — Design

Status: draft for review · Date: 2026-10-13

## Goal

Give objectives a visual home. A new **Buckets** page is an infinite, pannable,
zoomable canvas. Each bucket is a colored, movable, resizable panel that holds
objectives. A virtual **Mission** panel shows the objectives the user has chosen
to focus on. The Backlog list leaves the main page: backlog items now live in
buckets.

## Decisions (agreed in brainstorming)

| Topic | Decision |
|---|---|
| Buckets vs categories | Separate concepts. Categories (Hard/Normal/Easy, coin bounty) are unchanged. Every objective has one category *and* one bucket. |
| Unbucketed objectives | Not allowed. A built-in **Unsorted** bucket always exists; it can be recolored/moved/resized but not deleted. |
| Mission | A **flag** (`is_mission`, as today), not a place. A mission objective keeps its bucket and appears in both. The Mission panel is a system panel on the canvas. |
| Layout | Free-form canvas, not fixed columns. Panels store `x, y, w, h`. Content scrolls inside a panel that is too small. |
| Navigation | Pan (drag the background or middle mouse) and zoom (wheel). **Space** recenters the origin (0,0) in the viewport and keeps the zoom. |
| Color | Bucket color tints the panel background slightly (~10 % alpha) and drives its header accent. |
| Card actions (v1) | Add / rename / delete · drag between buckets · reorder within a bucket · difficulty dot + open details. |
| Implementation | Custom canvas: CSS-transformed world `div` + pointer events for panel move/resize; `@dnd-kit` (already a dependency) for card drag. No new dependency. |

## Data model

### New table `buckets`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `user_id` | INTEGER | every query filters on it |
| `name` | TEXT | |
| `color` | TEXT | hex |
| `x`, `y` | REAL | world coordinates of the panel's top-left |
| `w`, `h` | REAL | world size, clamped to a minimum (e.g. 200×120) |
| `sort_order` | INTEGER | stacking / tab order |
| `kind` | TEXT | `custom` \| `unsorted` \| `mission` |

`unsorted` and `mission` rows are created on demand by `ensureSystemBuckets(userId)`
(idempotent; called from `getBuckets`). They cannot be deleted. `mission` has a
fixed name and no objectives of its own.

### Changes to `objectives`

- `bucket_id INTEGER` → `buckets.id`. Added by a guarded `ALTER TABLE` in `initDb()`.
  Backfill: every existing objective (mission and backlog) gets the user's
  Unsorted bucket id.
- `bucket_sort_order INTEGER`: order inside a bucket. The existing `sort_order`
  keeps meaning "order in the Mission list", so the sidebar and the Mission panel
  stay in sync and the existing reorder code is unchanged. Backfill from `sort_order`.
- `is_mission` is unchanged (1 = in Mission, 0 = not). Value 0 now means "only in
  its bucket" rather than "Backlog".

### Behaviours

- **Create in a bucket panel:** `is_mission = 0`, `bucket_id` = that bucket.
- **Create in the Mission panel or the sidebar:** `is_mission = 1`, `bucket_id` = Unsorted.
- **Drag card to another bucket:** updates `bucket_id` and `bucket_sort_order`; `is_mission` untouched.
- **Drag card onto the Mission panel:** sets `is_mission = 1`; `bucket_id` untouched.
  Removing a card from Mission (button/menu on the card) sets `is_mission = 0`.
- **Reorder in a bucket:** rewrites `bucket_sort_order`. **Reorder in Mission:** rewrites `sort_order`.
- **Delete a custom bucket:** its open objectives move to Unsorted (confirm dialog first). Completed objectives also repoint to Unsorted.
- **Complete (neutralize) an objective:** unchanged; `bucket_id` is kept for history.

## Frontend

### Navigation and entry

- `HudApp.view` gains `'buckets'`. A header/sidebar button and the **B** key open it; **Escape** returns to the HUD. The existing `NavigationGuard` applies when the timer is not idle.
- Main sidebar shows **Mission only**: remove the Mission/Backlog tabs, `objectiveView`, `switchObjectiveView`, `backlogObjectives`, the ←/→ list switch and the Shift+←/→ move shortcut. The sidebar add box creates mission objectives in Unsorted.

### Components and modules

| Unit | Purpose | Depends on |
|---|---|---|
| `utils/canvas.ts` | Pure math: screen↔world, zoom around the cursor, zoom clamp (0.25–2), recenter, min panel size, resize with zoom. | none |
| `components/BucketsPage.tsx` | The viewport: pan/zoom handlers, world `div` transform, Space recenter, toolbar (+ bucket, zoom readout, recenter). Persists pan/zoom in `localStorage`. | `canvas.ts`, `BucketPanel` |
| `components/BucketPanel.tsx` | One panel: header (name, color picker, delete), drag-to-move by header, resize handle, tinted background, scrolling card list, add box. Reports geometry on pointer-up. | `ObjectiveCard` |
| `components/ObjectiveCard.tsx` | Row: text, difficulty dot (`CategoryDotPicker`), mission toggle, details button, inline rename (F2 / double-click), delete. Extracted from `SidebarLeft` if the existing row can be shared cleanly (decide in the plan). | `FocusContext` |
| `contexts/FocusContext.tsx` | Gains `buckets`, bucket CRUD, `moveObjectiveToBucket`, `setObjectiveMission`, `reorderInBucket`. Optimistic updates with `refreshData()` on failure, as for objectives today. | `db.ts` |
| `db.ts` | `getBuckets`, `addBucket`, `updateBucket` (name/color), `updateBucketGeometry`, `deleteBucket`, `ensureSystemBuckets`, `moveObjectiveToBucket`, `reorderBucketObjectives`; `getObjectives` returns `bucket_id` / `bucket_sort_order`. | |
| `types/index.ts` | `Bucket` interface; `StrategicObjective` gains `bucket_id`, `bucket_sort_order`. | |

### Interaction details

- **Pan:** pointer down on the canvas background (not on a panel) or middle mouse; update `panX/panY`.
- **Zoom:** wheel zooms around the cursor, clamped to 0.25–2.
- **Panel move/resize:** pointer events on the header and a corner handle, deltas divided by `zoom`. Geometry is held in local state while dragging and written to the DB on pointer-up (one `updateBucketGeometry` call).
- **Card drag:** one `DndContext` for the page. Each panel's list is a `SortableContext` and a droppable. A `DragOverlay` is rendered outside the scaled world and scaled by `zoom`, so the dragged card tracks the cursor correctly at any zoom. Dropping on the Mission panel adds to Mission.
- **Space:** when the page is focused and no input is active, centers world (0,0) in the viewport. The HUD's Space handler lives in `MainDisplay`, which is unmounted while this page is open, so there is no conflict.
- **Tint:** `background: color-mix(in srgb, <color> 10%, transparent)` plus a solid accent on the header.
- **New bucket:** placed at the viewport center (in world coordinates) with a default size and the next palette color.

## Risks

- **Drag at zoom ≠ 1.** `@dnd-kit` measures in screen space while panels sit inside a scaled container. Mitigation: `DragOverlay` outside the transform plus a scale modifier; verify by hand at 0.25, 1 and 2.
- **Two orderings.** `sort_order` (Mission) and `bucket_sort_order` (bucket) must not be mixed up. Mitigation: the db functions are named for the list they reorder, and tests cover both.
- **Migration on live databases.** The backfill must be idempotent because `initDb()` runs on every launch (guard on `bucket_id IS NULL`).
- **Existing tests** that assume Mission/Backlog tabs (`FocusContext.test.tsx`, `db.test.ts`) need updating.

## Testing

- `utils/canvas.test.ts`: coordinate transforms, zoom-at-cursor invariant (point under the cursor stays fixed), clamps, resize at several zooms.
- `db.test.ts`: `ensureSystemBuckets` idempotency, backfill, create/move/reorder/delete-bucket rules (including delete → Unsorted).
- `FocusContext.test.tsx`: optimistic bucket move and mission toggle; revert on DB failure.
- Component tests: `BucketPanel` renders the tint and calls the geometry callback on pointer-up; `BucketsPage` Space recenter.
- Manual: pan/zoom feel, cross-panel drag at several zoom levels, window resize.

## Docs to update with the change

- `docs/architecture.md`: new view, components, hooks/utils, shortcuts (B, canvas keys; remove Backlog shortcuts).
- `docs/database.md`: `buckets` table, new `objectives` columns, backfill migration, relationships diagram.

## Out of scope (v1)

Bucket-to-bucket links, multi-select, minimap, snap-to-grid, undo, sharing/export of layouts, a bucket-level coin bounty.
