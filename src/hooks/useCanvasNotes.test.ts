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

  it('duplicateNote adds an offset copy with the same text, color and size, in front', async () => {
    db.addCanvasNote.mockResolvedValue(11);
    const { result } = renderHook(() => useCanvasNotes());
    await waitFor(() => expect(result.current.notes).toHaveLength(2));
    let id: number | null = null;
    await act(async () => { id = await result.current.duplicateNote(1); });
    expect(id).toBe(11);
    expect(db.addCanvasNote).toHaveBeenCalledWith(7, '#ffcc33', { x: 24, y: 24, w: 260, h: 200 }, 'hi');
    expect(result.current.notes.at(-1)).toEqual({ id: 11, content: 'hi', color: '#ffcc33', x: 24, y: 24, w: 260, h: 200, sort_order: 4 });
  });

  it('duplicateNote does nothing for an unknown note', async () => {
    const { result } = renderHook(() => useCanvasNotes());
    await waitFor(() => expect(result.current.notes).toHaveLength(2));
    let id: number | null = 0;
    await act(async () => { id = await result.current.duplicateNote(999); });
    expect(id).toBeNull();
    expect(db.addCanvasNote).not.toHaveBeenCalled();
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
