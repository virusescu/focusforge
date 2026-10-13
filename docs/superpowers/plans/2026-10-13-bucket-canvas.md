# Bucket Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Backlog list with a Buckets page: an infinite pan/zoom canvas of colored, movable, resizable bucket panels, plus a movable virtual Mission panel.

**Architecture:** A new `buckets` table stores name, color and geometry; `objectives` gains `bucket_id` and `bucket_sort_order`. `FocusContext` exposes buckets and bucket operations with optimistic updates. A new `BucketsPage` view renders a CSS-transformed world (pure math in `utils/canvas.ts`) with `BucketPanel`s; cards are dragged with `@dnd-kit`.

**Tech Stack:** React 19, TypeScript, SCSS modules, `@dnd-kit/core` + `@dnd-kit/sortable` (already installed), `@libsql/client`, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-13-bucket-canvas-design.md`

## Global Constraints

- No new npm dependencies.
- Every user-owned query filters on `user_id` (system bucket lookups included).
- Migrations are idempotent: guarded `ALTER TABLE ... ADD COLUMN` in `initDb()`; per-user backfill in `ensureSystemBuckets()`, guarded by `bucket_id IS NULL`.
- Zoom clamp: `0.25` – `2`. Minimum panel size: `200 × 120` (world units).
- Bucket tint: `color-mix(in srgb, <color> 10%, transparent)`.
- Viewport persisted in `localStorage` key `bucket_canvas_viewport`.
- Space on the Buckets page recenters world (0,0) and keeps the zoom. Escape returns to the HUD. **B** on the HUD opens the page.
- Keyboard handlers ignore events whose target is an `input` or `textarea` (existing convention).
- Copy style: UPPER_SNAKE labels, as elsewhere (`BUCKETS`, `BACK_TO_HUD`, `NEW_BUCKET`, `UNSORTED`, `MISSION_OBJECTIVES`).
- Agents do **not** run `git commit`; the branch is committed once at the end.

## Review Focus

1. **Deleting a bucket with objectives in it** — they must move to Unsorted, never vanish or keep a dangling `bucket_id`. (Task 1 test.)
2. **Dragging a card onto the Mission panel** — it must stay in its bucket and appear in Mission; it must not be moved to a bucket with kind `mission`. (Task 1 db guard test + Task 3 context test.)
3. **Existing users' first launch** — all current open objectives (mission and backlog) land in Unsorted with a sensible `bucket_sort_order`, and Mission order is unchanged. (Task 1 backfill test.)
4. **Zooming with the wheel** — the point under the cursor must stay under the cursor. (Task 2 invariant test.)
5. **Typing in a card's rename box or the add box on the canvas** — Space must type a space, not recenter. (Task 4 test.)

---

## File map

| File | Task | Change |
|---|---|---|
| `src/types/index.ts` | 1 | `Bucket`, `BucketKind`, `BucketGeometry`; `StrategicObjective.bucket_id`, `bucket_sort_order`; drop "Backlog" from the `is_mission` comment |
| `src/db.ts` | 1 | `buckets` table, migrations, bucket functions, `addObjective` bucket param, `setObjectiveMission` replaces `moveObjectiveToOtherList` |
| `src/db.test.ts` | 1 | bucket tests |
| `src/utils/canvas.ts` (new) | 2 | pure viewport/geometry math + viewport persistence |
| `src/utils/canvas.test.ts` (new) | 2 | tests |
| `src/contexts/FocusContext.tsx` | 3 | bucket state and operations; remove backlog view state |
| `src/contexts/FocusContext.test.tsx` | 3 | update mocks, new tests |
| `src/components/SidebarLeft.tsx` (+ `.module.scss`) | 3 | Mission-only list, BUCKETS button, remove ←/→ and Shift+←/→ |
| `src/components/ObjectiveCard.tsx` (+ `.module.scss`) (new) | 4 | sortable card used on the canvas |
| `src/components/BucketPanel.tsx` (+ `.module.scss`) (new) | 4 | one panel |
| `src/components/BucketsPage.tsx` (+ `.module.scss`) (new) | 4 | the canvas view |
| `src/components/BucketsPage.test.tsx` (new) | 4 | tests |
| `src/App.tsx` | 5 | `'buckets'` view, navigation guard |
| `src/components/MainDisplay.tsx` | 5 | **B** shortcut |
| `docs/architecture.md`, `docs/database.md` | 5 | docs |

Dependency order: Tasks 1 and 2 are independent. Task 3 needs Task 1. Task 4 needs Tasks 2 and 3. Task 5 needs Task 3 and Task 4's `BucketsPage` export.

---

### Task 1: Types and database layer

**Files:**
- Modify: `src/types/index.ts:42-60`
- Modify: `src/db.ts` (objectives `CREATE TABLE` at ~66-79, migrations block at ~205-228, objective functions at ~562-703)
- Test: `src/db.test.ts`

**Interfaces:**
- Produces (types, in `src/types/index.ts`):

```ts
export type BucketKind = 'custom' | 'unsorted' | 'mission';

export interface BucketGeometry {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Bucket extends BucketGeometry {
  id: number;
  name: string;
  color: string;
  sort_order: number;
  kind: BucketKind;
}
```

`StrategicObjective` gains:

```ts
  bucket_id?: number | null;
  bucket_sort_order?: number | null;
```

and its `is_mission` comment becomes `// 1 = in Mission Objectives, 0 = only in its bucket`.

- Produces (in `src/db.ts`):

```ts
export const SYSTEM_BUCKET_DEFAULTS: Record<'mission' | 'unsorted', { name: string; color: string } & BucketGeometry>;
export async function ensureSystemBuckets(userId: number): Promise<void>;
export async function getBuckets(userId: number): Promise<Bucket[]>;
export async function addBucket(userId: number, name: string, color: string, geometry: BucketGeometry): Promise<number>;
export async function updateBucket(id: number, name: string, color: string): Promise<void>;
export async function updateBucketGeometry(id: number, geometry: BucketGeometry): Promise<void>;
export async function deleteBucket(id: number): Promise<void>;
export async function moveObjectiveToBucket(id: number, bucketId: number): Promise<void>;
export async function reorderBucketObjectives(orderedIds: number[]): Promise<void>;
export async function setObjectiveMission(id: number, isMission: number): Promise<void>;
export async function addObjective(userId: number, text: string, categoryId?: number | null, isMission?: number, prepend?: boolean, bucketId?: number | null): Promise<number>;
```

`moveObjectiveToOtherList` is **removed** (renamed to `setObjectiveMission`, same body).

- [ ] **Step 1: Write the failing tests** — append to `src/db.test.ts` and add the new names to its import line.

```ts
describe('Bucket Methods', () => {
  it('ensureSystemBuckets creates missing system buckets and backfills objectives', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [], rowsAffected: 0 })                       // SELECT kinds
      .mockResolvedValueOnce({ rows: [], rowsAffected: 1, lastInsertRowid: 1n })  // INSERT mission
      .mockResolvedValueOnce({ rows: [], rowsAffected: 1, lastInsertRowid: 2n })  // INSERT unsorted
      .mockResolvedValueOnce({ rows: [{ id: 2 }], rowsAffected: 0 })              // SELECT unsorted id
      .mockResolvedValueOnce({ rows: [], rowsAffected: 3 });                      // UPDATE backfill

    await ensureSystemBuckets(7);

    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('INSERT INTO buckets'),
      args: expect.arrayContaining([7, 'mission']),
    }));
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining('INSERT INTO buckets'),
      args: expect.arrayContaining([7, 'unsorted']),
    }));
    expect(mockExecute).toHaveBeenLastCalledWith({
      sql: expect.stringMatching(/UPDATE objectives SET bucket_id = \?, bucket_sort_order = COALESCE\(bucket_sort_order, sort_order\) WHERE user_id = \? AND bucket_id IS NULL/),
      args: [2, 7],
    });
  });

  it('ensureSystemBuckets does not insert when both system buckets exist', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ kind: 'mission' }, { kind: 'unsorted' }], rowsAffected: 0 })
      .mockResolvedValueOnce({ rows: [{ id: 2 }], rowsAffected: 0 })
      .mockResolvedValueOnce({ rows: [], rowsAffected: 0 });

    await ensureSystemBuckets(7);

    const sqls = mockExecute.mock.calls.map(c => (c[0] as { sql: string }).sql);
    expect(sqls.some(s => s.includes('INSERT INTO buckets'))).toBe(false);
  });

  it('deleteBucket moves objectives to Unsorted before deleting', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ user_id: 7, kind: 'custom' }], rowsAffected: 0 })
      .mockResolvedValueOnce({ rows: [{ id: 2 }], rowsAffected: 0 })
      .mockResolvedValueOnce({ rows: [], rowsAffected: 4 })
      .mockResolvedValueOnce({ rows: [], rowsAffected: 1 });

    await deleteBucket(9);

    expect(mockExecute).toHaveBeenNthCalledWith(3, {
      sql: expect.stringContaining('UPDATE objectives SET bucket_id = ? WHERE bucket_id = ?'),
      args: [2, 9],
    });
    expect(mockExecute).toHaveBeenNthCalledWith(4, {
      sql: expect.stringContaining('DELETE FROM buckets WHERE id = ?'),
      args: [9],
    });
  });

  it('deleteBucket refuses to delete a system bucket', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ user_id: 7, kind: 'unsorted' }], rowsAffected: 0 });
    await expect(deleteBucket(2)).rejects.toThrow('Cannot delete system bucket');
  });

  it('moveObjectiveToBucket appends to the target bucket', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ user_id: 7, kind: 'custom' }], rowsAffected: 0 })
      .mockResolvedValueOnce({ rows: [{ maxOrder: 4 }], rowsAffected: 0 })
      .mockResolvedValueOnce({ rows: [], rowsAffected: 1 });

    await moveObjectiveToBucket(11, 9);

    expect(mockExecute).toHaveBeenLastCalledWith({
      sql: expect.stringContaining('UPDATE objectives SET bucket_id = ?, bucket_sort_order = ? WHERE id = ?'),
      args: [9, 5, 11],
    });
  });

  it('moveObjectiveToBucket refuses the mission bucket', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ user_id: 7, kind: 'mission' }], rowsAffected: 0 });
    await expect(moveObjectiveToBucket(11, 1)).rejects.toThrow('Cannot move objective into mission bucket');
  });

  it('reorderBucketObjectives writes bucket_sort_order, not sort_order', async () => {
    mockExecute.mockResolvedValue({ rows: [], rowsAffected: 1 });
    await reorderBucketObjectives([5, 3]);
    expect(mockExecute).toHaveBeenNthCalledWith(1, { sql: 'UPDATE objectives SET bucket_sort_order = ? WHERE id = ?', args: [0, 5] });
    expect(mockExecute).toHaveBeenNthCalledWith(2, { sql: 'UPDATE objectives SET bucket_sort_order = ? WHERE id = ?', args: [1, 3] });
  });

  it('addObjective without a bucket puts it in Unsorted', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ maxOrder: 2 }], rowsAffected: 0 })   // MAX(sort_order)
      .mockResolvedValueOnce({ rows: [{ id: 2 }], rowsAffected: 0 })         // unsorted id
      .mockResolvedValueOnce({ rows: [{ maxOrder: 6 }], rowsAffected: 0 })   // MAX(bucket_sort_order)
      .mockResolvedValueOnce({ rows: [], rowsAffected: 1, lastInsertRowid: 30n });

    const id = await addObjective(7, 'Task', null, 1, false);

    expect(id).toBe(30);
    expect(mockExecute).toHaveBeenLastCalledWith({
      sql: expect.stringContaining('INSERT INTO objectives (user_id, text, sort_order, category_id, is_mission, bucket_id, bucket_sort_order)'),
      args: [7, 'Task', 3, null, 1, 2, 7],
    });
  });

  it('getBuckets maps rows to Bucket objects', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ kind: 'mission' }, { kind: 'unsorted' }], rowsAffected: 0 })
      .mockResolvedValueOnce({ rows: [{ id: 2 }], rowsAffected: 0 })
      .mockResolvedValueOnce({ rows: [], rowsAffected: 0 })
      .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Unsorted', color: '#888888', x: 360, y: 0, w: 300, h: 420, sort_order: 1, kind: 'unsorted' }], rowsAffected: 0 });

    const buckets = await getBuckets(7);

    expect(buckets).toEqual([{ id: 2, name: 'Unsorted', color: '#888888', x: 360, y: 0, w: 300, h: 420, sort_order: 1, kind: 'unsorted' }]);
  });
});
```

Also update any existing test that imports or calls `moveObjectiveToOtherList` or asserts the old `addObjective` INSERT SQL so it matches the new behaviour.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/db.test.ts`
Expected: FAIL — `ensureSystemBuckets` etc. are not exported.

- [ ] **Step 3: Implement**

In `initDb()`:
- Add `bucket_id INTEGER REFERENCES buckets(id),` and `bucket_sort_order INTEGER,` to the `CREATE TABLE IF NOT EXISTS objectives` statement.
- Before the objectives table, create:

```sql
CREATE TABLE IF NOT EXISTS buckets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  w REAL NOT NULL DEFAULT 300,
  h REAL NOT NULL DEFAULT 420,
  sort_order INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'custom',
  FOREIGN KEY (user_id) REFERENCES users(id)
)
```

- In the migrations block, add guarded `ALTER TABLE objectives ADD COLUMN bucket_id INTEGER` and `ALTER TABLE objectives ADD COLUMN bucket_sort_order INTEGER`, each in its own `try { } catch { }` like the existing ones.

New section `// ─── Buckets ───` before `// ─── Strategic Objectives ───`:

```ts
export const SYSTEM_BUCKET_DEFAULTS = {
  mission: { name: 'Mission', color: '#00ff88', x: 0, y: 0, w: 320, h: 480 },
  unsorted: { name: 'Unsorted', color: '#888888', x: 360, y: 0, w: 300, h: 420 },
} as const;

async function getUnsortedBucketId(userId: number): Promise<number> {
  const database = getDb();
  const result = await database.execute({
    sql: "SELECT id FROM buckets WHERE user_id = ? AND kind = 'unsorted' LIMIT 1",
    args: [userId],
  });
  if (result.rows.length === 0) throw new Error('Unsorted bucket missing');
  return result.rows[0].id as number;
}

export async function ensureSystemBuckets(userId: number): Promise<void> {
  const database = getDb();
  const existing = await database.execute({
    sql: "SELECT kind FROM buckets WHERE user_id = ? AND kind IN ('mission', 'unsorted')",
    args: [userId],
  });
  const kinds = new Set(existing.rows.map(r => r.kind as string));
  for (const kind of ['mission', 'unsorted'] as const) {
    if (kinds.has(kind)) continue;
    const d = SYSTEM_BUCKET_DEFAULTS[kind];
    await database.execute({
      sql: 'INSERT INTO buckets (user_id, name, color, x, y, w, h, sort_order, kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [userId, d.name, d.color, d.x, d.y, d.w, d.h, kind === 'mission' ? 0 : 1, kind],
    });
  }
  const unsortedId = await getUnsortedBucketId(userId);
  await database.execute({
    sql: 'UPDATE objectives SET bucket_id = ?, bucket_sort_order = COALESCE(bucket_sort_order, sort_order) WHERE user_id = ? AND bucket_id IS NULL',
    args: [unsortedId, userId],
  });
}
```

`getBuckets(userId)`: `await ensureSystemBuckets(userId)`, then `SELECT * FROM buckets WHERE user_id = ? ORDER BY sort_order ASC, id ASC` and map each row to `Bucket` (cast numbers with `Number(...)`, `kind` as `BucketKind`).

`addBucket(userId, name, color, geometry)`: `SELECT MAX(sort_order) as maxOrder FROM buckets WHERE user_id = ?`, then insert with `kind = 'custom'` and `sort_order = (maxOrder ?? -1) + 1`; return `Number(result.lastInsertRowid)`.

`updateBucket(id, name, color)`: `UPDATE buckets SET name = ?, color = ? WHERE id = ?`.

`updateBucketGeometry(id, { x, y, w, h })`: `UPDATE buckets SET x = ?, y = ?, w = ?, h = ? WHERE id = ?`.

`deleteBucket(id)`:
1. `SELECT user_id, kind FROM buckets WHERE id = ?`; return if no row.
2. If `kind !== 'custom'` → `throw new Error('Cannot delete system bucket')`.
3. `unsortedId = await getUnsortedBucketId(userId)`.
4. `UPDATE objectives SET bucket_id = ? WHERE bucket_id = ?` with `[unsortedId, id]` (covers open and completed objectives).
5. `DELETE FROM buckets WHERE id = ?`.

`moveObjectiveToBucket(id, bucketId)`:
1. `SELECT user_id, kind FROM buckets WHERE id = ?` with `[bucketId]`; return if no row; if `kind === 'mission'` → `throw new Error('Cannot move objective into mission bucket')`.
2. `SELECT MAX(bucket_sort_order) as maxOrder FROM objectives WHERE user_id = ? AND bucket_id = ? AND completed_at IS NULL`.
3. `UPDATE objectives SET bucket_id = ?, bucket_sort_order = ? WHERE id = ?` with `[bucketId, (maxOrder ?? -1) + 1, id]`.

`reorderBucketObjectives(orderedIds)`: loop like `reorderObjectives`, SQL exactly `'UPDATE objectives SET bucket_sort_order = ? WHERE id = ?'`.

Rename `moveObjectiveToOtherList(id, targetIsMission)` → `setObjectiveMission(id, isMission)`; body unchanged.

`addObjective(userId, text, categoryId, isMission = 1, prepend = false, bucketId = null)`: keep the existing `sort_order` logic, then:

```ts
  const targetBucketId = bucketId ?? await getUnsortedBucketId(userId);
  const bucketMax = await database.execute({
    sql: 'SELECT MAX(bucket_sort_order) as maxOrder FROM objectives WHERE user_id = ? AND bucket_id = ? AND completed_at IS NULL',
    args: [userId, targetBucketId],
  });
  const bucketSortOrder = ((bucketMax.rows[0]?.maxOrder as number | null) ?? -1) + 1;
  const result = await database.execute({
    sql: 'INSERT INTO objectives (user_id, text, sort_order, category_id, is_mission, bucket_id, bucket_sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [userId, text, sortOrder, categoryId ?? null, isMission, targetBucketId, bucketSortOrder],
  });
```

`getObjectives` mapping adds `bucket_id: (row.bucket_id as number | null) ?? null` and `bucket_sort_order: (row.bucket_sort_order as number | null) ?? null`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/db.test.ts`
Expected: PASS (all old and new tests).

---

### Task 2: Canvas math (`utils/canvas.ts`)

**Files:**
- Create: `src/utils/canvas.ts`
- Test: `src/utils/canvas.test.ts`

**Interfaces:**
- Consumes: `BucketGeometry` from `src/types` (Task 1). If Task 1 has not landed yet, declare an identical local `interface BucketGeometry { x: number; y: number; w: number; h: number }` and import it from `../types` once available — the final code must import from `../types`.
- Produces:

```ts
export interface Viewport { panX: number; panY: number; zoom: number } // screen = world * zoom + pan (screen relative to viewport element)
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;
export const MIN_PANEL_W = 200;
export const MIN_PANEL_H = 120;
export const DEFAULT_VIEWPORT: Viewport; // { panX: 0, panY: 0, zoom: 1 }
export const VIEWPORT_STORAGE_KEY = 'bucket_canvas_viewport';
export function clampZoom(zoom: number): number;
export function screenToWorld(vp: Viewport, sx: number, sy: number): { x: number; y: number };
export function worldToScreen(vp: Viewport, wx: number, wy: number): { x: number; y: number };
export function wheelZoomFactor(deltaY: number): number; // Math.exp(-deltaY * 0.0015)
export function zoomAt(vp: Viewport, sx: number, sy: number, factor: number): Viewport;
export function recenter(vp: Viewport, viewportWidth: number, viewportHeight: number): Viewport;
export function movePanel(geom: BucketGeometry, dxScreen: number, dyScreen: number, zoom: number): BucketGeometry;
export function resizePanel(geom: BucketGeometry, dxScreen: number, dyScreen: number, zoom: number): BucketGeometry;
export function loadViewport(): Viewport;  // invalid/missing → DEFAULT_VIEWPORT; zoom clamped
export function saveViewport(vp: Viewport): void;
```

- [ ] **Step 1: Write the failing tests** — `src/utils/canvas.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  clampZoom, screenToWorld, worldToScreen, zoomAt, recenter, movePanel, resizePanel,
  wheelZoomFactor, loadViewport, saveViewport, DEFAULT_VIEWPORT, MIN_ZOOM, MAX_ZOOM,
  MIN_PANEL_W, MIN_PANEL_H, VIEWPORT_STORAGE_KEY,
} from './canvas';

describe('canvas math', () => {
  it('clampZoom keeps zoom within bounds', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
    expect(clampZoom(10)).toBe(MAX_ZOOM);
    expect(clampZoom(1.3)).toBe(1.3);
  });

  it('screenToWorld and worldToScreen are inverses', () => {
    const vp = { panX: 120, panY: -40, zoom: 1.5 };
    const w = screenToWorld(vp, 300, 200);
    const s = worldToScreen(vp, w.x, w.y);
    expect(s.x).toBeCloseTo(300);
    expect(s.y).toBeCloseTo(200);
  });

  it('zoomAt keeps the world point under the cursor fixed', () => {
    const vp = { panX: 50, panY: 80, zoom: 1 };
    const before = screenToWorld(vp, 400, 300);
    const next = zoomAt(vp, 400, 300, 1.8);
    const after = screenToWorld(next, 400, 300);
    expect(next.zoom).toBeCloseTo(1.8);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('zoomAt clamps zoom and still keeps the cursor point fixed', () => {
    const vp = { panX: 0, panY: 0, zoom: 1.9 };
    const before = screenToWorld(vp, 100, 100);
    const next = zoomAt(vp, 100, 100, 5);
    expect(next.zoom).toBe(MAX_ZOOM);
    const after = screenToWorld(next, 100, 100);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('wheelZoomFactor zooms in for negative deltaY and out for positive', () => {
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1);
    expect(wheelZoomFactor(100)).toBeLessThan(1);
    expect(wheelZoomFactor(0)).toBe(1);
  });

  it('recenter puts world origin at the viewport center and keeps zoom', () => {
    const next = recenter({ panX: -999, panY: 12, zoom: 0.5 }, 1000, 600);
    expect(next).toEqual({ panX: 500, panY: 300, zoom: 0.5 });
    const origin = worldToScreen(next, 0, 0);
    expect(origin).toEqual({ x: 500, y: 300 });
  });

  it('movePanel converts screen deltas using zoom', () => {
    expect(movePanel({ x: 10, y: 20, w: 300, h: 400 }, 100, -50, 2)).toEqual({ x: 60, y: -5, w: 300, h: 400 });
  });

  it('resizePanel converts deltas using zoom and enforces minimum size', () => {
    expect(resizePanel({ x: 0, y: 0, w: 300, h: 400 }, 50, 50, 0.5)).toEqual({ x: 0, y: 0, w: 400, h: 500 });
    expect(resizePanel({ x: 0, y: 0, w: 300, h: 400 }, -1000, -1000, 1)).toEqual({ x: 0, y: 0, w: MIN_PANEL_W, h: MIN_PANEL_H });
  });
});

describe('viewport persistence', () => {
  beforeEach(() => localStorage.clear());

  it('returns the default viewport when nothing is stored', () => {
    expect(loadViewport()).toEqual(DEFAULT_VIEWPORT);
  });

  it('round-trips a saved viewport', () => {
    saveViewport({ panX: 10, panY: 20, zoom: 1.25 });
    expect(loadViewport()).toEqual({ panX: 10, panY: 20, zoom: 1.25 });
  });

  it('falls back to default on corrupt data and clamps stored zoom', () => {
    localStorage.setItem(VIEWPORT_STORAGE_KEY, '{not json');
    expect(loadViewport()).toEqual(DEFAULT_VIEWPORT);
    localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify({ panX: 1, panY: 2, zoom: 99 }));
    expect(loadViewport()).toEqual({ panX: 1, panY: 2, zoom: MAX_ZOOM });
    localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify({ panX: 'a', panY: 2, zoom: 1 }));
    expect(loadViewport()).toEqual(DEFAULT_VIEWPORT);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/canvas.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — key formulas:

```ts
export function screenToWorld(vp: Viewport, sx: number, sy: number) {
  return { x: (sx - vp.panX) / vp.zoom, y: (sy - vp.panY) / vp.zoom };
}
export function worldToScreen(vp: Viewport, wx: number, wy: number) {
  return { x: wx * vp.zoom + vp.panX, y: wy * vp.zoom + vp.panY };
}
export function zoomAt(vp: Viewport, sx: number, sy: number, factor: number): Viewport {
  const zoom = clampZoom(vp.zoom * factor);
  const world = screenToWorld(vp, sx, sy);
  return { zoom, panX: sx - world.x * zoom, panY: sy - world.y * zoom };
}
export function recenter(vp: Viewport, width: number, height: number): Viewport {
  return { zoom: vp.zoom, panX: width / 2, panY: height / 2 };
}
export function movePanel(g: BucketGeometry, dx: number, dy: number, zoom: number): BucketGeometry {
  return { ...g, x: g.x + dx / zoom, y: g.y + dy / zoom };
}
export function resizePanel(g: BucketGeometry, dx: number, dy: number, zoom: number): BucketGeometry {
  return { ...g, w: Math.max(MIN_PANEL_W, g.w + dx / zoom), h: Math.max(MIN_PANEL_H, g.h + dy / zoom) };
}
```

`loadViewport` parses JSON in a `try/catch`, requires all three fields to be finite numbers (`Number.isFinite`), otherwise returns `{ ...DEFAULT_VIEWPORT }`; clamps `zoom`. `saveViewport` writes `JSON.stringify(vp)` in a `try/catch` (ignore storage errors).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/canvas.test.ts`
Expected: PASS.

---

### Task 3: FocusContext bucket state + Mission-only sidebar

**Files:**
- Modify: `src/contexts/FocusContext.tsx`
- Modify: `src/contexts/FocusContext.test.tsx`
- Modify: `src/components/SidebarLeft.tsx`, `src/components/SidebarLeft.module.scss`

**Interfaces:**
- Consumes (Task 1): `getBuckets`, `addBucket`, `updateBucket`, `updateBucketGeometry`, `deleteBucket`, `moveObjectiveToBucket`, `reorderBucketObjectives`, `setObjectiveMission`, `addObjective(userId, text, categoryId, isMission, prepend, bucketId)`; types `Bucket`, `BucketGeometry`.
- Produces — `FocusContextType` changes:

Removed: `objectiveView`, `switchObjectiveView`, `backlogObjectives`, `moveObjectiveToOtherList`.

Changed:
```ts
  addObjective: (text: string, categoryId?: number | null, prepend?: boolean, options?: AddObjectiveOptions) => Promise<void>;
```
with exported
```ts
export interface AddObjectiveOptions {
  bucketId?: number | null; // default: Unsorted (resolved by db)
  inMission?: boolean;      // default: true
}
```

Added:
```ts
  buckets: Bucket[];
  objectivesByBucket: Map<number, StrategicObjective[]>; // key bucket id; sorted by bucket_sort_order ASC then id ASC; null bucket_id → Unsorted's id
  setObjectiveMission: (id: number, inMission: boolean) => Promise<void>;
  moveObjectiveToBucket: (id: number, bucketId: number) => Promise<void>;
  reorderBucketObjectives: (bucketId: number, orderedIds: number[]) => Promise<void>;
  addBucket: (name: string, color: string, geometry: BucketGeometry) => Promise<void>;
  updateBucket: (id: number, name: string, color: string) => Promise<void>;
  updateBucketGeometry: (id: number, geometry: BucketGeometry) => Promise<void>;
  deleteBucket: (id: number) => Promise<void>;
```

`missionObjectives` stays (`is_mission === 1`, in `objectivePool` order).

- Produces — `SidebarLeft` props: `{ onOpenSettings: () => void; onOpenDetails: () => void; onViewBuckets: () => void }`.

- [ ] **Step 1: Write the failing tests** — in `FocusContext.test.tsx`:
  - Replace `moveObjectiveToOtherList` in the `vi.mock('../db', ...)` factory with:

```ts
  getBuckets: () => mockGetBuckets(),
  addBucket: vi.fn().mockResolvedValue(10),
  updateBucket: vi.fn().mockResolvedValue(undefined),
  updateBucketGeometry: (id: number, g: unknown) => mockUpdateBucketGeometry(id, g),
  deleteBucket: (id: number) => mockDeleteBucket(id),
  moveObjectiveToBucket: (id: number, bucketId: number) => mockMoveObjectiveToBucket(id, bucketId),
  reorderBucketObjectives: vi.fn().mockResolvedValue(undefined),
  setObjectiveMission: (id: number, m: number) => mockSetObjectiveMission(id, m),
  updateObjectiveDetails: vi.fn().mockResolvedValue(undefined),
```

  with the corresponding `const mockX = vi.fn()` declarations at the top, `mockGetBuckets` defaulting to `[UNSORTED, WORK]` where

```ts
const UNSORTED = { id: 2, name: 'Unsorted', color: '#888888', x: 360, y: 0, w: 300, h: 420, sort_order: 1, kind: 'unsorted' as const };
const WORK = { id: 9, name: 'Work', color: '#3388ff', x: 700, y: 0, w: 300, h: 420, sort_order: 2, kind: 'custom' as const };
```

  and in `beforeEach` reset them (`mockGetBuckets.mockResolvedValue([UNSORTED, WORK])`, others `mockResolvedValue(undefined)`).
  - Change the `addObjective` mock wrapper to forward all args: `addObjective: (...args: unknown[]) => mockAddObjective(...args)` and update the existing assertion to `expect(mockAddObjective).toHaveBeenCalledWith(1, 'New Objective', undefined, 1, false, null)`.
  - Add tests:

```ts
  it('loads buckets and groups objectives by bucket', async () => {
    mockGetObjectives.mockResolvedValue([
      { id: 1, text: 'a', created_at: '', is_mission: 1, bucket_id: 9, bucket_sort_order: 1 },
      { id: 2, text: 'b', created_at: '', is_mission: 0, bucket_id: 9, bucket_sort_order: 0 },
      { id: 3, text: 'c', created_at: '', is_mission: 0, bucket_id: null, bucket_sort_order: null },
    ]);
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.buckets).toHaveLength(2));
    expect(result.current.objectivesByBucket.get(9)!.map(o => o.id)).toEqual([2, 1]);
    expect(result.current.objectivesByBucket.get(2)!.map(o => o.id)).toEqual([3]);
    expect(result.current.missionObjectives.map(o => o.id)).toEqual([1]);
  });

  it('addObjective with bucket options passes them to the DB', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addObjective('In work', 5, false, { bucketId: 9, inMission: false });
    });
    expect(mockAddObjective).toHaveBeenCalledWith(1, 'In work', 5, 0, false, 9);
  });

  it('setObjectiveMission updates optimistically and keeps the bucket', async () => {
    mockGetObjectives.mockResolvedValue([{ id: 4, text: 'x', created_at: '', is_mission: 0, bucket_id: 9, bucket_sort_order: 0 }]);
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.objectivePool).toHaveLength(1));
    await act(async () => { await result.current.setObjectiveMission(4, true); });
    expect(mockSetObjectiveMission).toHaveBeenCalledWith(4, 1);
    expect(result.current.objectivePool[0]).toMatchObject({ is_mission: 1, bucket_id: 9 });
  });

  it('moveObjectiveToBucket updates optimistically and reverts on failure', async () => {
    mockGetObjectives.mockResolvedValue([{ id: 4, text: 'x', created_at: '', is_mission: 1, bucket_id: 2, bucket_sort_order: 0 }]);
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.objectivePool).toHaveLength(1));

    await act(async () => { await result.current.moveObjectiveToBucket(4, 9); });
    expect(mockMoveObjectiveToBucket).toHaveBeenCalledWith(4, 9);
    expect(result.current.objectivePool[0]).toMatchObject({ bucket_id: 9, is_mission: 1 });

    mockMoveObjectiveToBucket.mockRejectedValueOnce(new Error('boom'));
    await act(async () => { await result.current.moveObjectiveToBucket(4, 2); });
    await waitFor(() => expect(result.current.objectivePool[0].bucket_id).toBe(2)); // reverted via refreshData (DB still says 2)
  });

  it('updateBucketGeometry updates local bucket state immediately', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.buckets).toHaveLength(2));
    await act(async () => { await result.current.updateBucketGeometry(9, { x: 1, y: 2, w: 300, h: 200 }); });
    expect(result.current.buckets.find(b => b.id === 9)).toMatchObject({ x: 1, y: 2, w: 300, h: 200 });
    expect(mockUpdateBucketGeometry).toHaveBeenCalledWith(9, { x: 1, y: 2, w: 300, h: 200 });
  });

  it('deleteBucket calls DB and refreshes', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.buckets).toHaveLength(2));
    mockGetBuckets.mockResolvedValue([UNSORTED]);
    await act(async () => { await result.current.deleteBucket(9); });
    expect(mockDeleteBucket).toHaveBeenCalledWith(9);
    expect(result.current.buckets).toEqual([UNSORTED]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/contexts/FocusContext.test.tsx`
Expected: FAIL — `buckets` undefined, etc.

- [ ] **Step 3: Implement `FocusContext`**
  - `refreshData`: `const bkts = await getBuckets(authUser.id);` **first** (it backfills `bucket_id`), then the existing `Promise.all`; `setBuckets(bkts)`.
  - `addObjective(text, categoryId, prepend = false, options = {})`: `await dbAddObjective(authUser.id, text, categoryId, options.inMission === false ? 0 : 1, prepend, options.bucketId ?? null); await refreshData();`
  - `objectivesByBucket`: `useMemo` over `objectivePool` and `buckets`; unsorted id = `buckets.find(b => b.kind === 'unsorted')?.id`; seed an empty array for every non-mission bucket; push each objective into `bucket_id ?? unsortedId`; sort each array by `(bucket_sort_order ?? Infinity)` then `id`.
  - `setObjectiveMission(id, inMission)`: optimistic `is_mission` + `last_interacted_at`; if `!inMission && activeObjectiveId === id` clear active; then `dbSetObjectiveMission(id, inMission ? 1 : 0)` and `dbUpdateObjectiveInteractionTime(id)` in `try`; `catch` → `console.error` + `refreshData()`. (Same shape as the old `moveObjectiveToOtherList`.)
  - `moveObjectiveToBucket(id, bucketId)`: optimistic — `bucket_id = bucketId`, `bucket_sort_order = 1 + max bucket_sort_order among open objectives already in bucketId (or 0)`; `try { await dbMoveObjectiveToBucket(id, bucketId) } catch { console.error; await refreshData() }`.
  - `reorderBucketObjectives(bucketId, orderedIds)`: optimistic — set `bucket_sort_order = index` for each id in `orderedIds`; then `try { await dbReorderBucketObjectives(orderedIds) } catch { refreshData }`. (`bucketId` is only for the caller's clarity; unused params are fine if lint allows, otherwise prefix `_bucketId`.)
  - `addBucket` → db then `refreshData()`. `updateBucket` and `updateBucketGeometry` → optimistic on `buckets`, db in `try`, `refreshData()` on failure. `deleteBucket` → db then `refreshData()`.
  - Delete `objectiveView` state, `switchObjectiveView`, `backlogObjectives`, `moveObjectiveToOtherList` and their entries in the type and provider value. Import renames: `setObjectiveMission as dbSetObjectiveMission`, etc.

- [ ] **Step 4: Update `SidebarLeft`**
  - Add prop `onViewBuckets`. `displayedObjectives = missionObjectives`.
  - Replace the `viewToggle` block (‹ / title / ›) with: title `MISSION_OBJECTIVES` and a button (lucide `LayoutGrid` icon + `BUCKETS`) that calls `soundEngine.playClick(); onViewBuckets();`, `onMouseEnter={() => setStatusHint('OPEN_BUCKETS')}`, `onMouseLeave={clearStatusHint}`, `title="Buckets (B)"`. Style it in `SidebarLeft.module.scss` as `.bucketsBtn` next to the existing `.sectionTitle` (reuse `.viewToggle` container as flex row with `justify-content: space-between`; remove now-unused `.viewToggleArrow` rules).
  - `SortableItem`: remove `onMove`/`objectiveView` props, the Shift+click move, and the `→/←` move button; add a small button (lucide `MinusCircle`, size 12, reuse `.moveBtn` styles) that calls `setObjectiveMission(obj.id, false)` via a new `onRemoveFromMission` prop, hint `REMOVE_FROM_MISSION`, `title="Remove from Mission"`.
  - Keyboard effect: delete section 1 (←/→ view switching) and the Shift+←/→ move branch. Keep ↑/↓ select and Shift+↑/↓/Home/End reorder.
  - Empty state text: `NO_ACTIVE_OBJECTIVES`.
  - The add box keeps working: `addObjective(text, categoryId, prepend)` (defaults → Mission + Unsorted).

- [ ] **Step 5: Run tests and type-check**

Run: `npx vitest run src/contexts/FocusContext.test.tsx && npx tsc -b --noEmit`
Expected: tests PASS. `tsc` may only fail in `App.tsx` for the missing `onViewBuckets` prop (Task 5 fixes it); fix any other error.

---

### Task 4: Canvas UI — `ObjectiveCard`, `BucketPanel`, `BucketsPage`

**Files:**
- Create: `src/components/ObjectiveCard.tsx`, `src/components/ObjectiveCard.module.scss`
- Create: `src/components/BucketPanel.tsx`, `src/components/BucketPanel.module.scss`
- Create: `src/components/BucketsPage.tsx`, `src/components/BucketsPage.module.scss`
- Test: `src/components/BucketsPage.test.tsx`

**Interfaces:**
- Consumes: Task 2 `canvas.ts` (all exports); Task 3 `useFocus()` fields `buckets`, `objectivesByBucket`, `missionObjectives`, `categories`, `addObjective`, `updateObjective`, `deleteObjective`, `updateObjectiveCategory`, `setObjectiveMission`, `moveObjectiveToBucket`, `reorderBucketObjectives`, `reorderObjectives`, `addBucket`, `updateBucket`, `updateBucketGeometry`, `deleteBucket`, `viewedObjectiveId`, `setViewedObjective`, `addCategory`, `updateCategory`, `deleteCategory`. Existing components: `CategoryDotPicker` (`{ categories, selectedCategoryId, onSelect, onManage }`), `CategoryManagerModal`, `ObjectiveDetails` (`{ onClose }`, shows `viewedObjectiveId`).
- Produces: `export const BucketsPage: FC<{ onBack: () => void }>`.

**Design rules (follow existing look: dark HUD, `var(--font-mono)`, `var(--border)`, UPPER_SNAKE labels; read `SidebarLeft.module.scss` and `VaultPage.module.scss` for tokens):**

`ObjectiveCard` — `FC<{ obj: StrategicObjective; containerId: string; categories: ObjectiveCategory[]; isViewed: boolean; inMissionPanel: boolean; onOpenDetails: (id: number) => void; onManageCategories: () => void }>`
- `useSortable({ id: \`obj-${obj.id}@${containerId}\`, data: { objectiveId: obj.id, containerId } })`. The same objective can appear in the Mission panel and its bucket, so sortable ids must include the container.
- Row: drag handle (GripVertical), category dot that toggles `CategoryDotPicker` (`updateObjectiveCategory`), text, buttons: details (lucide `FileText` → `onOpenDetails`), mission toggle (lucide `Target`; in a bucket: highlighted when `obj.is_mission === 1`, click toggles `setObjectiveMission`; in the Mission panel: `MinusCircle`, removes from Mission), delete (`X` → `deleteObjective`).
- Rename: double-click on the text or **F2** while `isViewed` → inline `input`; Enter saves via `updateObjective`, Escape cancels, blur saves. Clicking the row calls `setViewedObjective(obj.id)`.
- In a bucket panel, a mission card shows a small `★`/accent marker; in the Mission panel, the card shows a 3px left border in its bucket's color (look the bucket up by `obj.bucket_id` from `useFocus().buckets`).

`BucketPanel` — `FC<{ bucket: Bucket; objectives: StrategicObjective[]; zoom: number; onOpenDetails: (id: number) => void; onManageCategories: () => void }>`
- Absolutely positioned at `left: x, top: y, width: w, height: h` (world units; the parent is scaled). Local `geom` state mirrors the bucket while dragging; on `pointerup` call `updateBucketGeometry(bucket.id, geom)` once (skip if unchanged). Header `pointerdown` (not on its buttons/inputs) → move with `movePanel(start, dx, dy, zoom)`; bottom-right handle → `resizePanel`. Use `setPointerCapture`; `stopPropagation` so the canvas doesn't pan.
- Background: `style={{ background: \`color-mix(in srgb, ${bucket.color} 10%, transparent)\`, borderColor: bucket.color }}`; header gets a solid 3px top accent in `bucket.color`. Mission panel: fixed title `MISSION_OBJECTIVES`, color from the row, no rename/color/delete.
- Header (custom and unsorted): name (double-click to rename inline → `updateBucket(id, name, color)`; unsorted's name is editable too), `<input type="color">` → `updateBucket` on change, delete button only for `kind === 'custom'` → `window.confirm(\`DELETE_BUCKET "${name}"? Its objectives move to UNSORTED.\`)` → `deleteBucket`.
- Body: `useDroppable({ id: \`bucket-${bucket.id}\`, data: { containerId: \`bucket-${bucket.id}\` } })` wrapping a `SortableContext` (vertical) of `ObjectiveCard`s; `overflow-y: auto` so a small panel scrolls. Mission panel uses container id `mission`.
- Footer add box: `input` + Plus; Enter → `addObjective(text, null, false, bucket.kind === 'mission' ? { inMission: true } : { bucketId: bucket.id, inMission: false })`.
- Prevent wheel events inside the body from zooming the canvas when the list can scroll: in the body's `onWheel`, `if (!e.ctrlKey) e.stopPropagation()`.

`BucketsPage` — `FC<{ onBack: () => void }>`
- Root `div.page` (`grid-column: 1 / -1`, like `VaultPage`) containing a toolbar (back button `BACK_TO_HUD`, title `BUCKETS`, `+ NEW_BUCKET`, zoom readout `Math.round(zoom*100)%`, recenter button `⌖ ORIGIN`) and a `div.viewport` (`position: relative; overflow: hidden; flex: 1`).
- `viewport` state from `loadViewport()`; debounce-save with `saveViewport` (e.g. 300 ms after the last change, and on unmount).
- World: `div.world` with `transform: translate(${panX}px, ${panY}px) scale(${zoom})`, `transform-origin: 0 0`, containing a small origin marker at (0,0) and one `BucketPanel` per bucket (Mission panel gets `missionObjectives`, other buckets get `objectivesByBucket.get(id) ?? []`).
- Background grid: CSS `background-image` dots on `viewport`, with `background-position: ${panX}px ${panY}px` and `background-size: ${24*zoom}px` so it moves with pan/zoom.
- Pan: `pointerdown` on the viewport where `e.target === viewport || e.target === world`, or middle button anywhere → track delta, update `panX/panY`. Cursor `grab`/`grabbing`.
- Zoom: native `wheel` listener on the viewport registered with `{ passive: false }` in a `useEffect` (React's `onWheel` is passive); `e.preventDefault()`; `zoomAt(vp, e.clientX - rect.left, e.clientY - rect.top, wheelZoomFactor(e.deltaY))`.
- Keyboard (`window` keydown; ignore when target is `input`/`textarea`/`[contenteditable]`): Space → `preventDefault`, `recenter(vp, rect.width, rect.height)`; Escape → if details drawer open, close it, else `onBack()`. On first mount with no stored viewport, recenter.
- New bucket: center of viewport in world coords (`screenToWorld(vp, rect.width/2, rect.height/2)`) minus half the default size (300×420); name `NEW_BUCKET`; color = next of `['#3388ff', '#ff8844', '#44cc88', '#cc44cc', '#ffcc33', '#33cccc']` by `buckets.length % 6`; `addBucket(name, color, geom)`.
- Card DnD: one `DndContext` (sensors: `PointerSensor` with `{ activationConstraint: { distance: 5 } }`; collision `pointerWithin`, falling back to `closestCenter`). `DragOverlay` rendered **outside** the world div showing a plain copy of the card text, `style={{ transform: \`scale(${zoom})\`, transformOrigin: '0 0' }}`. `onDragEnd`:
  - read `active.data.current` `{ objectiveId, containerId: from }` and the target container: `over.data.current?.containerId` (cards and droppables both carry it).
  - `to === 'mission'` and `from !== 'mission'` → `setObjectiveMission(objectiveId, true)`.
  - `from === 'mission'` and `to === 'mission'` → reorder `missionObjectives` with `arrayMove` → `reorderObjectives(ids)`.
  - `from === 'mission'` and `to` is a bucket → `moveObjectiveToBucket(objectiveId, toId)` (stays in Mission).
  - bucket → same bucket, `over` is a card → `arrayMove` within that bucket's list → `reorderBucketObjectives(bucketId, ids)`.
  - bucket → other bucket → `moveObjectiveToBucket(objectiveId, toId)`.
  - Parse bucket ids from container ids with `Number(id.slice('bucket-'.length))`.
- Details drawer: when a card's details button is pressed → `setViewedObjective(id)` and open a right-side overlay (`position: absolute; right: 0; top: 0; bottom: 0; width: 420px`, `data-details-barrier`) rendering `<ObjectiveDetails onClose={...} />`.
- `CategoryManagerModal` opened from any card's dot picker "manage" action (same props as in `SidebarLeft`; compute `objectiveCountByCategory` the same way).

- [ ] **Step 1: Write the failing tests** — `src/components/BucketsPage.test.tsx`. Mock `../contexts/FocusContext` (`useFocus` returning fixture buckets `[MISSION(id 1, kind 'mission'), UNSORTED(id 2), WORK(id 9, color '#3388ff')]`, objectives, `vi.fn()` actions), `../utils/audio` (`soundEngine` with `playClick`, `playHover`, etc. as `vi.fn()`), and `./ObjectiveDetails` (`() => <div data-testid="details" />`). Clear `localStorage` in `beforeEach`.

```tsx
it('renders one panel per bucket with the mission title', () => {
  render(<BucketsPage onBack={vi.fn()} />);
  expect(screen.getByText('MISSION_OBJECTIVES')).toBeInTheDocument();
  expect(screen.getByText('Unsorted')).toBeInTheDocument();
  expect(screen.getByText('Work')).toBeInTheDocument();
});

it('tints a bucket panel with its color', () => {
  render(<BucketsPage onBack={vi.fn()} />);
  const panel = screen.getByText('Work').closest('[data-bucket-id]') as HTMLElement;
  expect(panel.getAttribute('data-bucket-id')).toBe('9');
  expect(panel.style.background).toContain('color-mix');
  expect(panel.style.background).toContain('#3388ff');
});

it('Space recenters the origin and keeps zoom', () => {
  localStorage.setItem('bucket_canvas_viewport', JSON.stringify({ panX: -500, panY: -500, zoom: 1.5 }));
  render(<BucketsPage onBack={vi.fn()} />);
  const world = screen.getByTestId('canvas-world');
  fireEvent.keyDown(window, { key: ' ' });
  // jsdom rects are 0×0, so center is (0,0)
  expect(world.style.transform).toBe('translate(0px, 0px) scale(1.5)');
});

it('Space typed in an input does not recenter', () => {
  localStorage.setItem('bucket_canvas_viewport', JSON.stringify({ panX: -500, panY: -500, zoom: 1 }));
  render(<BucketsPage onBack={vi.fn()} />);
  const world = screen.getByTestId('canvas-world');
  const input = screen.getAllByPlaceholderText('Add Objective...')[0];
  fireEvent.keyDown(input, { key: ' ' });
  expect(world.style.transform).toBe('translate(-500px, -500px) scale(1)');
});

it('Escape calls onBack', () => {
  const onBack = vi.fn();
  render(<BucketsPage onBack={onBack} />);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onBack).toHaveBeenCalled();
});

it('adding in a bucket panel creates a non-mission objective in that bucket', () => {
  render(<BucketsPage onBack={vi.fn()} />);
  const panel = screen.getByText('Work').closest('[data-bucket-id]') as HTMLElement;
  const input = within(panel).getByPlaceholderText('Add Objective...');
  fireEvent.change(input, { target: { value: 'Ship it' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(mockAddObjective).toHaveBeenCalledWith('Ship it', null, false, { bucketId: 9, inMission: false });
});

it('NEW_BUCKET calls addBucket with a default geometry', () => {
  render(<BucketsPage onBack={vi.fn()} />);
  fireEvent.click(screen.getByText('NEW_BUCKET'));
  expect(mockAddBucket).toHaveBeenCalledWith('NEW_BUCKET', expect.stringMatching(/^#/), expect.objectContaining({ w: 300, h: 420 }));
});

it('system buckets have no delete button', () => {
  render(<BucketsPage onBack={vi.fn()} />);
  const unsorted = screen.getByText('Unsorted').closest('[data-bucket-id]') as HTMLElement;
  expect(within(unsorted).queryByTitle('Delete bucket')).toBeNull();
  const work = screen.getByText('Work').closest('[data-bucket-id]') as HTMLElement;
  expect(within(work).getByTitle('Delete bucket')).toBeInTheDocument();
});
```

Required hooks for these tests: the world div has `data-testid="canvas-world"`; each panel root has `data-bucket-id={bucket.id}`; add inputs have `placeholder="Add Objective..."` and submit on Enter via `onKeyDown`; the custom-bucket delete button has `title="Delete bucket"`; the toolbar button text is exactly `NEW_BUCKET` (icon separate).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/BucketsPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** the three components and their SCSS per the design rules above.

- [ ] **Step 4: Run tests and lint**

Run: `npx vitest run src/components/BucketsPage.test.tsx && npx eslint src/components/BucketsPage.tsx src/components/BucketPanel.tsx src/components/ObjectiveCard.tsx src/utils/canvas.ts`
Expected: PASS, no lint errors.

---

### Task 5: Wiring, shortcut, docs

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/MainDisplay.tsx:19,116-158`
- Modify: `docs/architecture.md`, `docs/database.md`

**Interfaces:**
- Consumes: `BucketsPage: FC<{ onBack: () => void }>` (Task 4); `SidebarLeft` prop `onViewBuckets` (Task 3).

- [ ] **Step 1: App wiring**
  - `view` type: `'hud' | 'analytics' | 'intel' | 'vault' | 'buckets'`; `pendingNavigation.target` gains `'buckets'`.
  - `handleViewBuckets` same shape as `handleViewVault`; `handleConfirmNavigation` handles `'buckets'`.
  - `<SidebarLeft ... onViewBuckets={handleViewBuckets} />`, `<MainDisplay ... onViewBuckets={handleViewBuckets} />`.
  - Render branch: `view === 'buckets' ? <BucketsPage onBack={() => setView('hud')} />`.

- [ ] **Step 2: MainDisplay** — add optional prop `onViewBuckets?: () => void`; in the keydown handler add `else if (e.key.toLowerCase() === 'b') { if (onViewBuckets) { soundEngine.playTab(); onViewBuckets(); } }` and add it to the effect deps.

- [ ] **Step 3: Docs**
  - `docs/architecture.md`: Focus context row mentions buckets (and drops "mission + backlog"); views list adds `buckets`; components table adds `BucketsPage`, `BucketPanel`, `ObjectiveCard` and updates `SidebarLeft` ("Mission list … BUCKETS button"); utilities table adds `utils/canvas.ts`; HUD shortcuts: add **B** = Buckets, remove ←/→ and Shift+←/→ rows; add a **Buckets page** shortcut line: drag background / middle mouse pan · wheel zoom · Space recenter origin · F2 rename card · Escape back.
  - `docs/database.md`: add `buckets` row to Core tables; `objectives` row adds `bucket_id`, `bucket_sort_order` and redefines `is_mission` (1 = in Mission, 0 = only in its bucket); relationships diagram adds `users ─< buckets ─< objectives`; migrations list adds the two `ALTER`s and the per-user backfill in `ensureSystemBuckets` (system buckets `mission`/`unsorted`, Backlog → Unsorted).

- [ ] **Step 4: Full verification**

Run: `npm test && npm run lint && npm run build`
Expected: all tests pass, no lint errors, build succeeds.
