import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGravatarUrl, saveFocusSession, getRecentSessions, getDailyFocusStats } from './db';

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
        expect.stringContaining('WHERE date >= $1'),
        ['2024-03-04']
      );
      
      vi.useRealTimers();
    });
  });
});
