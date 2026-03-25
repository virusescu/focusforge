import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGravatarUrl, saveFocusSession, getRecentSessions, getDailyFocusStats, getSessionsForDay, deleteFocusSession, getObjectives, addObjective, deleteObjective, completeObjective, getCompletedObjectivesForDay } from './db';

// Use vi.hoisted to ensure mocks are available when vi.mock is evaluated
const { mockExecute, mockSelect } = vi.hoisted(() => {
  return {
    mockExecute: vi.fn(),
    mockSelect: vi.fn(),
  };
});

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: {
    load: vi.fn().mockResolvedValue({
      execute: mockExecute,
      select: mockSelect,
    }),
  },
}));

describe('db utility functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGravatarUrl', () => {
    it('should generate a correct Gravatar URL for a given email', async () => {
      const url = await getGravatarUrl('test@example.com');
      expect(url).toBe('https://www.gravatar.com/avatar/973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b?d=identicon&s=200');
    });

    it('should trim and lowercase the email before hashing', async () => {
      const url1 = await getGravatarUrl('test@example.com');
      const url2 = await getGravatarUrl('  TEST@example.com ');
      expect(url1).toBe(url2);
    });
  });

  describe('Focus Session Methods', () => {
    it('saveFocusSession should extract date and execute insert', async () => {
      const startTime = '2024-03-24T12:00:00.000Z';
      const duration = 3600;
      mockExecute.mockResolvedValueOnce({ lastInsertId: 1, rowsAffected: 1 });

      await saveFocusSession(startTime, duration);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO focus_sessions'),
        [startTime, duration, '2024-03-24']
      );
    });

    it('getRecentSessions should call select with limit', async () => {
      await getRecentSessions(5);
      expect(mockSelect).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM focus_sessions'),
        [5]
      );
    });

    it('getDailyFocusStats should calculate start date correctly', async () => {
      // Mock "today" to be 2024-03-24
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-03-24'));
      
      await getDailyFocusStats(21);
      
      // 21 days including today (March 24) means starting from March 4
      expect(mockSelect).toHaveBeenCalledWith(
        expect.stringContaining("WHERE date(start_time, 'localtime') >= $1"),
        ['2024-03-04']
      );
      
      vi.useRealTimers();
    });

    it('getSessionsForDay should call select with selected date and next day', async () => {
      const testDate = '2024-03-24';
      mockSelect.mockResolvedValueOnce([]); // empty sessions → early return, no pauses query
      await getSessionsForDay(testDate);
      expect(mockSelect).toHaveBeenCalledWith(
        expect.stringContaining("datetime(start_time, 'localtime') >= $1"),
        [testDate, '2024-03-25', '08:00:00', '02:00:00']
      );
    });

    it('saveFocusSession inserts a session_pauses row for each pause time', async () => {
      mockExecute.mockResolvedValueOnce({ lastInsertId: 7, rowsAffected: 1 });

      await saveFocusSession(
        '2024-03-24T09:00:00.000Z',
        1800,
        ['2024-03-24T09:07:30.000Z', '2024-03-24T09:22:00.000Z']
      );

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO session_pauses'),
        [7, '2024-03-24T09:07:30.000Z']
      );
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO session_pauses'),
        [7, '2024-03-24T09:22:00.000Z']
      );
    });

    it('saveFocusSession with no pause times makes only one execute call', async () => {
      mockExecute.mockResolvedValueOnce({ lastInsertId: 8, rowsAffected: 1 });

      await saveFocusSession('2024-03-24T09:00:00.000Z', 1800);

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('getSessionsForDay fetches pause times and attaches them to sessions', async () => {
      mockSelect
        .mockResolvedValueOnce([
          { id: 1, start_time: '2024-03-24T09:00:00.000Z', duration_seconds: 1800, date: '2024-03-24' },
        ])
        .mockResolvedValueOnce([
          { session_id: 1, pause_time: '2024-03-24T09:07:30.000Z' },
          { session_id: 1, pause_time: '2024-03-24T09:22:00.000Z' },
        ]);

      const sessions = await getSessionsForDay('2024-03-24');

      expect(sessions[0].pause_times).toEqual([
        '2024-03-24T09:07:30.000Z',
        '2024-03-24T09:22:00.000Z',
      ]);
    });

    it('getSessionsForDay returns empty pause_times when no pauses exist', async () => {
      mockSelect
        .mockResolvedValueOnce([
          { id: 1, start_time: '2024-03-24T09:00:00.000Z', duration_seconds: 1800, date: '2024-03-24' },
        ])
        .mockResolvedValueOnce([]);

      const sessions = await getSessionsForDay('2024-03-24');

      expect(sessions[0].pause_times).toEqual([]);
    });

    it('deleteFocusSession deletes pause records before the session', async () => {
      await deleteFocusSession(42);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM session_pauses WHERE session_id = ?'),
        [42]
      );
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM focus_sessions WHERE id = ?'),
        [42]
      );
    });
  });

  describe('Strategic Objective Methods', () => {
    it('getObjectives filters out completed objectives', async () => {
      await getObjectives();
      expect(mockSelect).toHaveBeenCalledWith(
        expect.stringContaining('WHERE completed_at IS NULL')
      );
      expect(mockSelect).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY sort_order ASC')
      );
    });

    it('completeObjective sets completed_at timestamp on the row', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-25T14:30:00.000Z'));

      await completeObjective(42);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE objectives SET completed_at = ?'),
        ['2026-03-25T14:30:00.000Z', 42]
      );

      vi.useRealTimers();
    });

    it('getCompletedObjectivesForDay queries target date and next-day 02:00 window', async () => {
      mockSelect.mockResolvedValueOnce([]);
      await getCompletedObjectivesForDay('2026-03-24');
      expect(mockSelect).toHaveBeenCalledWith(
        expect.stringContaining('completed_at IS NOT NULL'),
        ['2026-03-24', '2026-03-25', '08:00:00', '02:00:00']
      );
    });

    it('getCompletedObjectivesForDay returns completed objectives', async () => {
      const mockData = [
        { id: 1, text: 'Ship feature', completed_at: '2026-03-24T10:30:00.000Z' }
      ];
      mockSelect.mockResolvedValueOnce(mockData);
      const result = await getCompletedObjectivesForDay('2026-03-24');
      expect(result).toEqual(mockData);
    });

    it('addObjective should call execute with insert query and text', async () => {
      mockSelect.mockResolvedValueOnce([{ n: 0 }]);
      mockExecute.mockResolvedValueOnce({ lastInsertId: 123 });
      const id = await addObjective('Test Objective');
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO objectives (text, sort_order) VALUES (?, ?)'),
        ['Test Objective', 0]
      );
      expect(id).toBe(123);
    });

    it('deleteObjective should call execute with delete query and id', async () => {
      await deleteObjective(42);
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM objectives WHERE id = ?'),
        [42]
      );
    });
  });
});
