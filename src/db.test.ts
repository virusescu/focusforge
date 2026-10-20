import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecute } = vi.hoisted(() => {
  return {
    mockExecute: vi.fn(),
  };
});

vi.mock('@libsql/client', () => ({
  createClient: vi.fn().mockReturnValue({
    execute: mockExecute,
  }),
}));

import { initDbClient, saveFocusSession, getRecentSessions, deleteFocusSession, getObjectives, addObjective, deleteObjective, completeObjective, getKillRate, getAllSessions, getFragmentationStats, getAlarms, addAlarm, toggleAlarm, deleteAlarm, ensureSystemBuckets, getBuckets, deleteBucket, moveObjectiveToBucket, reorderBucketObjectives, bringBucketToFront, getCanvasNotes, addCanvasNote, updateCanvasNoteContent, updateCanvasNoteGeometry, bringCanvasNoteToFront, deleteCanvasNote } from './db';

describe('db utility functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initDbClient('libsql://test.turso.io', 'test-token');
  });

  describe('Focus Session Methods', () => {
    it('saveFocusSession should extract date and execute insert', async () => {
      const startTime = '2024-03-24T12:00:00.000Z';
      const duration = 3600;
      mockExecute.mockResolvedValueOnce({ lastInsertRowid: BigInt(1), rowsAffected: 1, rows: [] });

      await saveFocusSession(1, startTime, duration);

      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('INSERT INTO focus_sessions'),
        args: [1, startTime, duration, '2024-03-24'],
      });
    });

    it('getRecentSessions should call execute with user_id and limit', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [], rowsAffected: 0 });

      await getRecentSessions(1, 5);

      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('WHERE user_id = ?'),
        args: [1, 5],
      });
    });

    it('deleteFocusSession deletes pause records before the session', async () => {
      mockExecute.mockResolvedValue({ rows: [], rowsAffected: 1 });

      await deleteFocusSession(42);

      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('DELETE FROM session_pauses WHERE session_id = ?'),
        args: [42],
      });
      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('DELETE FROM focus_sessions WHERE id = ?'),
        args: [42],
      });
    });
  });

  describe('Strategic Objective Methods', () => {
    it('getObjectives filters out completed objectives for a user', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [], rowsAffected: 0 });

      await getObjectives(1);

      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('WHERE user_id = ? AND completed_at IS NULL'),
        args: [1],
      });
    });

    it('completeObjective sets completed_at timestamp and clears details', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-25T14:30:00.000Z'));
      mockExecute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 });

      await completeObjective(42);

      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('UPDATE objectives SET completed_at = ?, details = NULL'),
        args: ['2026-03-25T14:30:00.000Z', 42],
      });

      vi.useRealTimers();
    });

    it('addObjective inserts with user_id', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [{ maxOrder: 0 }], rowsAffected: 0 })
        .mockResolvedValueOnce({ rows: [{ id: 2 }], rowsAffected: 0 })
        .mockResolvedValueOnce({ rows: [{ maxOrder: null }], rowsAffected: 0 })
        .mockResolvedValueOnce({ lastInsertRowid: BigInt(123), rows: [], rowsAffected: 1 });

      const id = await addObjective(1, 'Test Objective');

      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('INSERT INTO objectives (user_id, text, sort_order, category_id, is_mission, bucket_id, bucket_sort_order)'),
        args: [1, 'Test Objective', 1, null, 1, 2, 0],
      });
      expect(id).toBe(123);
    });

    it('deleteObjective should call execute with delete query and id', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 });

      await deleteObjective(42);

      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('DELETE FROM objectives WHERE id = ?'),
        args: [42],
      });
    });
  });

  describe('Intelligence Hub Queries', () => {
    it('getKillRate returns day, week, and allTime counts for a user', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-30T12:00:00.000Z'));

      mockExecute
        .mockResolvedValueOnce({ rows: [{ count: 3 }] })
        .mockResolvedValueOnce({ rows: [{ count: 12 }] })
        .mockResolvedValueOnce({ rows: [{ count: 45 }] });

      const result = await getKillRate(1);

      expect(result).toEqual({ day: 3, week: 12, allTime: 45 });
      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining("user_id = ? AND completed_at IS NOT NULL"),
        args: expect.arrayContaining([1]),
      });

      vi.useRealTimers();
    });

    it('getAllSessions returns all sessions for a user sorted by start_time ASC', async () => {
      const mockData = [
        { id: 1, start_time: '2026-03-20T09:00:00.000Z', duration_seconds: 1800, date: '2026-03-20' },
      ];
      mockExecute.mockResolvedValueOnce({ rows: mockData });

      const result = await getAllSessions(1);

      expect(result).toEqual(mockData);
      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('WHERE user_id = ? ORDER BY start_time ASC'),
        args: [1],
      });
    });

    it('getFragmentationStats returns pause counts for a user', async () => {
      const mockData = [
        { session_id: 1, pause_count: 0 },
        { session_id: 2, pause_count: 3 },
      ];
      mockExecute.mockResolvedValueOnce({ rows: mockData });

      const result = await getFragmentationStats(1);

      expect(result).toEqual(mockData);
      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('WHERE fs.user_id = ?'),
        args: [1],
      });
    });
  });

  describe('Alarms Methods', () => {
    it('getAlarms returns all alarms for a user', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [], rowsAffected: 0 });

      await getAlarms(1);

      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('SELECT * FROM alarms WHERE user_id = ?'),
        args: [1],
      });
    });

    it('addAlarm inserts a new alarm', async () => {
      mockExecute.mockResolvedValueOnce({ lastInsertRowid: BigInt(123), rowsAffected: 1, rows: [] });

      const id = await addAlarm(1, 'Wake Up', '08:00', [1, 2, 3, 4, 5]);

      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('INSERT INTO alarms (user_id, title, time, days_of_week, is_active)'),
        args: [1, 'Wake Up', '08:00', '[1,2,3,4,5]'],
      });
      expect(id).toBe(123);
    });

    it('toggleAlarm updates the is_active status', async () => {
      mockExecute.mockResolvedValueOnce({ rowsAffected: 1, rows: [] });

      await toggleAlarm(42, true);

      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('UPDATE alarms SET is_active = ? WHERE id = ?'),
        args: [1, 42],
      });
    });

    it('deleteAlarm removes an alarm by id', async () => {
      mockExecute.mockResolvedValueOnce({ rowsAffected: 1, rows: [] });

      await deleteAlarm(42);

      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('DELETE FROM alarms WHERE id = ?'),
        args: [42],
      });
    });
  });

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
        sql: expect.stringContaining('INTO buckets'),
        args: expect.arrayContaining([7, 'mission']),
      }));
      expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({
        sql: expect.stringContaining('INTO buckets'),
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
      expect(sqls.some(s => s.includes('INTO buckets'))).toBe(false);
    });

    it('ensureSystemBuckets inserts with OR IGNORE so concurrent calls cannot duplicate', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [], rowsAffected: 0 })
        .mockResolvedValueOnce({ rows: [], rowsAffected: 1 })
        .mockResolvedValueOnce({ rows: [], rowsAffected: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 2 }], rowsAffected: 0 })
        .mockResolvedValueOnce({ rows: [], rowsAffected: 0 });

      await ensureSystemBuckets(7);

      const inserts = mockExecute.mock.calls
        .map(c => (c[0] as { sql: string }).sql)
        .filter(s => s.includes('INTO buckets'));
      expect(inserts).toHaveLength(2);
      for (const sql of inserts) expect(sql).toMatch(/^INSERT OR IGNORE INTO buckets/);
    });

    it('ensureSystemBuckets shares one run between overlapping calls for the same user', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [], rowsAffected: 0 })
        .mockResolvedValueOnce({ rows: [], rowsAffected: 1 })
        .mockResolvedValueOnce({ rows: [], rowsAffected: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 2 }], rowsAffected: 0 })
        .mockResolvedValueOnce({ rows: [], rowsAffected: 0 });

      await Promise.all([ensureSystemBuckets(7), ensureSystemBuckets(7)]);

      expect(mockExecute).toHaveBeenCalledTimes(5);
    });

    it('ensureSystemBuckets resolves the Unsorted id deterministically', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [{ kind: 'mission' }, { kind: 'unsorted' }], rowsAffected: 0 })
        .mockResolvedValueOnce({ rows: [{ id: 2 }], rowsAffected: 0 })
        .mockResolvedValueOnce({ rows: [], rowsAffected: 0 });

      await ensureSystemBuckets(7);

      expect(mockExecute).toHaveBeenNthCalledWith(2, {
        sql: expect.stringContaining("kind = 'unsorted' ORDER BY id ASC LIMIT 1"),
        args: [7],
      });
    });

    it('deleteBucket appends moved objectives after the existing Unsorted ones', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [{ user_id: 7, kind: 'custom' }], rowsAffected: 0 })
        .mockResolvedValueOnce({ rows: [{ id: 2 }], rowsAffected: 0 })
        .mockResolvedValueOnce({ rows: [{ maxOrder: 2, minOrder: 0 }], rowsAffected: 0 })
        .mockResolvedValueOnce({ rows: [], rowsAffected: 4 })
        .mockResolvedValueOnce({ rows: [], rowsAffected: 1 });

      await deleteBucket(9);

      // Unsorted max is 2 and the deleted bucket starts at 0, so its items shift by 3 (P=3, Q=4)
      expect(mockExecute).toHaveBeenNthCalledWith(4, {
        sql: expect.stringContaining('UPDATE objectives SET bucket_id = ?, bucket_sort_order = COALESCE(bucket_sort_order, 0) + ? WHERE bucket_id = ?'),
        args: [2, 3, 9],
      });
      expect(mockExecute).toHaveBeenNthCalledWith(5, {
        sql: expect.stringContaining('DELETE FROM buckets WHERE id = ?'),
        args: [9],
      });
    });

    it('deleteBucket handles an empty Unsorted and negative orders in the deleted bucket', async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [{ user_id: 7, kind: 'custom' }], rowsAffected: 0 })
        .mockResolvedValueOnce({ rows: [{ id: 2 }], rowsAffected: 0 })
        .mockResolvedValueOnce({ rows: [{ maxOrder: null, minOrder: -2 }], rowsAffected: 0 })
        .mockResolvedValueOnce({ rows: [], rowsAffected: 2 })
        .mockResolvedValueOnce({ rows: [], rowsAffected: 1 });

      await deleteBucket(9);

      expect(mockExecute).toHaveBeenNthCalledWith(4, expect.objectContaining({ args: [2, 2, 9] }));
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

    it('bringBucketToFront moves the bucket above all of the same user\'s buckets', async () => {
      mockExecute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 });
      await bringBucketToFront(9);
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringMatching(/UPDATE buckets SET sort_order = \(SELECT COALESCE\(MAX\(sort_order\), 0\) \+ 1 FROM buckets WHERE user_id = \(SELECT user_id FROM buckets WHERE id = \?\)\) WHERE id = \?/),
        args: [9, 9],
      });
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
});
