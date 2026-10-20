import type { BucketGeometry } from '../types';

// screen = world * zoom + pan (screen coords relative to the viewport element)
export interface Viewport {
  panX: number;
  panY: number;
  zoom: number;
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;
export const MIN_PANEL_W = 200;
export const MIN_PANEL_H = 120;
export const DEFAULT_VIEWPORT: Viewport = { panX: 0, panY: 0, zoom: 1 };
export const VIEWPORT_STORAGE_KEY = 'bucket_canvas_viewport';

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function screenToWorld(vp: Viewport, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - vp.panX) / vp.zoom, y: (sy - vp.panY) / vp.zoom };
}

export function worldToScreen(vp: Viewport, wx: number, wy: number): { x: number; y: number } {
  return { x: wx * vp.zoom + vp.panX, y: wy * vp.zoom + vp.panY };
}

export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * 0.0015);
}

// Zooms by `factor` while keeping the world point under (sx, sy) fixed on screen.
export function zoomAt(vp: Viewport, sx: number, sy: number, factor: number): Viewport {
  const zoom = clampZoom(vp.zoom * factor);
  const world = screenToWorld(vp, sx, sy);
  return { zoom, panX: sx - world.x * zoom, panY: sy - world.y * zoom };
}

// Puts world (0,0) at the viewport center, keeping the zoom.
export function recenter(vp: Viewport, viewportWidth: number, viewportHeight: number): Viewport {
  return { zoom: vp.zoom, panX: viewportWidth / 2, panY: viewportHeight / 2 };
}

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

// z-index per bucket id: the higher a bucket's sort_order, the further in front (1 = back).
// Dropping a moved/resized panel gives it the highest sort_order (bringBucketToFront).
export function stackingOrder(panels: { id: number; sort_order: number }[]): Map<number, number> {
  const sorted = [...panels].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  return new Map(sorted.map((p, i) => [p.id, i + 1]));
}

export function loadViewport(): Viewport {
  try {
    const raw = localStorage.getItem(VIEWPORT_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VIEWPORT };
    const parsed = JSON.parse(raw) as Partial<Viewport> | null;
    if (
      !parsed ||
      !Number.isFinite(parsed.panX) ||
      !Number.isFinite(parsed.panY) ||
      !Number.isFinite(parsed.zoom)
    ) {
      return { ...DEFAULT_VIEWPORT };
    }
    return { panX: parsed.panX as number, panY: parsed.panY as number, zoom: clampZoom(parsed.zoom as number) };
  } catch {
    return { ...DEFAULT_VIEWPORT };
  }
}

export function saveViewport(vp: Viewport): void {
  try {
    localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(vp));
  } catch {
    // ignore storage errors
  }
}

// Canvas shortcuts (Space, Escape, F2) ignore keys typed into text fields
export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.closest('[contenteditable]') !== null)
  );
}
