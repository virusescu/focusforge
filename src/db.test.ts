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

import { initDbClient, saveFocusSession, getRecentSessions, deleteFocusSession, getObjectives, addObjective, deleteObjective, completeObjective, getKillRate, getAllSessions, getFragmentationStats, getAlarms, addAlarm, toggleAlarm, deleteAlarm } from './db';

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
        .mockResolvedValueOnce({ lastInsertRowid: BigInt(123), rows: [], rowsAffected: 1 });

      const id = await addObjective(1, 'Test Objective');

      expect(mockExecute).toHaveBeenCalledWith({
        sql: expect.stringContaining('INSERT INTO objectives (user_id, text, sort_order, category_id, is_mission)'),
        args: [1, 'Test Objective', 1, null, 1],
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
});
