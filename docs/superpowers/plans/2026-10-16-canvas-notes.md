# Canvas Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invert the canvas snapping (snap by default, Shift = free 1-unit steps), add colored markdown sticky notes to the Buckets canvas, and make markdown tables render properly in both notes and the objective details pane.

**Architecture:** Pure geometry stays in `utils/canvas.ts`; the panel pointer move/resize logic moves into a `usePanelDrag` hook shared by `BucketPanel` and the new `CanvasNoteView`. The markdown rendering and editing currently inlined in `ObjectiveDetails` is split into `MarkdownView` (render), `MarkdownToolbar` (buttons) and `useMarkdownEditor` (textarea editing helpers), with pure helpers in `utils/markdown.ts`. Notes are stored in a new `canvas_notes` table, loaded by a page-local `useCanvasNotes` hook (FocusContext is untouched), and rendered by `BucketsPage` in a layer above all bucket panels.

**Tech Stack:** React 19 + TypeScript, SCSS modules, `react-markdown` 10 + `remark-gfm` + `remark-breaks` (already installed), `@libsql/client` (Turso), Vitest + React Testing Library + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-16-canvas-notes-design.md`

## Global Constraints

- `SNAP_STEP` stays **20** world units. No Shift = snap to the grid; Shift = free, rounded to whole world units (`Math.round`).
- Bucket minimum size stays 200×120; note minimum size is **160×100**; default note size **260×200**; default note color **`#ffcc33`**.
- Every note is stacked above every bucket panel (`NOTE_Z_BASE = 10000`, buckets use 1..N); notes stack among themselves by `sort_order` via the existing `stackingOrder`.
- Note editing keys match the details pane: **Esc saves, Shift+Esc cancels**, Ctrl+B/I/S/1/2/3/L/T/D, Ctrl+↑/↓, auto-link on paste. Clicking outside the note saves.
- Delete asks `window.confirm` only when the note has non-blank content.
- No rename of the Buckets page; the `B` shortcut and all labels stay.
- No new dependencies.
- `npm run lint` already reports 47 problems (45 errors, 2 warnings) on master. Don't add new ones in the files you create or touch (run `npx eslint <files>` on them).
- UI copy style: uppercase snake-ish labels (`NEW_NOTE`), as the existing toolbar uses.
- Tests are co-located (`*.test.ts(x)` next to the source). Run with `npx vitest run <path>`; the full suite is `npm test`.

## Review Focus

1. **Clicking a checkbox or link inside a note** must toggle the task / open the link and must NOT start a move or enter edit mode → test in Task 7 (pointerdown on checkbox doesn't capture; click toggles content).
2. **Esc / Space typed in a note's textarea** must save the note (Esc) or type a space, and must NOT leave the Buckets page or recenter → test in Task 8.
3. **Wheel over a note** scrolls the note instead of zooming the canvas → test in Task 8.
4. **Blank lines before a task list** (`a\n\n\n- [ ] x`) — toggling the checkbox must flip the right source line → test in Task 3 (`MarkdownView`) and Task 3 (`utils/markdown.ts`).
5. **Double-clicking a second note while one is being edited** saves the first (outside mousedown) and opens the second; only one editor exists at a time → test in Task 8.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/canvas.ts` (modify) | `snapToGrid`, inverted-snap-friendly `movePanel`/`resizePanel` with free rounding and an optional min size |
| `src/hooks/usePanelDrag.ts` (create) | Pointer move/resize state machine for any canvas panel |
| `src/components/BucketPanel.tsx` (modify) | Uses `usePanelDrag` |
| `src/utils/markdown.ts` (create) | Pure helpers: `preserveBlankLines`, `toggleTaskLine` |
| `src/components/MarkdownView.tsx` + `.module.scss` (create) | Renders markdown (GFM, breaks, task toggles, external links, scrollable tables) |
| `src/hooks/useMarkdownEditor.ts` (create) | Textarea editing state + helpers + key/paste handlers |
| `src/components/MarkdownToolbar.tsx` + `.module.scss` (create) | Toolbar buttons, normal and compact |
| `src/components/ObjectiveDetails.tsx` + `.module.scss` (modify) | Rebuilt on the three shared pieces |
| `src/types/index.ts` (modify) | `CanvasNote` |
| `src/db.ts` (modify) | `canvas_notes` table + 7 functions |
| `src/hooks/useCanvasNotes.ts` (create) | Loads notes for the signed-in user, optimistic edits |
| `src/components/CanvasNoteView.tsx` + `.module.scss` (create) | One note (view/edit, move/resize, color, delete) |
| `src/components/BucketsPage.tsx` (modify) | NEW_NOTE, notes layer, `editingNoteId` |
| Docs (modify) | `docs/architecture.md`, `docs/database.md`, `README.md`, `docs/IDEAS.md` |

---

### Task 1: Inverted snapping

**Files:**
- Modify: `src/utils/canvas.ts:45-63`
- Modify: `src/components/BucketPanel.tsx:70-77`
- Test: `src/utils/canvas.test.ts`, `src/components/BucketsPage.test.tsx`

**Interfaces:**
- Produces:
  - `export const SNAP_STEP = 20`
  - `export function snapToGrid(value: number): number`
  - `export interface MinSize { w: number; h: number }`
  - `export const MIN_PANEL_SIZE: MinSize` (= `{ w: MIN_PANEL_W, h: MIN_PANEL_H }`)
  - `movePanel(geom: BucketGeometry, dxScreen: number, dyScreen: number, zoom: number, snap = false): BucketGeometry`. When `snap` is false, values are `Math.round`ed.
  - `resizePanel(geom, dxScreen, dyScreen, zoom, snap = false, min: MinSize = MIN_PANEL_SIZE): BucketGeometry`

- [ ] **Step 1: Write the failing tests**

In `src/utils/canvas.test.ts`, add `snapToGrid` to the import list from `./canvas`, then add these tests inside the top-level `describe` block (next to the existing snap tests at lines 9-18):

```ts
  it('snapToGrid rounds to the nearest SNAP_STEP', () => {
    expect(snapToGrid(29)).toBe(20);
    expect(snapToGrid(31)).toBe(40);
    expect(snapToGrid(-11)).toBe(-20);
  });

  it('movePanel without snap rounds to whole units', () => {
    expect(movePanel({ x: 0, y: 0, w: 300, h: 400 }, 7, 3, 2)).toEqual({ x: 4, y: 2, w: 300, h: 400 });
  });

  it('resizePanel without snap rounds to whole units', () => {
    expect(resizePanel({ x: 0, y: 0, w: 300, h: 400 }, 7, 3, 2)).toEqual({ x: 0, y: 0, w: 304, h: 402 });
  });

  it('resizePanel honours a custom minimum size', () => {
    expect(resizePanel({ x: 0, y: 0, w: 300, h: 400 }, -1000, -1000, 1, true, { w: 160, h: 100 }))
      .toEqual({ x: 0, y: 0, w: 160, h: 100 });
  });
```

In `src/components/BucketsPage.test.tsx`, replace the test `'holding Shift while moving snaps the saved position to 20'` (around line 194) with these two:

```tsx
  it('moving without Shift snaps the saved position to 20', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const header = screen.getByText('Work').parentElement as HTMLElement;
    fireEvent.pointerDown(header, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(header, { pointerId: 1, buttons: 1, clientX: 53, clientY: 17 });
    fireEvent.pointerUp(header, { pointerId: 1, clientX: 53, clientY: 17 });
    expect(mockUpdateBucketGeometry).toHaveBeenCalledWith(9, { x: 400, y: 20, w: 300, h: 420 });
  });

  it('holding Shift while moving saves the free position in whole units', () => {
    render(<BucketsPage onBack={vi.fn()} />);
    const header = screen.getByText('Work').parentElement as HTMLElement;
    fireEvent.pointerDown(header, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(header, { pointerId: 1, buttons: 1, shiftKey: true, clientX: 53, clientY: 17 });
    fireEvent.pointerUp(header, { pointerId: 1, shiftKey: true, clientX: 53, clientY: 17 });
    expect(mockUpdateBucketGeometry).toHaveBeenCalledWith(9, { x: 393, y: 17, w: 300, h: 420 });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/canvas.test.ts src/components/BucketsPage.test.tsx`
Expected: FAIL. `snapToGrid` is not exported; the free-rounding test gets `3.5`/`1.5`; the custom-min test gets 200×120; the no-Shift test gets `393, 17` and the Shift test gets `400, 20`.

- [ ] **Step 3: Implement**

In `src/utils/canvas.ts`, replace lines 45-63 (from the `// Grid step` comment through the end of `resizePanel`) with:

```ts
// Grid step (world units) for move/resize. Snapping is the default; holding Shift moves
// freely in whole units.
export const SNAP_STEP = 20;

export interface MinSize {
  w: number;
  h: number;
}

export const MIN_PANEL_SIZE: MinSize = { w: MIN_PANEL_W, h: MIN_PANEL_H };

export function snapToGrid(value: number): number {
  return Math.round(value / SNAP_STEP) * SNAP_STEP;
}

const place = (value: number, snap: boolean) => (snap ? snapToGrid(value) : Math.round(value));

export function movePanel(geom: BucketGeometry, dxScreen: number, dyScreen: number, zoom: number, snap = false): BucketGeometry {
  return { ...geom, x: place(geom.x + dxScreen / zoom, snap), y: place(geom.y + dyScreen / zoom, snap) };
}

export function resizePanel(
  geom: BucketGeometry,
  dxScreen: number,
  dyScreen: number,
  zoom: number,
  snap = false,
  min: MinSize = MIN_PANEL_SIZE,
): BucketGeometry {
  return {
    ...geom,
    w: Math.max(min.w, place(geom.w + dxScreen / zoom, snap)),
    h: Math.max(min.h, place(geom.h + dyScreen / zoom, snap)),
  };
}
```

In `src/components/BucketPanel.tsx`, replace the `geometryAt` comment and body (lines 70-77) with:

```ts
  // Snaps to the SNAP_STEP grid unless Shift is held
  const geometryAt = (drag: PointerDrag, e: React.PointerEvent): BucketGeometry => {
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    return drag.mode === 'move'
      ? movePanel(drag.start, dx, dy, zoom, !e.shiftKey)
      : resizePanel(drag.start, dx, dy, zoom, !e.shiftKey);
  };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/canvas.test.ts src/components/BucketsPage.test.tsx`
Expected: PASS. The existing `'panel move saves the geometry from the pointerup position'` (expects `x: 420, y: 20`) still passes, because 420/20 are already on the grid.

- [ ] **Step 5: Lint and commit**

```bash
npx eslint src/utils/canvas.ts src/components/BucketPanel.tsx
git add src/utils/canvas.ts src/utils/canvas.test.ts src/components/BucketPanel.tsx src/components/BucketsPage.test.tsx
git commit -m "feat: snap canvas panels by default, Shift moves freely"
```

---

### Task 2: Extract `usePanelDrag`

Behaviour-preserving refactor of `BucketPanel`. The existing `BucketsPage.test.tsx` drag tests (threshold capture, pointerup geometry, bring to front, click saves nothing, lift while dragging) are the regression suite.

**Files:**
- Create: `src/hooks/usePanelDrag.ts`
- Modify: `src/components/BucketPanel.tsx`

**Interfaces:**
- Consumes: `movePanel`, `resizePanel`, `MIN_PANEL_SIZE`, `MinSize` from Task 1.
- Produces:
  ```ts
  export type PanelDragMode = 'move' | 'resize';
  export interface PanelDragOptions {
    geometry: BucketGeometry;          // stored geometry, used when no drag is in progress
    zoom: number;
    minSize?: MinSize;                 // default MIN_PANEL_SIZE
    // Called once at the end of a real drag (never for a plain click)
    onDragEnd: (final: BucketGeometry, changed: boolean) => void;
  }
  export function usePanelDrag(options: PanelDragOptions): {
    geom: BucketGeometry;              // live geometry (drag geometry while dragging)
    isDragging: boolean;
    beginPointerDrag: (e: React.PointerEvent<HTMLElement>, mode: PanelDragMode) => void;
    handlePointerMove: (e: React.PointerEvent<HTMLElement>) => void;
    handlePointerUp: (e: React.PointerEvent<HTMLElement>) => void; // also use for pointercancel
  };
  ```

- [ ] **Step 1: Create the hook**

`src/hooks/usePanelDrag.ts`:

```ts
import { useRef, useState } from 'react';
import { movePanel, resizePanel, MIN_PANEL_SIZE, type MinSize } from '../utils/canvas';
import type { BucketGeometry } from '../types';

export type PanelDragMode = 'move' | 'resize';

interface PointerDrag {
  mode: PanelDragMode;
  startX: number;
  startY: number;
  start: BucketGeometry;
  captured: boolean;
}

// Pointer travel (screen px) before a press becomes a move. Capturing earlier would
// retarget the click/dblclick to the panel and break double-click actions.
const DRAG_THRESHOLD_PX = 3;

export interface PanelDragOptions {
  geometry: BucketGeometry;
  zoom: number;
  minSize?: MinSize;
  // Called once at the end of a real drag (never for a plain click)
  onDragEnd: (final: BucketGeometry, changed: boolean) => void;
}

// Move/resize of a canvas panel with pointer events. Snaps to the grid unless Shift is held.
export function usePanelDrag({ geometry, zoom, minSize = MIN_PANEL_SIZE, onDragEnd }: PanelDragOptions) {
  // Geometry while a move/resize is in progress; null means "use the stored geometry"
  const [dragGeom, setDragGeom] = useState<BucketGeometry | null>(null);
  const dragRef = useRef<PointerDrag | null>(null);
  const geom = dragGeom ?? geometry;

  const geometryAt = (drag: PointerDrag, e: React.PointerEvent): BucketGeometry => {
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    return drag.mode === 'move'
      ? movePanel(drag.start, dx, dy, zoom, !e.shiftKey)
      : resizePanel(drag.start, dx, dy, zoom, !e.shiftKey, minSize);
  };

  const beginPointerDrag = (e: React.PointerEvent<HTMLElement>, mode: PanelDragMode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    // A resize handle has no click behaviour, so it captures right away
    const captured = mode === 'resize';
    if (captured) e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, start: geom, captured };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.stopPropagation();
    if (!drag.captured) {
      // Released outside the panel before the drag started; we never saw the pointerup
      if ((e.buttons & 1) === 0) {
        dragRef.current = null;
        return;
      }
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD_PX) return;
      drag.captured = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    setDragGeom(geometryAt(drag, e));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.stopPropagation();
    dragRef.current = null;
    setDragGeom(null);
    if (!drag.captured) return; // a click, not a drag
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    // From the event, not dragGeom: the last pointermove may not have rendered yet.
    // A cancelled pointer has no meaningful position, so it keeps the last rendered geometry.
    const final = e.type === 'pointercancel' ? dragGeom : geometryAt(drag, e);
    if (!final) return;
    const s = drag.start;
    onDragEnd(final, final.x !== s.x || final.y !== s.y || final.w !== s.w || final.h !== s.h);
  };

  return { geom, isDragging: dragGeom !== null, beginPointerDrag, handlePointerMove, handlePointerUp };
}
```

- [ ] **Step 2: Use it in `BucketPanel`**

In `src/components/BucketPanel.tsx`:

1. Imports: drop `movePanel, resizePanel` from `../utils/canvas` (remove the whole import line) and drop `BucketGeometry` from the types import (`import type { Bucket, StrategicObjective } from '../types';`). Add `import { usePanelDrag } from '../hooks/usePanelDrag';`.
2. Delete the `PointerDrag` interface, the `DRAG_THRESHOLD_PX` constant and its comment.
3. Delete the `dragGeom` state, `dragRef`, the `geom` const, `beginPointerDrag`, `geometryAt`, `handlePointerMove` and `handlePointerUp` (old lines ~42-44 and ~58-118). Put this in their place, right after `const containerId = ...`:

```ts
  const { geom, isDragging, beginPointerDrag, handlePointerMove, handlePointerUp } = usePanelDrag({
    geometry: { x: bucket.x, y: bucket.y, w: bucket.w, h: bucket.h },
    zoom,
    onDragEnd: (final, changed) => {
      // The last panel moved or resized stays on top
      bringBucketToFront(bucket.id);
      if (changed) updateBucketGeometry(bucket.id, final);
    },
  });
```

4. Keep `handleHeaderPointerDown` as it is (it calls `beginPointerDrag(e, 'move')`).
5. In the JSX, replace both uses of `dragGeom` with `isDragging`: ``className={`${styles.panel} ${isDragging ? styles.dragging : ''}`}`` and `zIndex: isDragging ? DRAGGING_Z_INDEX : zIndex`.

- [ ] **Step 3: Run the regression tests**

Run: `npx vitest run src/components/BucketsPage.test.tsx`
Expected: PASS (all drag tests unchanged).

- [ ] **Step 4: Typecheck, lint and commit**

```bash
npx tsc -b
npx eslint src/hooks/usePanelDrag.ts src/components/BucketPanel.tsx
git add src/hooks/usePanelDrag.ts src/components/BucketPanel.tsx
git commit -m "refactor: extract usePanelDrag from BucketPanel"
```

---

### Task 3: `MarkdownView` with tables, and the markdown helpers

**Files:**
- Create: `src/utils/markdown.ts`, `src/utils/markdown.test.ts`
- Create: `src/components/MarkdownView.tsx`, `src/components/MarkdownView.module.scss`, `src/components/MarkdownView.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  // utils/markdown.ts
  export function preserveBlankLines(source: string): { rendered: string; lineMap: number[] };
  export function toggleTaskLine(source: string, lineIndex: number): { source: string; checked: boolean } | null;
  // components/MarkdownView.tsx
  export interface MarkdownViewProps {
    source: string;
    onChange?: (next: string) => void; // called with the new source when a task checkbox is toggled
    className?: string;                // extra class on the root (layout: flex/overflow)
  }
  export const MarkdownView: FC<MarkdownViewProps>;
  ```

- [ ] **Step 1: Write the failing tests for the helpers**

`src/utils/markdown.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { preserveBlankLines, toggleTaskLine } from './markdown';

describe('preserveBlankLines', () => {
  it('leaves text without repeated blank lines unchanged', () => {
    expect(preserveBlankLines('a\n\nb')).toEqual({ rendered: 'a\n\nb', lineMap: [0, 1, 2] });
  });

  it('adds a zero-width line per extra blank line and maps it back', () => {
    const { rendered, lineMap } = preserveBlankLines('a\n\n\n- [ ] x');
    expect(rendered.split('\n')).toEqual(['a', '', '​', '', '- [ ] x']);
    expect(lineMap[4]).toBe(3); // the task line still points at source line 3
  });
});

describe('toggleTaskLine', () => {
  it('checks an open task', () => {
    expect(toggleTaskLine('a\n- [ ] x', 1)).toEqual({ source: 'a\n- [x] x', checked: true });
  });

  it('unchecks a done task (either case)', () => {
    expect(toggleTaskLine('- [X] x', 0)).toEqual({ source: '- [ ] x', checked: false });
  });

  it('returns null for a line without a checkbox or out of range', () => {
    expect(toggleTaskLine('plain', 0)).toBeNull();
    expect(toggleTaskLine('plain', 5)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/utils/markdown.test.ts`
Expected: FAIL. Cannot find module `./markdown`.

- [ ] **Step 3: Implement the helpers**

`src/utils/markdown.ts` (the blank-line logic is moved verbatim from `ObjectiveDetails.tsx`):

```ts
// Markdown collapses multiple blank lines into one paragraph break. Each extra blank line
// becomes a zero-width-space line so the spacing typed in the editor survives in the preview.
// lineMap[renderedLine] = source line, so task toggles target the right line in the source.
export function preserveBlankLines(source: string): { rendered: string; lineMap: number[] } {
  const originalLines = source.split('\n');
  const resultLines: string[] = [];
  const map: number[] = [];
  for (let i = 0; i < originalLines.length; i++) {
    resultLines.push(originalLines[i]);
    map.push(i);
    if (originalLines[i] === '' && i > 0 && i < originalLines.length - 1) {
      let consecutive = 0;
      let j = i + 1;
      while (j < originalLines.length && originalLines[j] === '') {
        consecutive++;
        j++;
      }
      for (let k = 0; k < consecutive; k++) {
        resultLines.push('​');
        map.push(i + 1 + k);
      }
    }
  }
  return { rendered: resultLines.join('\n'), lineMap: map };
}

// Flips the task checkbox on a source line. Returns null if that line has no checkbox.
export function toggleTaskLine(source: string, lineIndex: number): { source: string; checked: boolean } | null {
  const lines = source.split('\n');
  const line = lines[lineIndex];
  if (!line) return null;
  if (/\[ \]/.test(line)) {
    lines[lineIndex] = line.replace('[ ]', '[x]');
    return { source: lines.join('\n'), checked: true };
  }
  if (/\[x\]/i.test(line)) {
    lines[lineIndex] = line.replace(/\[x\]/i, '[ ]');
    return { source: lines.join('\n'), checked: false };
  }
  return null;
}
```

Run: `npx vitest run src/utils/markdown.test.ts`. Expected: PASS. (If the second `preserveBlankLines` expectation fails, the moved code was changed; it must match the original loop exactly. Fix the code, not the test.)

- [ ] **Step 4: Write the failing component tests**

`src/components/MarkdownView.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarkdownView } from './MarkdownView';

vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn() }));
vi.mock('../utils/audio', () => ({
  soundEngine: { playCheckboxUncheck: vi.fn() },
  playCheckboxCheckWithFile: vi.fn(),
}));

const TABLE = '| Name | Qty |\n| :--- | ---: |\n| Apple | 3 |\n| Pear | 10 |';

describe('MarkdownView', () => {
  it('renders a GFM table with header and body cells', () => {
    const { container } = render(<MarkdownView source={TABLE} />);
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Pear' })).toBeInTheDocument();
    // Wrapped so wide tables scroll horizontally instead of overflowing
    expect(table!.parentElement!.tagName).toBe('DIV');
    expect(table!.parentElement).not.toBe(container.firstChild);
  });

  it('applies column alignment', () => {
    render(<MarkdownView source={TABLE} />);
    expect(screen.getByRole('cell', { name: '10' }).style.textAlign).toBe('right');
  });

  it('toggling a task after extra blank lines changes the right source line', () => {
    const onChange = vi.fn();
    render(<MarkdownView source={'a\n\n\n- [ ] task'} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith('a\n\n\n- [x] task');
  });

  it('is read-only without onChange', () => {
    render(<MarkdownView source={'- [ ] task'} />);
    expect(() => fireEvent.click(screen.getByRole('checkbox'))).not.toThrow();
  });
});
```

Run: `npx vitest run src/components/MarkdownView.test.tsx`
Expected: FAIL. Cannot find module `./MarkdownView`.

- [ ] **Step 5: Implement `MarkdownView`**

`src/components/MarkdownView.tsx` (the remark plugin, contexts, `TaskListItem`, `TaskCheckbox` and `ExternalLink` are moved verbatim from `ObjectiveDetails.tsx`, lines 12-73):

```tsx
import { type FC, useCallback, useMemo, createContext, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { open } from '@tauri-apps/plugin-shell';
import styles from './MarkdownView.module.scss';
import { soundEngine, playCheckboxCheckWithFile } from '../utils/audio';
import { preserveBlankLines, toggleTaskLine } from '../utils/markdown';

// ─── Remark plugin: embed 0-indexed source line on each task list item ──────────
// This runs on the MDAST after remark-gfm has set node.checked,
// and adds data-src-line to hProperties so react-markdown passes it as a prop.
function remarkTaskLineIndex() {
  return (tree: any) => {
    function walk(node: any) {
      if (node.type === 'listItem' && node.checked !== null && node.checked !== undefined && node.position) {
        const lineIndex = node.position.start.line - 1; // remark is 1-indexed
        node.data = node.data ?? {};
        node.data.hProperties = { ...(node.data.hProperties ?? {}), 'data-src-line': lineIndex };
      }
      if (Array.isArray(node.children)) node.children.forEach(walk);
    }
    walk(tree);
  };
}

// Stable remark plugin list — defined outside component so reference never changes
const REMARK_PLUGINS = [remarkGfm, remarkBreaks, remarkTaskLineIndex];

// ─── Contexts ────────────────────────────────────────────────────────────────────
// LineIndexContext: li component sets this for its children to read
const LineIndexContext = createContext<number>(-1);
// ToggleContext: provides the checkbox toggle to TaskCheckbox without prop drilling
type ToggleFn = (lineIndex: number) => void;
const ToggleContext = createContext<ToggleFn>(() => {});

// ─── Stable markdown component overrides (defined outside, never recreated) ─────
const TaskListItem: FC<any> = ({ node, 'data-src-line': srcLine, children, ...props }) => {
  const lineIndex = srcLine !== undefined ? Number(srcLine) : -1;
  return (
    <LineIndexContext.Provider value={lineIndex}>
      <li {...props}>{children}</li>
    </LineIndexContext.Provider>
  );
};

const TaskCheckbox: FC<any> = ({ node, ...props }) => {
  const lineIndex = useContext(LineIndexContext);
  const toggle = useContext(ToggleContext);
  if (props.type !== 'checkbox') return <input {...props} />;
  return (
    <input
      type="checkbox"
      checked={!!props.checked}
      onChange={() => lineIndex >= 0 && toggle(lineIndex)}
      className={styles.checkbox}
    />
  );
};

const ExternalLink: FC<any> = ({ href, children, ...props }) => (
  <a
    {...props}
    href={href}
    onClick={(e) => { e.preventDefault(); if (href) open(href); }}
  >
    {children}
  </a>
);

// Wide tables scroll sideways inside their own box instead of stretching the container
const ScrollTable: FC<any> = ({ node, ...props }) => (
  <div className={styles.tableWrap}>
    <table {...props} />
  </div>
);

// Single stable components object — ReactMarkdown won't remount on every render
const MARKDOWN_COMPONENTS = { li: TaskListItem, input: TaskCheckbox, a: ExternalLink, table: ScrollTable };

export interface MarkdownViewProps {
  source: string;
  // Called with the new source when a task checkbox is toggled; omit for read-only
  onChange?: (next: string) => void;
  className?: string;
}

export const MarkdownView: FC<MarkdownViewProps> = ({ source, onChange, className }) => {
  const { rendered, lineMap } = useMemo(() => preserveBlankLines(source), [source]);

  const handleToggle = useCallback((renderedLineIndex: number) => {
    if (!onChange) return;
    const result = toggleTaskLine(source, lineMap[renderedLineIndex] ?? renderedLineIndex);
    if (!result) return;
    if (result.checked) playCheckboxCheckWithFile();
    else soundEngine.playCheckboxUncheck();
    onChange(result.source);
  }, [source, lineMap, onChange]);

  return (
    <ToggleContext.Provider value={handleToggle}>
      <div className={`${styles.markdown} ${className ?? ''}`}>
        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
          {rendered}
        </ReactMarkdown>
      </div>
    </ToggleContext.Provider>
  );
};
```

`src/components/MarkdownView.module.scss`: copy the `.markdown { ... }` block from `ObjectiveDetails.module.scss` (it starts at `.markdown {` and ends before `.checkbox`), **dropping only its first two declarations `flex: 1;` and `overflow-y: auto;`** (layout belongs to the caller). Copy the `.checkbox` block as well. Then add the table rules inside `.markdown { ... }`, after the `hr` rule:

```scss
  .tableWrap {
    overflow-x: auto;
    margin: 0.4rem 0;
  }

  table {
    border-collapse: collapse;
    min-width: 100%;
    font-size: 0.95em;
  }

  th,
  td {
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 0.25rem 0.5rem;
    vertical-align: top;
  }

  th {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.9);
    font-weight: 700;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  tbody tr:nth-child(even) td {
    background: rgba(255, 255, 255, 0.03);
  }
```

(Alignment needs no CSS: react-markdown emits `style="text-align: …"` on cells from `:---:` / `---:`. If the alignment test shows the cells carry an `align` attribute instead, add `th, td { &[align='center'] { text-align: center; } &[align='right'] { text-align: right; } }` inside `.markdown` and change that test to assert `getAttribute('align')`.)

- [ ] **Step 6: Run to verify the tests pass**

Run: `npx vitest run src/utils/markdown.test.ts src/components/MarkdownView.test.tsx`
Expected: PASS.

- [ ] **Step 7: Lint and commit**

`MarkdownView.tsx` carries over the `any` types from `ObjectiveDetails.tsx`, which already fail `no-explicit-any`. When you run `npx eslint src/components/MarkdownView.tsx src/utils/markdown.ts`, the only errors allowed are those `no-explicit-any` ones. Task 4 removes them from `ObjectiveDetails.tsx`, so the repo total doesn't grow.

```bash
git add src/utils/markdown.ts src/utils/markdown.test.ts src/components/MarkdownView.tsx src/components/MarkdownView.module.scss src/components/MarkdownView.test.tsx
git commit -m "feat: shared MarkdownView with styled, scrollable tables"
```

---

### Task 4: `useMarkdownEditor`, `MarkdownToolbar`, and `ObjectiveDetails` rebuilt on them

**Files:**
- Create: `src/hooks/useMarkdownEditor.ts`, `src/hooks/useMarkdownEditor.test.tsx`
- Create: `src/components/MarkdownToolbar.tsx`, `src/components/MarkdownToolbar.module.scss`
- Modify: `src/components/ObjectiveDetails.tsx`, `src/components/ObjectiveDetails.module.scss`

**Interfaces:**
- Consumes: `MarkdownView` (Task 3).
- Produces:
  ```ts
  // hooks/useMarkdownEditor.ts
  export interface MarkdownEditorOptions {
    initialText?: string;   // initial textarea value (default '')
    onSave: () => void;     // Esc
    onCancel: () => void;   // Shift+Esc
  }
  export function useMarkdownEditor(options: MarkdownEditorOptions): {
    text: string;
    setText: (text: string) => void;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    wrapSelection: (before: string, after: string) => void;
    insertTemplate: (template: string) => void;
    insertLink: () => void;
    handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  };
  export type MarkdownEditor = ReturnType<typeof useMarkdownEditor>;
  // components/MarkdownToolbar.tsx
  export const TABLE_TEMPLATE: string;
  export const MarkdownToolbar: FC<{ editor: Pick<MarkdownEditor, 'wrapSelection' | 'insertTemplate' | 'insertLink'>; compact?: boolean }>;
  ```

- [ ] **Step 1: Write the failing tests**

`src/hooks/useMarkdownEditor.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useMarkdownEditor, type MarkdownEditor } from './useMarkdownEditor';
import { MarkdownToolbar, TABLE_TEMPLATE } from '../components/MarkdownToolbar';

vi.mock('../utils/audio', () => ({ soundEngine: { playClick: vi.fn() } }));

function Harness({ initialText = '', onSave = vi.fn(), onCancel = vi.fn() }: { initialText?: string; onSave?: (t: string) => void; onCancel?: () => void }) {
  // Annotated: the initializer refers to `editor` (TS7022 otherwise)
  const editor: MarkdownEditor = useMarkdownEditor({ initialText, onSave: () => { onSave(editor.text); }, onCancel });
  return (
    <>
      <textarea
        data-testid="ta"
        ref={editor.textareaRef}
        value={editor.text}
        onChange={e => editor.setText(e.target.value)}
        onKeyDown={editor.handleKeyDown}
        onPaste={editor.handlePaste}
      />
      <MarkdownToolbar editor={editor} />
    </>
  );
}

const ta = () => screen.getByTestId('ta') as HTMLTextAreaElement;

describe('useMarkdownEditor', () => {
  it('starts with initialText', () => {
    render(<Harness initialText="hello" />);
    expect(ta().value).toBe('hello');
  });

  it('Escape saves with the current text', () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    fireEvent.change(ta(), { target: { value: 'typed' } });
    fireEvent.keyDown(ta(), { key: 'Escape' });
    expect(onSave).toHaveBeenCalledWith('typed');
  });

  it('Shift+Escape cancels', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<Harness onSave={onSave} onCancel={onCancel} />);
    fireEvent.keyDown(ta(), { key: 'Escape', shiftKey: true });
    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Ctrl+B wraps the selection, and again unwraps it', () => {
    render(<Harness initialText="hello" />);
    ta().setSelectionRange(0, 5);
    fireEvent.keyDown(ta(), { key: 'b', ctrlKey: true });
    expect(ta().value).toBe('**hello**');
    ta().setSelectionRange(2, 7);
    fireEvent.keyDown(ta(), { key: 'b', ctrlKey: true });
    expect(ta().value).toBe('hello');
  });

  it('the Table button inserts the table template on a new line', () => {
    render(<Harness initialText="intro" />);
    ta().setSelectionRange(5, 5);
    fireEvent.click(screen.getByTitle('Table'));
    expect(ta().value).toBe('intro\n' + TABLE_TEMPLATE);
  });

  it('pasting a URL over a selection makes a link', () => {
    render(<Harness initialText="docs" />);
    ta().setSelectionRange(0, 4);
    fireEvent.paste(ta(), { clipboardData: { getData: () => 'https://example.com' } });
    expect(ta().value).toBe('[docs](https://example.com)');
  });
});
```

Run: `npx vitest run src/hooks/useMarkdownEditor.test.tsx`
Expected: FAIL. Cannot find module `./useMarkdownEditor`.

- [ ] **Step 2: Implement `useMarkdownEditor`**

`src/hooks/useMarkdownEditor.ts`. The helper bodies are moved from `ObjectiveDetails.tsx`, with `editText`→`text`, `setEditText`→`setText`, `handleSave()`→`onSave()` and `handleCancel()`→`onCancel()`:

```ts
import { useState, useRef, useCallback } from 'react';
import { soundEngine } from '../utils/audio';

export interface MarkdownEditorOptions {
  initialText?: string;
  onSave: () => void;   // Esc
  onCancel: () => void; // Shift+Esc
}

// Text state and editing helpers for a markdown textarea: toolbar actions, Ctrl shortcuts,
// line duplicate/move, Esc to save / Shift+Esc to cancel, and auto-link on paste.
export function useMarkdownEditor({ initialText = '', onSave, onCancel }: MarkdownEditorOptions) {
  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = useCallback((before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    soundEngine.playClick();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = text.slice(start, end);

    const markerBefore = text.slice(start - before.length, start);
    const markerAfter = text.slice(end, end + after.length);
    if (selected && markerBefore === before && markerAfter === after) {
      const newText = text.slice(0, start - before.length) + selected + text.slice(end + after.length);
      setText(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start - before.length, start - before.length + selected.length);
      }, 0);
      return;
    }

    const inner = selected || 'text';
    const newText = text.slice(0, start) + before + inner + after + text.slice(end);
    setText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + inner.length);
    }, 0);
  }, [text]);

  const insertLink = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    soundEngine.playClick();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = text.slice(start, end);
    const linkText = selected || 'link text';
    const insertion = `[${linkText}](url)`;
    setText(text.slice(0, start) + insertion + text.slice(end));
    const urlStart = start + linkText.length + 3;
    const urlEnd = urlStart + 3;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(urlStart, urlEnd);
    }, 0);
  }, [text]);

  const insertTemplate = useCallback((template: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    soundEngine.playClick();
    const pos = textarea.selectionStart;
    // If cursor is not at the start of a line, prepend a newline
    const charBefore = pos > 0 ? text[pos - 1] : '\n';
    const prefix = charBefore !== '\n' ? '\n' : '';
    const insertion = prefix + template;
    setText(text.slice(0, pos) + insertion + text.slice(pos));
    const newCursor = pos + insertion.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursor, newCursor);
    }, 0);
  }, [text]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (e.shiftKey) {
        onCancel();
      } else {
        onSave();
      }
      return;
    }
    if (!e.ctrlKey) return;
    if (e.key === 'b' || e.key === 'B') { e.preventDefault(); wrapSelection('**', '**'); return; }
    if (e.key === 'i' || e.key === 'I') { e.preventDefault(); wrapSelection('_', '_'); return; }
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); wrapSelection('~~', '~~'); return; }
    if (e.key === '1') { e.preventDefault(); insertTemplate('# '); return; }
    if (e.key === '2') { e.preventDefault(); insertTemplate('## '); return; }
    if (e.key === '3') { e.preventDefault(); insertTemplate('### '); return; }
    if (e.key === 'l' || e.key === 'L') { e.preventDefault(); insertTemplate('- '); return; }
    if (e.key === 't' || e.key === 'T') { e.preventDefault(); insertTemplate('- [ ] '); return; }
    if (e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      soundEngine.playClick();
      const textarea = e.currentTarget;
      const pos = textarea.selectionStart;
      const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
      const lineEndIdx = text.indexOf('\n', pos);
      const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
      const currentLine = text.slice(lineStart, lineEnd);
      setText(text.slice(0, lineEnd) + '\n' + currentLine + text.slice(lineEnd));
      const newPos = lineEnd + 1 + (pos - lineStart);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const textarea = e.currentTarget;
      const pos = textarea.selectionStart;
      const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
      const lineEndIdx = text.indexOf('\n', pos);
      const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
      const currentLine = text.slice(lineStart, lineEnd);
      const offsetInLine = pos - lineStart;

      if (e.key === 'ArrowUp' && lineStart > 0) {
        e.preventDefault();
        soundEngine.playClick();
        const prevLineEnd = lineStart - 1;
        const prevLineStart = text.lastIndexOf('\n', prevLineEnd - 1) + 1;
        const prevLine = text.slice(prevLineStart, prevLineEnd);
        setText(text.slice(0, prevLineStart) + currentLine + '\n' + prevLine + text.slice(lineEnd));
        const newPos = prevLineStart + Math.min(offsetInLine, currentLine.length);
        setTimeout(() => { textarea.focus(); textarea.setSelectionRange(newPos, newPos); }, 0);
      } else if (e.key === 'ArrowDown' && lineEndIdx !== -1) {
        e.preventDefault();
        soundEngine.playClick();
        const nextLineStart = lineEnd + 1;
        const nextLineEndIdx = text.indexOf('\n', nextLineStart);
        const nextLineEnd = nextLineEndIdx === -1 ? text.length : nextLineEndIdx;
        const nextLine = text.slice(nextLineStart, nextLineEnd);
        setText(text.slice(0, lineStart) + nextLine + '\n' + currentLine + text.slice(nextLineEnd));
        const newPos = lineStart + nextLine.length + 1 + Math.min(offsetInLine, currentLine.length);
        setTimeout(() => { textarea.focus(); textarea.setSelectionRange(newPos, newPos); }, 0);
      }
    }
  };

  // Pasting a URL over a selection turns the selection into a link
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text/plain').trim();
    if (!/^https?:\/\/\S+$/.test(pasted)) return;
    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) return;
    e.preventDefault();
    const replacement = `[${text.slice(start, end)}](${pasted})`;
    setText(text.slice(0, start) + replacement + text.slice(end));
    const newEnd = start + replacement.length;
    setTimeout(() => { textarea.focus(); textarea.setSelectionRange(newEnd, newEnd); }, 0);
  }, [text]);

  return { text, setText, textareaRef, wrapSelection, insertTemplate, insertLink, handleKeyDown, handlePaste };
}

export type MarkdownEditor = ReturnType<typeof useMarkdownEditor>;
```

- [ ] **Step 3: Implement `MarkdownToolbar`**

`src/components/MarkdownToolbar.tsx`:

```tsx
import type { FC } from 'react';
import { Heading1, Heading2, Heading3, Bold, Italic, Strikethrough, List, ListChecks, Link2, Table } from 'lucide-react';
import styles from './MarkdownToolbar.module.scss';
import type { MarkdownEditor } from '../hooks/useMarkdownEditor';

export const TABLE_TEMPLATE =
  '| Col 1       | Col 2       | Col 3       |\n' +
  '| :---        |    :---:    |        ---: |\n' +
  '| Cell        | Cell        | Cell        |\n' +
  '| Cell        | Cell        | Cell        |';

interface MarkdownToolbarProps {
  editor: Pick<MarkdownEditor, 'wrapSelection' | 'insertTemplate' | 'insertLink'>;
  compact?: boolean; // smaller icons and padding (canvas notes)
}

export const MarkdownToolbar: FC<MarkdownToolbarProps> = ({ editor, compact = false }) => {
  const { wrapSelection, insertTemplate, insertLink } = editor;
  const size = compact ? 11 : 13;
  return (
    <div className={`${styles.toolbar} ${compact ? styles.compact : ''}`}>
      <div className={styles.toolbarGroup}>
        <button className={styles.toolBtn} onClick={() => insertTemplate('# ')} title="Heading 1"><Heading1 size={size} /></button>
        <button className={styles.toolBtn} onClick={() => insertTemplate('## ')} title="Heading 2"><Heading2 size={size} /></button>
        <button className={styles.toolBtn} onClick={() => insertTemplate('### ')} title="Heading 3"><Heading3 size={size} /></button>
      </div>
      <div className={styles.toolbarDivider} />
      <div className={styles.toolbarGroup}>
        <button className={styles.toolBtn} onClick={() => wrapSelection('**', '**')} title="Bold (Ctrl+B)"><Bold size={size} /></button>
        <button className={styles.toolBtn} onClick={() => wrapSelection('_', '_')} title="Italic (Ctrl+I)"><Italic size={size} /></button>
        <button className={styles.toolBtn} onClick={() => wrapSelection('~~', '~~')} title="Strikethrough (Ctrl+S)"><Strikethrough size={size} /></button>
      </div>
      <div className={styles.toolbarDivider} />
      <div className={styles.toolbarGroup}>
        <button className={styles.toolBtn} onClick={() => insertTemplate('- Item 1\n- Item 2\n- Item 3')} title="Bullet list"><List size={size} /></button>
        <button className={styles.toolBtn} onClick={() => insertTemplate('- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3')} title="Task list"><ListChecks size={size} /></button>
        <button className={styles.toolBtn} onClick={insertLink} title="Insert link"><Link2 size={size} /></button>
        <button className={styles.toolBtn} onClick={() => insertTemplate(TABLE_TEMPLATE)} title="Table"><Table size={size} /></button>
      </div>
    </div>
  );
};
```

`src/components/MarkdownToolbar.module.scss`: move the `.toolbar`, `.toolbarGroup`, `.toolbarDivider` and `.toolBtn` blocks verbatim from `ObjectiveDetails.module.scss` (drop the unused `.toolbarHint`), then append:

```scss
.compact {
  flex-wrap: wrap;
  gap: 0.1rem;
  padding: 0.2rem 0.25rem;

  .toolBtn {
    padding: 0.15rem 0.25rem;
  }

  .toolbarDivider {
    margin: 0 0.1rem;
  }
}
```

Run: `npx vitest run src/hooks/useMarkdownEditor.test.tsx`
Expected: PASS.

- [ ] **Step 4: Rebuild `ObjectiveDetails` on the shared pieces**

Replace the whole of `src/components/ObjectiveDetails.tsx` with:

```tsx
import { type FC, useState, useEffect, useRef, useCallback } from 'react';
import styles from './ObjectiveDetails.module.scss';
import { Edit3, Check, X } from 'lucide-react';
import { useFocus } from '../contexts/FocusContext';
import { soundEngine } from '../utils/audio';
import { useMarkdownEditor } from '../hooks/useMarkdownEditor';
import { BucketTag } from './BucketTag';
import { MarkdownView } from './MarkdownView';
import { MarkdownToolbar } from './MarkdownToolbar';

interface Props {
  onClose: () => void;
}

export const ObjectiveDetails: FC<Props> = ({ onClose }) => {
  const { viewedObjectiveId, objectivePool, buckets, updateObjectiveDetails } = useFocus();
  const activeObjective = objectivePool.find(o => o.id === viewedObjectiveId) ?? null;
  const activeBucket = activeObjective ? buckets.find(b => b.id === activeObjective.bucket_id) : undefined;

  const [isEditing, setIsEditing] = useState(false);
  const asideRef = useRef<HTMLElement>(null);

  const handleSave = () => {
    if (!activeObjective) return;
    soundEngine.playClick();
    updateObjectiveDetails(activeObjective.id, editor.text.trim() || null);
    setIsEditing(false);
  };

  const handleCancel = () => {
    soundEngine.playClick();
    setIsEditing(false);
  };

  const editor = useMarkdownEditor({ onSave: handleSave, onCancel: handleCancel });
  const { setText, textareaRef } = editor;

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (asideRef.current?.contains(e.target as Node)) return;
      const target = e.target as Element;
      if (target.closest('[data-details-barrier], button, input, select, a, textarea, [role="button"]')) return;
      onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  useEffect(() => {
    if (!viewedObjectiveId) {
      onClose();
    }
  }, [viewedObjectiveId, onClose]);

  useEffect(() => {
    setIsEditing(false);
  }, [viewedObjectiveId]);

  // Enter in preview mode → enter edit mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditing) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        soundEngine.playEditStart();
        setIsEditing(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing]);

  useEffect(() => {
    if (isEditing) {
      setText(activeObjective?.details ?? '');
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [isEditing, activeObjective?.details, setText, textareaRef]);

  const handleEdit = () => {
    soundEngine.playEditStart();
    setIsEditing(true);
  };

  const handleDetailsChange = useCallback((next: string) => {
    if (activeObjective) updateObjectiveDetails(activeObjective.id, next);
  }, [activeObjective, updateObjectiveDetails]);

  const details = activeObjective?.details ?? null;

  return (
    <aside className={styles.sidebar} ref={asideRef as any}>
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <h4>{activeObjective?.text ?? 'OBJECTIVE_DETAILS'}</h4>
            {activeBucket && <BucketTag bucket={activeBucket} className={styles.bucketTag} />}
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close (Esc)">
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          {isEditing ? (
            <div className={styles.editContainer}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                value={editor.text}
                onChange={e => setText(e.target.value)}
                onKeyDown={editor.handleKeyDown}
                onPaste={editor.handlePaste}
                placeholder={'Write notes, tasks, links...\n\nUse - [ ] for checkboxes\nUse **bold** or *italic*\nUse [text](url) for links'}
                spellCheck={false}
              />
              <MarkdownToolbar editor={editor} />
              <div className={styles.editActions}>
                <button className={styles.saveBtn} onClick={handleSave}>
                  <Check size={12} /> SAVE
                </button>
                <button className={styles.cancelBtn} onClick={handleCancel}>
                  <X size={12} /> CANCEL
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.previewContainer} onDoubleClick={handleEdit}>
              {details ? (
                <MarkdownView source={details} onChange={handleDetailsChange} className={styles.markdownScroll} />
              ) : (
                <div className={styles.empty}>No details. Click EDIT to add details.</div>
              )}
              <button className={styles.editBtn} onClick={handleEdit}>
                <Edit3 size={12} /> EDIT
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
```

In `src/components/ObjectiveDetails.module.scss`: delete `.toolbar`, `.toolbarGroup`, `.toolbarDivider`, `.toolbarHint`, `.toolBtn`, `.markdown { … }` (the whole block) and `.checkbox`. Keep `.checked` only if something else uses it (`grep -rn "styles.checked" src`; if nothing does, delete it too). Add:

```scss
.markdownScroll {
  flex: 1;
  overflow-y: auto;
}
```

- [ ] **Step 5: Run the full suite, typecheck and lint**

```bash
npm test
npx tsc -b
npx eslint src/hooks/useMarkdownEditor.ts src/components/MarkdownToolbar.tsx src/components/ObjectiveDetails.tsx
```
Expected: all tests pass, tsc clean. ESLint may report only `asideRef as any` in `ObjectiveDetails.tsx` (it was there before).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useMarkdownEditor.ts src/hooks/useMarkdownEditor.test.tsx src/components/MarkdownToolbar.tsx src/components/MarkdownToolbar.module.scss src/components/ObjectiveDetails.tsx src/components/ObjectiveDetails.module.scss
git commit -m "refactor: share markdown editor and toolbar; details pane uses MarkdownView"
```

---

### Task 5: `canvas_notes` table and DB functions

**Files:**
- Modify: `src/types/index.ts` (after `Bucket`, line ~79)
- Modify: `src/db.ts` (schema after the `buckets` CREATE at line ~80; functions after the Buckets section, before `moveObjectiveToBucket`)
- Test: `src/db.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // types
  export interface CanvasNote extends BucketGeometry { id: number; content: string; color: string; sort_order: number; }
  // db.ts
  export async function getCanvasNotes(userId: number): Promise<CanvasNote[]>; // ORDER BY sort_order, id
  export async function addCanvasNote(userId: number, color: string, geometry: BucketGeometry): Promise<number>; // sort_order = max + 1
  export async function updateCanvasNoteContent(id: number, content: string): Promise<void>;
  export async function updateCanvasNoteColor(id: number, color: string): Promise<void>;
  export async function updateCanvasNoteGeometry(id: number, geometry: BucketGeometry): Promise<void>;
  export async function bringCanvasNoteToFront(id: number): Promise<void>;
  export async function deleteCanvasNote(id: number): Promise<void>;
  ```

- [ ] **Step 1: Write the failing tests**

In `src/db.test.ts`, add `getCanvasNotes, addCanvasNote, updateCanvasNoteContent, updateCanvasNoteGeometry, bringCanvasNoteToFront, deleteCanvasNote` to the import from `./db` (line 15), and add this block after `describe('Bucket Methods', …)`:

```ts
  describe('Canvas Note Methods', () => {
    it('getCanvasNotes maps rows to CanvasNote objects in stacking order', async () => {
      mockExecute.mockResolvedValueOnce({
        rows: [{ id: 3, user_id: 7, content: '# Hi', color: '#ffcc33', x: 10, y: -20, w: 260, h: 200, sort_order: 2, created_at: 'x' }],
      });
      const notes = await getCanvasNotes(7);
      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringMatching(/FROM canvas_notes WHERE user_id = \? ORDER BY sort_order ASC, id ASC/),
        args: [7],
      });
      expect(notes).toEqual([{ id: 3, content: '# Hi', color: '#ffcc33', x: 10, y: -20, w: 260, h: 200, sort_order: 2 }]);
    });

    it('addCanvasNote inserts an empty note on top of the user\'s notes', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [{ maxOrder: 4 }] })
        .mockResolvedValueOnce({ rows: [], lastInsertRowid: BigInt(12) });
      const id = await addCanvasNote(7, '#ffcc33', { x: 1, y: 2, w: 260, h: 200 });
      expect(id).toBe(12);
      expect(mockExecute).toHaveBeenLastCalledWith({
        sql: expect.stringContaining('INSERT INTO canvas_notes'),
        args: [7, '', '#ffcc33', 1, 2, 260, 200, 5],
      });
    });

    it('addCanvasNote starts at sort_order 0 for the first note', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [{ maxOrder: null }] })
        .mockResolvedValueOnce({ rows: [], lastInsertRowid: BigInt(1) });
      await addCanvasNote(7, '#ffcc33', { x: 0, y: 0, w: 260, h: 200 });
      expect(mockExecute.mock.lastCall?.[0].args[7]).toBe(0);
    });

    it('updateCanvasNoteContent and updateCanvasNoteGeometry update by id', async () => {
      mockExecute.mockResolvedValue({ rows: [], rowsAffected: 1 });
      await updateCanvasNoteContent(3, 'text');
      expect(mockExecute).toHaveBeenCalledWith({ sql: 'UPDATE canvas_notes SET content = ? WHERE id = ?', args: ['text', 3] });
      await updateCanvasNoteGeometry(3, { x: 1, y: 2, w: 3, h: 4 });
      expect(mockExecute).toHaveBeenCalledWith({ sql: 'UPDATE canvas_notes SET x = ?, y = ?, w = ?, h = ? WHERE id = ?', args: [1, 2, 3, 4, 3] });
    });

    it('bringCanvasNoteToFront uses the max sort_order of the same user\'s notes', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 });
      await bringCanvasNoteToFront(3);
      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringMatching(/UPDATE canvas_notes SET sort_order = \(SELECT COALESCE\(MAX\(sort_order\), 0\) \+ 1 FROM canvas_notes WHERE user_id = \(SELECT user_id FROM canvas_notes WHERE id = \?\)\) WHERE id = \?/),
        args: [3, 3],
      });
    });

    it('deleteCanvasNote deletes by id', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 });
      await deleteCanvasNote(3);
      expect(mockExecute).toHaveBeenCalledWith({ sql: 'DELETE FROM canvas_notes WHERE id = ?', args: [3] });
    });
  });
```

Run: `npx vitest run src/db.test.ts`
Expected: FAIL. The functions aren't exported.

- [ ] **Step 2: Add the type**

In `src/types/index.ts`, after the `Bucket` interface:

```ts
// A sticky note on the Buckets canvas; geometry is in world units like buckets
export interface CanvasNote extends BucketGeometry {
  id: number;
  content: string; // markdown
  color: string;
  sort_order: number; // stacking among notes (higher = in front); notes are always above buckets
}
```

- [ ] **Step 3: Add the schema and functions**

In `src/db.ts`, add `CanvasNote` to the type import on line 2. In `initDb`, right after the `buckets` `CREATE TABLE` statement:

```ts
  await database.execute(`
    CREATE TABLE IF NOT EXISTS canvas_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL,
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      w REAL NOT NULL DEFAULT 260,
      h REAL NOT NULL DEFAULT 200,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
```

After `deleteBucket` (and before `moveObjectiveToBucket`), add:

```ts
// ─── Canvas notes ────────────────────────────────────────────────

export async function getCanvasNotes(userId: number): Promise<CanvasNote[]> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM canvas_notes WHERE user_id = ? ORDER BY sort_order ASC, id ASC',
    args: [userId],
  });
  return result.rows.map(row => ({
    id: Number(row.id),
    content: (row.content as string | null) ?? '',
    color: row.color as string,
    x: Number(row.x),
    y: Number(row.y),
    w: Number(row.w),
    h: Number(row.h),
    sort_order: Number(row.sort_order),
  }));
}

// New notes start empty, on top of the user's other notes
export async function addCanvasNote(userId: number, color: string, geometry: BucketGeometry): Promise<number> {
  const database = getDb();
  const maxResult = await database.execute({
    sql: 'SELECT MAX(sort_order) as maxOrder FROM canvas_notes WHERE user_id = ?',
    args: [userId],
  });
  const maxOrder = (maxResult.rows[0]?.maxOrder as number | null) ?? -1;
  const result = await database.execute({
    sql: 'INSERT INTO canvas_notes (user_id, content, color, x, y, w, h, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [userId, '', color, geometry.x, geometry.y, geometry.w, geometry.h, maxOrder + 1],
  });
  return Number(result.lastInsertRowid);
}

export async function updateCanvasNoteContent(id: number, content: string): Promise<void> {
  const database = getDb();
  await database.execute({ sql: 'UPDATE canvas_notes SET content = ? WHERE id = ?', args: [content, id] });
}

export async function updateCanvasNoteColor(id: number, color: string): Promise<void> {
  const database = getDb();
  await database.execute({ sql: 'UPDATE canvas_notes SET color = ? WHERE id = ?', args: [color, id] });
}

export async function updateCanvasNoteGeometry(id: number, geometry: BucketGeometry): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE canvas_notes SET x = ?, y = ?, w = ?, h = ? WHERE id = ?',
    args: [geometry.x, geometry.y, geometry.w, geometry.h, id],
  });
}

// Gives the note the highest sort_order among its user's notes, which puts it in front of the other notes
export async function bringCanvasNoteToFront(id: number): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE canvas_notes SET sort_order = (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM canvas_notes WHERE user_id = (SELECT user_id FROM canvas_notes WHERE id = ?)) WHERE id = ?',
    args: [id, id],
  });
}

export async function deleteCanvasNote(id: number): Promise<void> {
  const database = getDb();
  await database.execute({ sql: 'DELETE FROM canvas_notes WHERE id = ?', args: [id] });
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/db.test.ts`
Expected: PASS. If an existing `initDb` test asserts an exact number of `execute` calls, bump it by one for the new `CREATE TABLE`.

- [ ] **Step 5: Commit**

```bash
npx tsc -b
git add src/types/index.ts src/db.ts src/db.test.ts
git commit -m "feat: canvas_notes table and DB functions"
```

---

### Task 6: `useCanvasNotes` hook

**Files:**
- Create: `src/hooks/useCanvasNotes.ts`, `src/hooks/useCanvasNotes.test.ts`

**Interfaces:**
- Consumes: the DB functions from Task 5; `useAuth()` from `../contexts/AuthContext` (`authUser: AuthUser | null`, `authUser.id: number`).
- Produces:
  ```ts
  export function useCanvasNotes(): {
    notes: CanvasNote[];
    addNote: (color: string, geometry: BucketGeometry) => Promise<number | null>; // id, or null if signed out / failed
    updateContent: (id: number, content: string) => Promise<void>;
    updateColor: (id: number, color: string) => Promise<void>;
    updateGeometry: (id: number, geometry: BucketGeometry) => Promise<void>;
    bringToFront: (id: number) => Promise<void>;
    deleteNote: (id: number) => Promise<void>;
  };
  export type CanvasNotesApi = ReturnType<typeof useCanvasNotes>;
  ```

- [ ] **Step 1: Write the failing tests**

`src/hooks/useCanvasNotes.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { CanvasNote } from '../types';

const db = vi.hoisted(() => ({
  getCanvasNotes: vi.fn(),
  addCanvasNote: vi.fn(),
  updateCanvasNoteContent: vi.fn(),
  updateCanvasNoteColor: vi.fn(),
  updateCanvasNoteGeometry: vi.fn(),
  bringCanvasNoteToFront: vi.fn(),
  deleteCanvasNote: vi.fn(),
}));
vi.mock('../db', () => db);

let mockAuthUser: { id: number } | null = { id: 7 };
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ authUser: mockAuthUser }) }));

import { useCanvasNotes } from './useCanvasNotes';

const NOTE: CanvasNote = { id: 1, content: 'hi', color: '#ffcc33', x: 0, y: 0, w: 260, h: 200, sort_order: 0 };
const NOTE2: CanvasNote = { ...NOTE, id: 2, sort_order: 3 };

describe('useCanvasNotes', () => {
  beforeEach(() => {
    Object.values(db).forEach(f => f.mockReset());
    db.getCanvasNotes.mockResolvedValue([NOTE, NOTE2]);
    Object.values(db).forEach(f => { if (f !== db.getCanvasNotes) f.mockResolvedValue(undefined); });
    mockAuthUser = { id: 7 };
  });

  it('loads the signed-in user\'s notes', async () => {
    const { result } = renderHook(() => useCanvasNotes());
    await waitFor(() => expect(result.current.notes).toHaveLength(2));
    expect(db.getCanvasNotes).toHaveBeenCalledWith(7);
  });

  it('is empty and cannot add when signed out', async () => {
    mockAuthUser = null;
    const { result } = renderHook(() => useCanvasNotes());
    let id: number | null = 0;
    await act(async () => { id = await result.current.addNote('#fff', { x: 0, y: 0, w: 1, h: 1 }); });
    expect(id).toBeNull();
    expect(result.current.notes).toEqual([]);
    expect(db.getCanvasNotes).not.toHaveBeenCalled();
  });

  it('addNote appends the new note on top and returns its id', async () => {
    db.addCanvasNote.mockResolvedValue(9);
    const { result } = renderHook(() => useCanvasNotes());
    await waitFor(() => expect(result.current.notes).toHaveLength(2));
    let id: number | null = null;
    await act(async () => { id = await result.current.addNote('#ffcc33', { x: 5, y: 6, w: 260, h: 200 }); });
    expect(id).toBe(9);
    expect(result.current.notes.at(-1)).toEqual({ id: 9, content: '', color: '#ffcc33', x: 5, y: 6, w: 260, h: 200, sort_order: 4 });
  });

  it('updateContent is optimistic', async () => {
    const { result } = renderHook(() => useCanvasNotes());
    await waitFor(() => expect(result.current.notes).toHaveLength(2));
    await act(async () => { await result.current.updateContent(1, 'new'); });
    expect(result.current.notes[0].content).toBe('new');
    expect(db.updateCanvasNoteContent).toHaveBeenCalledWith(1, 'new');
  });

  it('a failed write reloads from the DB', async () => {
    db.deleteCanvasNote.mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useCanvasNotes());
    await waitFor(() => expect(result.current.notes).toHaveLength(2));
    await act(async () => { await result.current.deleteNote(1); });
    expect(result.current.notes).toHaveLength(2);
    expect(db.getCanvasNotes).toHaveBeenCalledTimes(2);
  });

  it('bringToFront gives the note the highest sort_order', async () => {
    const { result } = renderHook(() => useCanvasNotes());
    await waitFor(() => expect(result.current.notes).toHaveLength(2));
    await act(async () => { await result.current.bringToFront(1); });
    expect(result.current.notes.find(n => n.id === 1)?.sort_order).toBe(4);
    expect(db.bringCanvasNoteToFront).toHaveBeenCalledWith(1);
  });
});
```

Run: `npx vitest run src/hooks/useCanvasNotes.test.ts`
Expected: FAIL. Cannot find module `./useCanvasNotes`.

- [ ] **Step 2: Implement**

`src/hooks/useCanvasNotes.ts`:

```ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getCanvasNotes,
  addCanvasNote,
  updateCanvasNoteContent,
  updateCanvasNoteColor,
  updateCanvasNoteGeometry,
  bringCanvasNoteToFront,
  deleteCanvasNote,
} from '../db';
import type { BucketGeometry, CanvasNote } from '../types';

const maxSortOrder = (notes: CanvasNote[]) => notes.reduce((max, n) => Math.max(max, n.sort_order), -1);

// Sticky notes on the Buckets canvas. Only BucketsPage needs them, so they live here
// rather than in FocusContext. Edits are optimistic; a failed write reloads from the DB.
export function useCanvasNotes() {
  const { authUser } = useAuth();
  const userId = authUser?.id ?? null;
  const [notes, setNotes] = useState<CanvasNote[]>([]);

  const reload = useCallback(async () => {
    if (userId === null) {
      setNotes([]);
      return;
    }
    try {
      setNotes(await getCanvasNotes(userId));
    } catch (error) {
      console.error('[useCanvasNotes] Load failed:', error);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const apply = useCallback(async (update: (prev: CanvasNote[]) => CanvasNote[], write: () => Promise<void>) => {
    setNotes(update);
    try {
      await write();
    } catch (error) {
      console.error('[useCanvasNotes] Write failed, reverting UI:', error);
      await reload();
    }
  }, [reload]);

  // Not optimistic: the caller needs the new id (to open the note for editing)
  const addNote = useCallback(async (color: string, geometry: BucketGeometry): Promise<number | null> => {
    if (userId === null) return null;
    try {
      const id = await addCanvasNote(userId, color, geometry);
      setNotes(prev => [...prev, { id, content: '', color, ...geometry, sort_order: maxSortOrder(prev) + 1 }]);
      return id;
    } catch (error) {
      console.error('[useCanvasNotes] Add failed:', error);
      return null;
    }
  }, [userId]);

  const updateContent = useCallback((id: number, content: string) => apply(
    prev => prev.map(n => n.id === id ? { ...n, content } : n),
    () => updateCanvasNoteContent(id, content),
  ), [apply]);

  const updateColor = useCallback((id: number, color: string) => apply(
    prev => prev.map(n => n.id === id ? { ...n, color } : n),
    () => updateCanvasNoteColor(id, color),
  ), [apply]);

  const updateGeometry = useCallback((id: number, geometry: BucketGeometry) => apply(
    prev => prev.map(n => n.id === id ? { ...n, ...geometry } : n),
    () => updateCanvasNoteGeometry(id, geometry),
  ), [apply]);

  const bringToFront = useCallback((id: number) => apply(
    prev => {
      const top = maxSortOrder(prev) + 1;
      return prev.map(n => n.id === id ? { ...n, sort_order: top } : n);
    },
    () => bringCanvasNoteToFront(id),
  ), [apply]);

  const deleteNote = useCallback((id: number) => apply(
    prev => prev.filter(n => n.id !== id),
    () => deleteCanvasNote(id),
  ), [apply]);

  return { notes, addNote, updateContent, updateColor, updateGeometry, bringToFront, deleteNote };
}

export type CanvasNotesApi = ReturnType<typeof useCanvasNotes>;
```

(If `npx eslint` flags `reload()` inside the effect with `react-hooks/set-state-in-effect`, change the effect to `useEffect(() => { void reload(); }, [reload]);`. If it still flags, add `// eslint-disable-next-line react-hooks/set-state-in-effect -- loading data on mount`. FocusContext loads data the same way.)

- [ ] **Step 3: Run to verify they pass**

Run: `npx vitest run src/hooks/useCanvasNotes.test.ts`
Expected: PASS.

- [ ] **Step 4: Lint and commit**

```bash
npx eslint src/hooks/useCanvasNotes.ts
git add src/hooks/useCanvasNotes.ts src/hooks/useCanvasNotes.test.ts
git commit -m "feat: useCanvasNotes hook with optimistic edits"
```

---

### Task 7: `CanvasNoteView` component

**Files:**
- Create: `src/components/CanvasNoteView.tsx`, `src/components/CanvasNoteView.module.scss`, `src/components/CanvasNoteView.test.tsx`

**Interfaces:**
- Consumes: `usePanelDrag` (Task 2), `MarkdownView` (Task 3), `useMarkdownEditor` + `MarkdownToolbar` (Task 4), `CanvasNote` (Task 5).
- Produces:
  ```ts
  export const NOTE_MIN_SIZE: MinSize;       // { w: 160, h: 100 }
  export interface CanvasNoteViewProps {
    note: CanvasNote;
    zoom: number;
    zIndex: number;                          // NOTE_Z_BASE + stacking order, from BucketsPage
    isEditing: boolean;                      // owned by BucketsPage (one note at a time)
    onStartEdit: (id: number) => void;
    onEndEdit: (id: number) => void;
    onContentChange: (id: number, content: string) => void;
    onColorChange: (id: number, color: string) => void;
    onGeometryChange: (id: number, geometry: BucketGeometry) => void;
    onBringToFront: (id: number) => void;
    onDelete: (id: number) => void;
  }
  export const CanvasNoteView: FC<CanvasNoteViewProps>;
  ```

- [ ] **Step 1: Write the failing tests**

`src/components/CanvasNoteView.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { CanvasNote } from '../types';
import { CanvasNoteView, type CanvasNoteViewProps } from './CanvasNoteView';

vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn() }));
vi.mock('../utils/audio', () => ({
  soundEngine: { playClick: vi.fn(), playEditStart: vi.fn(), playCheckboxUncheck: vi.fn() },
  playCheckboxCheckWithFile: vi.fn(),
}));

const NOTE: CanvasNote = { id: 5, content: '# Title\n\n- [ ] task', color: '#ffcc33', x: 100, y: 40, w: 260, h: 200, sort_order: 0 };

const handlers = {
  onContentChange: vi.fn(),
  onColorChange: vi.fn(),
  onGeometryChange: vi.fn(),
  onBringToFront: vi.fn(),
  onDelete: vi.fn(),
};

// Owns isEditing like BucketsPage does
function Harness({ note = NOTE, startEditing = false }: { note?: CanvasNote; startEditing?: boolean }) {
  const [editing, setEditing] = useState(startEditing);
  const props: CanvasNoteViewProps = {
    note, zoom: 1, zIndex: 10001, isEditing: editing,
    onStartEdit: () => setEditing(true), onEndEdit: () => setEditing(false),
    ...handlers,
  };
  return <><div data-testid="outside" /><CanvasNoteView {...props} /></>;
}

const noteEl = () => document.querySelector('[data-note-id="5"]') as HTMLElement;

describe('CanvasNoteView', () => {
  beforeEach(() => {
    Object.values(handlers).forEach(h => h.mockClear());
  });

  it('renders markdown, tinted with the note color, at its geometry', () => {
    render(<Harness />);
    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument();
    expect(noteEl().style.background).toContain('color-mix');
    expect(noteEl().style.left).toBe('100px');
    expect(noteEl().style.zIndex).toBe('10001');
  });

  it('shows a hint when empty', () => {
    render(<Harness note={{ ...NOTE, content: '' }} />);
    expect(screen.getByText('Double-click to edit')).toBeInTheDocument();
  });

  it('double-click opens the editor with the note text; Esc saves', () => {
    render(<Harness />);
    fireEvent.doubleClick(noteEl());
    const ta = within(noteEl()).getByRole('textbox') as HTMLTextAreaElement;
    expect(ta.value).toBe(NOTE.content);
    expect(within(noteEl()).getByTitle('Table')).toBeInTheDocument();
    fireEvent.change(ta, { target: { value: 'changed' } });
    fireEvent.keyDown(ta, { key: 'Escape' });
    expect(handlers.onContentChange).toHaveBeenCalledWith(5, 'changed');
    expect(within(noteEl()).queryByRole('textbox')).toBeNull();
  });

  it('Shift+Esc cancels without saving', () => {
    render(<Harness startEditing />);
    const ta = within(noteEl()).getByRole('textbox');
    fireEvent.change(ta, { target: { value: 'changed' } });
    fireEvent.keyDown(ta, { key: 'Escape', shiftKey: true });
    expect(handlers.onContentChange).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument();
  });

  it('saving unchanged text does not write', () => {
    render(<Harness startEditing />);
    fireEvent.keyDown(within(noteEl()).getByRole('textbox'), { key: 'Escape' });
    expect(handlers.onContentChange).not.toHaveBeenCalled();
  });

  it('mousedown outside the note saves', () => {
    render(<Harness startEditing />);
    fireEvent.change(within(noteEl()).getByRole('textbox'), { target: { value: 'outside save' } });
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(handlers.onContentChange).toHaveBeenCalledWith(5, 'outside save');
  });

  it('mousedown inside the note (toolbar) does not save', () => {
    render(<Harness startEditing />);
    fireEvent.mouseDown(within(noteEl()).getByTitle('Bold (Ctrl+B)'));
    expect(within(noteEl()).getByRole('textbox')).toBeInTheDocument();
  });

  it('clicking a task checkbox toggles it without starting a drag or editing', () => {
    render(<Harness />);
    const checkbox = screen.getByRole('checkbox');
    const capture = vi.fn();
    noteEl().setPointerCapture = capture;
    fireEvent.pointerDown(checkbox, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(noteEl(), { pointerId: 1, buttons: 1, clientX: 30, clientY: 0 });
    expect(capture).not.toHaveBeenCalled();
    fireEvent.click(checkbox);
    expect(handlers.onContentChange).toHaveBeenCalledWith(5, '# Title\n\n- [x] task');
    expect(within(noteEl()).queryByRole('textbox')).toBeNull();
  });

  it('dragging the note body moves it (snapped), brings it to front and saves', () => {
    render(<Harness />);
    const body = screen.getByRole('heading', { name: 'Title' });
    fireEvent.pointerDown(body, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(noteEl(), { pointerId: 1, buttons: 1, clientX: 33, clientY: 9 });
    fireEvent.pointerUp(noteEl(), { pointerId: 1, clientX: 33, clientY: 9 });
    expect(handlers.onBringToFront).toHaveBeenCalledWith(5);
    expect(handlers.onGeometryChange).toHaveBeenCalledWith(5, { x: 140, y: 40, w: 260, h: 200 });
  });

  it('resizing respects the note minimum size', () => {
    render(<Harness />);
    const handle = within(noteEl()).getByTitle('Resize');
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: -1000, clientY: -1000 });
    expect(handlers.onGeometryChange).toHaveBeenCalledWith(5, { x: 100, y: 40, w: 160, h: 100 });
  });

  it('delete asks for confirmation when the note has content', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Harness />);
    fireEvent.click(within(noteEl()).getByTitle('Delete note'));
    expect(confirm).toHaveBeenCalled();
    expect(handlers.onDelete).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('an empty note is deleted without confirmation', () => {
    const confirm = vi.spyOn(window, 'confirm');
    render(<Harness note={{ ...NOTE, content: '  ' }} />);
    fireEvent.click(within(noteEl()).getByTitle('Delete note'));
    expect(confirm).not.toHaveBeenCalled();
    expect(handlers.onDelete).toHaveBeenCalledWith(5);
    confirm.mockRestore();
  });

  it('changing the color reports it', () => {
    render(<Harness />);
    fireEvent.change(within(noteEl()).getByTitle('Note color'), { target: { value: '#3388ff' } });
    expect(handlers.onColorChange).toHaveBeenCalledWith(5, '#3388ff');
  });
});
```

Run: `npx vitest run src/components/CanvasNoteView.test.tsx`
Expected: FAIL. Cannot find module `./CanvasNoteView`.

- [ ] **Step 2: Implement the component**

`src/components/CanvasNoteView.tsx`:

```tsx
import { type FC, type RefObject, useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import styles from './CanvasNoteView.module.scss';
import { soundEngine } from '../utils/audio';
import { usePanelDrag } from '../hooks/usePanelDrag';
import { useMarkdownEditor, type MarkdownEditor } from '../hooks/useMarkdownEditor';
import type { MinSize } from '../utils/canvas';
import { MarkdownView } from './MarkdownView';
import { MarkdownToolbar } from './MarkdownToolbar';
import type { BucketGeometry, CanvasNote } from '../types';

export const NOTE_MIN_SIZE: MinSize = { w: 160, h: 100 };

// Above every note (BucketsPage gives notes NOTE_Z_BASE + stacking order)
const DRAGGING_Z_INDEX = 200000;

// Presses on these act on the control itself, never move the note
const INTERACTIVE = 'button, input, a, textarea';

export interface CanvasNoteViewProps {
  note: CanvasNote;
  zoom: number;
  zIndex: number;
  isEditing: boolean;
  onStartEdit: (id: number) => void;
  onEndEdit: (id: number) => void;
  onContentChange: (id: number, content: string) => void;
  onColorChange: (id: number, color: string) => void;
  onGeometryChange: (id: number, geometry: BucketGeometry) => void;
  onBringToFront: (id: number) => void;
  onDelete: (id: number) => void;
}

interface NoteEditorProps {
  initialText: string;
  containerRef: RefObject<HTMLDivElement | null>;
  onSave: (text: string) => void;
  onCancel: () => void;
}

// Mounted only while editing, so every edit starts from the note's current text
const NoteEditor: FC<NoteEditorProps> = ({ initialText, containerRef, onSave, onCancel }) => {
  // Annotated: the initializer refers to `editor` (TS7022 otherwise)
  const editor: MarkdownEditor = useMarkdownEditor({ initialText, onSave: () => { onSave(editor.text); }, onCancel });
  const { text } = editor;

  // Clicking anywhere outside the note saves (same as Esc)
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      onSave(text);
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [containerRef, onSave, text]);

  return (
    <div className={styles.editor} data-canvas-scroll>
      <textarea
        ref={editor.textareaRef}
        className={styles.textarea}
        value={text}
        onChange={e => editor.setText(e.target.value)}
        onKeyDown={editor.handleKeyDown}
        onPaste={editor.handlePaste}
        placeholder={'Markdown...\nEsc saves · Shift+Esc cancels'}
        spellCheck={false}
        autoFocus
      />
      <MarkdownToolbar editor={editor} compact />
    </div>
  );
};

export const CanvasNoteView: FC<CanvasNoteViewProps> = ({
  note, zoom, zIndex, isEditing,
  onStartEdit, onEndEdit, onContentChange, onColorChange, onGeometryChange, onBringToFront, onDelete,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);

  const { geom, isDragging, beginPointerDrag, handlePointerMove, handlePointerUp } = usePanelDrag({
    geometry: { x: note.x, y: note.y, w: note.w, h: note.h },
    zoom,
    minSize: NOTE_MIN_SIZE,
    onDragEnd: (final, changed) => {
      // The last note moved or resized stays in front of the other notes
      onBringToFront(note.id);
      if (changed) onGeometryChange(note.id, final);
    },
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isEditing) return;
    if ((e.target as Element).closest(INTERACTIVE)) return;
    beginPointerDrag(e, 'move');
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isEditing) return;
    if ((e.target as Element).closest(INTERACTIVE)) return;
    soundEngine.playEditStart();
    onStartEdit(note.id);
  };

  const handleSave = (text: string) => {
    const content = text.trim();
    if (content !== note.content) onContentChange(note.id, content);
    soundEngine.playClick();
    onEndEdit(note.id);
  };

  const handleCancel = () => {
    soundEngine.playClick();
    onEndEdit(note.id);
  };

  const handleDelete = () => {
    if (note.content.trim() && !window.confirm('DELETE_NOTE? Its text will be lost.')) return;
    soundEngine.playClick();
    onDelete(note.id);
  };

  return (
    <div
      ref={rootRef}
      className={`${styles.note} ${isDragging ? styles.dragging : ''} ${isEditing ? styles.editing : ''}`}
      data-note-id={note.id}
      data-details-barrier
      style={{
        left: geom.x,
        top: geom.y,
        width: geom.w,
        height: geom.h,
        zIndex: isDragging ? DRAGGING_Z_INDEX : zIndex,
        // Opaque so notes don't show the panels underneath
        background: `color-mix(in srgb, ${note.color} 18%, var(--bg-dark))`,
        borderColor: note.color,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      {isEditing ? (
        <NoteEditor initialText={note.content} containerRef={rootRef} onSave={handleSave} onCancel={handleCancel} />
      ) : (
        <>
          <div className={styles.controls}>
            <input
              type="color"
              className={styles.colorInput}
              value={note.color}
              onChange={e => onColorChange(note.id, e.target.value)}
              title="Note color"
            />
            <button className={styles.deleteBtn} onClick={handleDelete} title="Delete note">
              <Trash2 size={12} />
            </button>
          </div>
          <div className={styles.body} data-canvas-scroll>
            {note.content ? (
              <MarkdownView source={note.content} onChange={next => onContentChange(note.id, next)} className={styles.markdown} />
            ) : (
              <div className={styles.empty}>Double-click to edit</div>
            )}
          </div>
        </>
      )}

      <div
        className={styles.resizeHandle}
        onPointerDown={e => beginPointerDrag(e, 'resize')}
        title="Resize"
      />
    </div>
  );
};
```

Notes for the implementer:
- The resize handle's pointermove/up bubble to the root's handlers. `beginPointerDrag` stops the pointerdown so the root doesn't also start a move.
- If `npx eslint` reports `jsx-a11y/no-autofocus`, that plugin isn't configured here, so it won't. If `react-hooks` flags anything in `NoteEditor`, fix it rather than disabling the rule.

`src/components/CanvasNoteView.module.scss`:

```scss
.note {
  position: absolute;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-top-width: 3px;
  font-family: var(--font-mono);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
  cursor: move;
  touch-action: none;

  &.dragging {
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
  }

  &.editing {
    cursor: default;
  }

  &:hover .controls {
    opacity: 1;
  }
}

.controls {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 2px 4px;
  background: rgba(13, 13, 13, 0.75);
  border: 1px solid var(--border);
  opacity: 0;
  transition: opacity 0.15s;
}

.colorInput {
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1px solid var(--border);
  background: transparent;
  cursor: pointer;

  &::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  &::-webkit-color-swatch {
    border: none;
  }
}

.deleteBtn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;

  &:hover {
    color: #ef4444;
  }
}

.body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.6rem 0.7rem;
}

// Notes are dragged from anywhere, so their text is not selectable
.markdown,
.markdown * {
  user-select: none;
  cursor: inherit;
}

.markdown a,
.markdown input {
  cursor: pointer;
}

.empty {
  font-size: 0.65rem;
  color: var(--text-muted);
  letter-spacing: 0.08em;
}

.editor {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.textarea {
  flex: 1;
  min-height: 0;
  background: rgba(0, 0, 0, 0.35);
  border: none;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  line-height: 1.6;
  padding: 0.5rem 0.6rem;
  resize: none;
  outline: none;
  white-space: pre-wrap;
  cursor: text;
  user-select: text;

  &::placeholder {
    color: var(--text-muted);
    opacity: 0.5;
  }
}

.resizeHandle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
  touch-action: none;
  background: linear-gradient(135deg, transparent 50%, var(--text-muted) 50%, var(--text-muted) 60%, transparent 60%, transparent 75%, var(--text-muted) 75%, var(--text-muted) 85%, transparent 85%);
  opacity: 0.6;

  &:hover {
    opacity: 1;
  }
}
```

- [ ] **Step 3: Run to verify the tests pass**

Run: `npx vitest run src/components/CanvasNoteView.test.tsx`
Expected: PASS. If the drag test gets `x: 133` instead of `140`, the snap flag isn't inverted in `usePanelDrag` (Task 2). If the resize test sees no call, check that the handle's pointerup reaches the root handler. In jsdom, `fireEvent.pointerUp(handle)` bubbles to the root, which is correct.

- [ ] **Step 4: Lint and commit**

```bash
npx eslint src/components/CanvasNoteView.tsx
git add src/components/CanvasNoteView.tsx src/components/CanvasNoteView.module.scss src/components/CanvasNoteView.test.tsx
git commit -m "feat: CanvasNoteView sticky note with inline markdown editing"
```

---

### Task 8: Notes on the Buckets page (NEW_NOTE, layering, editing state)

**Files:**
- Modify: `src/components/BucketsPage.tsx`
- Test: `src/components/BucketsPage.test.tsx`

**Interfaces:**
- Consumes: `useCanvasNotes` (Task 6), `CanvasNoteView` (Task 7), `snapToGrid` and `stackingOrder` from `utils/canvas`.

- [ ] **Step 1: Write the failing tests**

In `src/components/BucketsPage.test.tsx`:

1. Below the `vi.mock('./ObjectiveDetails', …)` block, add:

```tsx
vi.mock('@tauri-apps/plugin-shell', () => ({ open: vi.fn() }));

const mockAddNote = vi.fn();
let mockNotes: CanvasNote[] = [];
vi.mock('../hooks/useCanvasNotes', () => ({
  useCanvasNotes: () => ({
    notes: mockNotes,
    addNote: mockAddNote,
    updateContent: vi.fn(),
    updateColor: vi.fn(),
    updateGeometry: vi.fn(),
    bringToFront: vi.fn(),
    deleteNote: vi.fn(),
  }),
}));

const NOTE = (id: number, sort_order = 0): CanvasNote => ({ id, content: `note ${id}`, color: '#ffcc33', x: 0, y: 600, w: 260, h: 200, sort_order });
```

2. Change the type import at the top to `import type { Bucket, CanvasNote, StrategicObjective } from '../types';`.
3. In the `'../utils/audio'` mock, add `playCheckboxUncheck: vi.fn()` to `soundEngine` and a top-level `playCheckboxCheckWithFile: vi.fn()`.
4. In `beforeEach`, add `mockAddNote.mockReset(); mockNotes = [];`.
5. Add these tests at the end of the `describe`:

```tsx
  it('renders notes above every bucket panel', () => {
    mockNotes = [NOTE(1, 0), NOTE(2, 1)];
    render(<BucketsPage onBack={vi.fn()} />);
    const z = (el: Element | null) => Number((el as HTMLElement).style.zIndex);
    const bucketZ = Math.max(...[...document.querySelectorAll('[data-bucket-id]')].map(z));
    const n1 = z(document.querySelector('[data-note-id="1"]'));
    const n2 = z(document.querySelector('[data-note-id="2"]'));
    expect(n1).toBeGreaterThan(bucketZ);
    expect(n2).toBeGreaterThan(n1);
  });

  it('NEW_NOTE adds a default note at the top-right and opens it for editing', async () => {
    mockAddNote.mockImplementation(async () => {
      mockNotes = [{ ...NOTE(50), content: '' }];
      return 50;
    });
    const { rerender } = render(<BucketsPage onBack={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByText('NEW_NOTE')); });
    expect(mockAddNote).toHaveBeenCalledWith('#ffcc33', expect.objectContaining({ w: 260, h: 200 }));
    const geometry = mockAddNote.mock.calls[0][1];
    // Math.abs: a negative grid value gives -0, which toBe(0) rejects
    expect(Math.abs(geometry.x % 20)).toBe(0);
    expect(Math.abs(geometry.y % 20)).toBe(0);
    rerender(<BucketsPage onBack={vi.fn()} />);
    const note = document.querySelector('[data-note-id="50"]') as HTMLElement;
    expect(within(note).getByRole('textbox')).toBeInTheDocument();
  });

  it('Escape and Space typed in a note editor stay in the note', () => {
    mockNotes = [NOTE(1)];
    localStorage.setItem('bucket_canvas_viewport', JSON.stringify({ panX: -500, panY: -500, zoom: 1 }));
    const onBack = vi.fn();
    render(<BucketsPage onBack={onBack} />);
    const note = document.querySelector('[data-note-id="1"]') as HTMLElement;
    fireEvent.doubleClick(note);
    const ta = within(note).getByRole('textbox');
    fireEvent.keyDown(ta, { key: ' ' });
    expect(screen.getByTestId('canvas-world').style.transform).toBe('translate(-500px, -500px) scale(1)');
    fireEvent.keyDown(ta, { key: 'Escape' });
    expect(onBack).not.toHaveBeenCalled();
    expect(within(note).queryByRole('textbox')).toBeNull();
  });

  it('wheel over a note does not zoom the canvas', () => {
    mockNotes = [NOTE(1)];
    render(<BucketsPage onBack={vi.fn()} />);
    fireEvent.wheel(screen.getByText('note 1'), { deltaY: -500 });
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('only one note is edited at a time', () => {
    mockNotes = [NOTE(1), NOTE(2, 1)];
    render(<BucketsPage onBack={vi.fn()} />);
    const n1 = document.querySelector('[data-note-id="1"]') as HTMLElement;
    const n2 = document.querySelector('[data-note-id="2"]') as HTMLElement;
    fireEvent.doubleClick(n1);
    expect(within(n1).getByRole('textbox')).toBeInTheDocument();
    fireEvent.mouseDown(n2);
    fireEvent.doubleClick(n2);
    expect(within(n1).queryByRole('textbox')).toBeNull();
    expect(within(n2).getByRole('textbox')).toBeInTheDocument();
  });
```

Run: `npx vitest run src/components/BucketsPage.test.tsx`
Expected: FAIL. No `[data-note-id]` elements and no NEW_NOTE button.

- [ ] **Step 2: Implement**

In `src/components/BucketsPage.tsx`:

1. Imports: change `import { ArrowLeft, Plus } from 'lucide-react';` to `import { ArrowLeft, Plus, StickyNote } from 'lucide-react';`. Add `snapToGrid` to the `../utils/canvas` import list. Add:

```ts
import { CanvasNoteView } from './CanvasNoteView';
import { useCanvasNotes } from '../hooks/useCanvasNotes';
```

2. Constants, after `SAVE_DELAY_MS`:

```ts
const DEFAULT_NOTE_COLOR = '#ffcc33';
const DEFAULT_NOTE_W = 260;
const DEFAULT_NOTE_H = 200;
// Screen px between a new note and the top/right edges of the viewport
const NEW_NOTE_MARGIN_PX = 24;
// Every note sits above every bucket panel (buckets use z-index 1..N)
const NOTE_Z_BASE = 10000;
```

3. Inside the component, after the `useFocus()` destructure:

```ts
  const { notes, addNote, updateContent, updateColor, updateGeometry, bringToFront, deleteNote } = useCanvasNotes();
  // At most one note is edited at a time
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
```

4. After `handleNewBucket`:

```ts
  const handleNewNote = async () => {
    soundEngine.playClick();
    const rect = getRect();
    const corner = screenToWorld(vp, rect.width - DEFAULT_NOTE_W * vp.zoom - NEW_NOTE_MARGIN_PX, NEW_NOTE_MARGIN_PX);
    const id = await addNote(DEFAULT_NOTE_COLOR, {
      x: snapToGrid(corner.x),
      y: snapToGrid(corner.y),
      w: DEFAULT_NOTE_W,
      h: DEFAULT_NOTE_H,
    });
    if (id !== null) setEditingNoteId(id);
  };

  const handleStartNoteEdit = useCallback((id: number) => setEditingNoteId(id), []);
  // Only clears if this note is still the one being edited (another may have opened since)
  const handleEndNoteEdit = useCallback((id: number) => setEditingNoteId(cur => (cur === id ? null : cur)), []);
```

5. Next to `const stackOrder = …`:

```ts
  const noteStackOrder = useMemo(() => stackingOrder(notes), [notes]);
```

6. In the toolbar, right after the NEW_BUCKET button:

```tsx
          <button className={styles.toolBtn} onClick={handleNewNote}>
            <StickyNote size={14} />
            <span>NEW_NOTE</span>
          </button>
```

7. In the world `<div>`, right after the `buckets.map(…)` block:

```tsx
            {notes.map(note => (
              <CanvasNoteView
                key={note.id}
                note={note}
                zoom={vp.zoom}
                zIndex={NOTE_Z_BASE + (noteStackOrder.get(note.id) ?? 1)}
                isEditing={editingNoteId === note.id}
                onStartEdit={handleStartNoteEdit}
                onEndEdit={handleEndNoteEdit}
                onContentChange={updateContent}
                onColorChange={updateColor}
                onGeometryChange={updateGeometry}
                onBringToFront={bringToFront}
                onDelete={deleteNote}
              />
            ))}
```

(No change to the keyboard handler: `isTypingTarget` already ignores keys typed into the note's textarea.)

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/components/BucketsPage.test.tsx`
Expected: PASS (new and existing tests).

- [ ] **Step 4: Full verification**

```bash
npm test
npx tsc -b
npx eslint src/components/BucketsPage.tsx
npm run lint 2>&1 | tail -2
```
Expected: all tests pass, tsc clean, total lint problems ≤ 47.

- [ ] **Step 5: Manual check in the app**

Run `npm run tauri dev`, open Buckets (B) and check:
- NEW_NOTE puts a yellow note at the top-right, already in edit mode.
- Type a table using the toolbar's Table button, then press Esc. The table renders with borders, and right alignment works.
- Drag the note: it moves in 20-unit steps, and with Shift held it moves freely.
- Resize the note from its corner.
- Change its color, and delete it.
- Move a bucket under a note: the note stays on top.
- The objective details pane still edits and renders correctly, and tables look right there too.

- [ ] **Step 6: Commit**

```bash
git add src/components/BucketsPage.tsx src/components/BucketsPage.test.tsx
git commit -m "feat: sticky notes on the Buckets canvas"
```

---

### Task 9: Docs

**Files:**
- Modify: `docs/architecture.md`, `docs/database.md`, `README.md`, `docs/IDEAS.md`

- [ ] **Step 1: `docs/architecture.md`**

- In the components table:
  - `BucketsPage` row: add that it renders `CanvasNoteView` notes (loaded via `useCanvasNotes`) in a layer above all panels (`NOTE_Z_BASE`), owns `editingNoteId` (one note edited at a time), and has a NEW_NOTE button that adds a `#ffcc33` 260×200 note near the top-right of the view, opened for editing.
  - `BucketPanel` row: replace "Shift snaps to a 20-unit grid" with "moves/resizes snap to a 20-unit grid; hold Shift to move freely in whole units", and mention `usePanelDrag`.
  - Add a `CanvasNoteView` row: a sticky note tinted with its color. You drag it from anywhere except controls and resize it from the corner (minimum 160×100). On hover it shows a color input and delete (delete asks for confirmation if the note has text). Double-click edits it in place with a compact `MarkdownToolbar`: Esc or clicking outside saves, Shift+Esc cancels. Task checkboxes toggle without entering edit mode. The last note moved comes to the front among notes.
  - Add `MarkdownView` (GFM rendering with task toggles, external links, scrollable styled tables, blank-line preservation) and `MarkdownToolbar` (normal/compact) rows.
  - Update the `ObjectiveDetails` row to say it is built on `MarkdownView` / `MarkdownToolbar` / `useMarkdownEditor`.
- In the hooks section/table add `usePanelDrag`, `useMarkdownEditor`, `useCanvasNotes` (one line each, as in the interfaces above). In the utils table add `utils/markdown.ts`, and update the `utils/canvas.ts` line to mention `snapToGrid`.
- In the "Buckets page" shortcuts paragraph (around line 166): note that moves and resizes snap by default and Shift moves freely; double-click a note to edit; Esc saves and Shift+Esc cancels in a note.

- [ ] **Step 2: `docs/database.md`**

Add a `canvas_notes` row to the tables table, after `buckets`:

`| canvas_notes | id, user_id, content (markdown, '' default), color (hex), x, y, w (260), h (200), sort_order, created_at | Sticky notes on the Buckets canvas, in world units. sort_order is the stacking order among notes only (higher = in front); every note is drawn above every bucket. bringCanvasNoteToFront sets it to the user's max + 1 after a note is moved or resized. |`

Add `canvas_notes` under `users` in the relationship diagram, and add it to the list of tables created in `initDb` if the doc has one. No data migration.

- [ ] **Step 3: `README.md` and `docs/IDEAS.md`**

- README "Key Features": under the Buckets canvas bullet, add sticky markdown notes (colored, movable, resizable, with tables) and mention that markdown tables are supported in objective details. If the README states the Shift/snap behaviour, update it.
- `docs/IDEAS.md` status list: add "Canvas sticky notes — done", or mark it done if an existing notes idea is listed.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture.md docs/database.md README.md docs/IDEAS.md
git commit -m "docs: canvas notes, shared markdown components, inverted snapping"
```
