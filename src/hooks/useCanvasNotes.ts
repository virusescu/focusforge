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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
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
