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
