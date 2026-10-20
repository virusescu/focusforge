import { describe, it, expect, beforeEach } from 'vitest';
import {
  clampZoom, screenToWorld, worldToScreen, zoomAt, recenter, movePanel, resizePanel,
  wheelZoomFactor, loadViewport, saveViewport, DEFAULT_VIEWPORT, MIN_ZOOM, MAX_ZOOM,
  MIN_PANEL_W, MIN_PANEL_H, VIEWPORT_STORAGE_KEY, SNAP_STEP, stackingOrder, snapToGrid,
} from './canvas';

describe('canvas math', () => {
  it('movePanel with snap rounds the position to SNAP_STEP and keeps the size', () => {
    expect(SNAP_STEP).toBe(20);
    expect(movePanel({ x: 3, y: 7, w: 303, h: 417 }, 14, 22, 1, true)).toEqual({ x: 20, y: 20, w: 303, h: 417 });
    expect(movePanel({ x: 0, y: 0, w: 300, h: 400 }, -26, 8, 2, true)).toEqual({ x: -20, y: 0, w: 300, h: 400 });
  });

  it('resizePanel with snap rounds the size to SNAP_STEP and still enforces the minimum', () => {
    expect(resizePanel({ x: 3, y: 7, w: 300, h: 400 }, 14, 26, 1, true)).toEqual({ x: 3, y: 7, w: 320, h: 420 });
    expect(resizePanel({ x: 0, y: 0, w: 300, h: 400 }, -1000, -1000, 1, true)).toEqual({ x: 0, y: 0, w: MIN_PANEL_W, h: MIN_PANEL_H });
  });

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

  it('stackingOrder puts higher sort_order in front, ties broken by id', () => {
    const order = stackingOrder([
      { id: 1, sort_order: 5 },
      { id: 2, sort_order: -1 },
      { id: 3, sort_order: 5 },
      { id: 4, sort_order: 2 },
    ]);
    expect(order.get(2)).toBe(1);
    expect(order.get(4)).toBe(2);
    expect(order.get(1)).toBe(3);
    expect(order.get(3)).toBe(4);
  });

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
