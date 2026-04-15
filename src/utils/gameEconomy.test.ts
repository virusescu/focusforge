import { describe, it, expect } from 'vitest';
import {
  calculateSessionReward,
  calculatePassiveIncomePerHour,
  getStreakExtendCost,
  getStreakMultiplier,
  getQuarter,
  getSeasonLabel,
  getSeasonName,
  getSeasonBadgeColor,
  getSeasonDates,
  getSeasonDaysRemaining,
  isWorkDay,
  getPreviousWorkDay,
  getNextWorkDay,
  formatDateStr,
} from './gameEconomy';
import type { ToolDefinition } from '../types';

describe('calculateSessionReward', () => {
  const baseInput = {
    durationSeconds: 1800, // 30 min
    pauseCount: 0,
    currentStreakDays: 0,
    streaksCompletedThisSeason: 0,
    sessionsToday: 0,
    ownedActiveToolPercents: [],
  };

  it('awards 1 coin per minute as base', () => {
    const result = calculateSessionReward(baseInput);
    expect(result.baseCoins).toBe(30); // 30 min = 30 coins
    expect(result.durationMinutes).toBe(30);
  });

  it('awards no milestone for sub-15min sessions', () => {
    const result = calculateSessionReward({ ...baseInput, durationSeconds: 600 }); // 10 min
    expect(result.milestoneMultiplier).toBe(1.0);
    expect(result.milestoneName).toBe('NONE');
    expect(result.totalCoins).toBe(10); // 10 * 1.0
    expect(result.countsForProgress).toBe(false);
  });

  it('applies 1.2x FOCUS_LOCKED at 15+ minutes but does NOT count for progress', () => {
    const result = calculateSessionReward({ ...baseInput, durationSeconds: 900 }); // 15 min
    expect(result.milestoneMultiplier).toBe(1.2);
    expect(result.milestoneName).toBe('FOCUS_LOCKED');
    expect(result.totalCoins).toBe(18); // 15 * 1.2
    expect(result.countsForProgress).toBe(false); // need 30+ min
  });

  it('sub-30min sessions do not count toward daily challenge', () => {
    const result = calculateSessionReward({ ...baseInput, durationSeconds: 1500, sessionsToday: 2 }); // 25 min, 2 prior
    expect(result.countsForProgress).toBe(false);
    expect(result.dailyChallengeJustCompleted).toBe(false);
    expect(result.dailyBonusMultiplier).toBe(1.0);
  });

  it('sub-30min sessions benefit from already-active daily bonus', () => {
    const result = calculateSessionReward({ ...baseInput, durationSeconds: 600, sessionsToday: 3 }); // 10 min, 3 prior
    expect(result.countsForProgress).toBe(false);
    expect(result.dailyBonusMultiplier).toBe(2.0);
    expect(result.totalCoins).toBe(20); // 10 * 1.0 * 2.0
  });

  it('applies 1.5x DEEP_FOCUS at 30+ minutes and counts for progress', () => {
    const result = calculateSessionReward(baseInput); // 30 min
    expect(result.milestoneMultiplier).toBe(1.5);
    expect(result.milestoneName).toBe('DEEP_FOCUS');
    expect(result.totalCoins).toBe(45); // 30 * 1.5
    expect(result.countsForProgress).toBe(true);
  });

  it('applies 2.0x SUPER_FORGE at 60+ minutes', () => {
    const result = calculateSessionReward({ ...baseInput, durationSeconds: 3600 }); // 60 min
    expect(result.milestoneMultiplier).toBe(2.0);
    expect(result.milestoneName).toBe('SUPER_FORGE');
    expect(result.totalCoins).toBe(120); // 60 * 2.0
  });

  it('scales with extra minutes past milestones', () => {
    const result = calculateSessionReward({ ...baseInput, durationSeconds: 5400 }); // 90 min
    expect(result.baseCoins).toBe(90);
    expect(result.milestoneMultiplier).toBe(2.0);
    expect(result.totalCoins).toBe(180); // 90 * 2.0
  });

  it('applies pause penalty of -0.05x per pause', () => {
    const result = calculateSessionReward({ ...baseInput, pauseCount: 2 }); // 30 min, 2 pauses
    expect(result.pausePenalty).toBeCloseTo(0.1);
    // milestone = 1.5, after penalty = 1.4
    expect(result.totalCoins).toBe(42); // 30 * 1.4
  });

  it('caps pause penalty at 0.5 (floor multiplier at 0.5x)', () => {
    const result = calculateSessionReward({ ...baseInput, pauseCount: 20 }); // 30 min, many pauses
    expect(result.pausePenalty).toBe(0.5);
    // milestone = 1.5, penalty = 0.5, adjusted = max(1.5 - 0.5, 0.5) = 1.0
    expect(result.totalCoins).toBe(30); // 30 * 1.0
  });

  it('pause penalty cannot push below 0.5x floor', () => {
    // 10 min (1.0x milestone) with 20 pauses
    const result = calculateSessionReward({ ...baseInput, durationSeconds: 600, pauseCount: 20 });
    // milestone = 1.0, penalty = 0.5, adjusted = max(1.0 - 0.5, 0.5) = 0.5
    expect(result.totalCoins).toBe(5); // 10 * 0.5
  });

  it('streak day 1 gives 1.0x (no bonus on first day)', () => {
    const result = calculateSessionReward({ ...baseInput, currentStreakDays: 1 });
    expect(result.streakMultiplier).toBe(1.0);
    expect(result.totalCoins).toBe(45); // 30 * 1.5 * 1.0
  });

  it('streak day 2 gives 1.5x', () => {
    const result = calculateSessionReward({ ...baseInput, currentStreakDays: 2 });
    expect(result.streakMultiplier).toBe(1.5);
    // 30 * 1.5 (milestone) * 1.5 (streak) = 67.5 → 68
    expect(result.totalCoins).toBe(68);
  });

  it('streak day 3 gives 2.0x', () => {
    const result = calculateSessionReward({ ...baseInput, currentStreakDays: 3 });
    expect(result.streakMultiplier).toBe(2.0);
    // 30 * 1.5 * 2.0 = 90
    expect(result.totalCoins).toBe(90);
  });

  it('streak day 4 gives 3.0x', () => {
    const result = calculateSessionReward({ ...baseInput, currentStreakDays: 4 });
    expect(result.streakMultiplier).toBe(3.0);
    // 30 * 1.5 * 3.0 = 135
    expect(result.totalCoins).toBe(135);
  });

  it('applies daily bonus when reaching 3 qualifying sessions', () => {
    const result = calculateSessionReward({ ...baseInput, sessionsToday: 2 }); // 30 min, 2 prior qualifying
    expect(result.dailyBonusMultiplier).toBe(2.0);
    expect(result.dailyChallengeJustCompleted).toBe(true);
    // 30 * 1.5 * 2.0 = 90
    expect(result.totalCoins).toBe(90);
  });

  it('applies daily bonus when already above 3 sessions', () => {
    const result = calculateSessionReward({ ...baseInput, sessionsToday: 5 });
    expect(result.dailyBonusMultiplier).toBe(2.0);
    expect(result.dailyChallengeJustCompleted).toBe(false);
  });

  it('does NOT apply daily bonus below 3 sessions', () => {
    const result = calculateSessionReward({ ...baseInput, sessionsToday: 0 });
    expect(result.dailyBonusMultiplier).toBe(1.0);
    expect(result.dailyChallengeJustCompleted).toBe(false);
  });

  it('applies active tool multiplier', () => {
    const result = calculateSessionReward({
      ...baseInput,
      ownedActiveToolPercents: [15, 25],
    });
    expect(result.activeToolMultiplier).toBe(1.4);
    // 30 * 1.5 * 1.4 = 63
    expect(result.totalCoins).toBe(63);
  });

  it('stacks all multipliers correctly', () => {
    const result = calculateSessionReward({
      durationSeconds: 3600,  // 60 min → 2.0x SUPER_FORGE
      pauseCount: 0,
      currentStreakDays: 4,   // streak day 4: 3.0x
      streaksCompletedThisSeason: 2,
      sessionsToday: 2,       // daily bonus: 2.0x
      ownedActiveToolPercents: [15, 25], // tools: 1.4x
    });
    // 60 * 2.0 * 3.0 * 2.0 * 1.4 = 1008
    expect(result.totalCoins).toBe(1008);
  });
});

describe('calculatePassiveIncomePerHour', () => {
  it('returns 0 with no tools', () => {
    expect(calculatePassiveIncomePerHour([])).toBe(0);
  });

  it('sums passive tool income', () => {
    const tools = [
      { passive_per_hour: 5 },
      { passive_per_hour: 10 },
      { passive_per_hour: 20 },
    ] as ToolDefinition[];
    expect(calculatePassiveIncomePerHour(tools)).toBe(35);
  });
});

describe('getStreakExtendCost', () => {
  it('returns correct costs for each streak day', () => {
    expect(getStreakExtendCost(0)).toBe(100);
    expect(getStreakExtendCost(1)).toBe(150);
    expect(getStreakExtendCost(2)).toBe(200);
    expect(getStreakExtendCost(3)).toBe(250);
    expect(getStreakExtendCost(4)).toBe(300);
  });
});

describe('getStreakMultiplier', () => {
  it('returns 1.0x at day 0', () => {
    expect(getStreakMultiplier(0)).toBe(1.0);
  });

  it('returns 1.0x at day 1 (first day, no prior dailies)', () => {
    expect(getStreakMultiplier(1)).toBe(1.0);
  });

  it('returns 1.5x at day 2', () => {
    expect(getStreakMultiplier(2)).toBe(1.5);
  });

  it('returns 2.0x at day 3', () => {
    expect(getStreakMultiplier(3)).toBe(2.0);
  });

  it('returns 3.0x at day 4', () => {
    expect(getStreakMultiplier(4)).toBe(3.0);
  });
});

describe('season utility functions', () => {
  it('getQuarter returns correct quarter', () => {
    expect(getQuarter(new Date('2026-01-15'))).toBe(1);
    expect(getQuarter(new Date('2026-04-01'))).toBe(2);
    expect(getQuarter(new Date('2026-07-31'))).toBe(3);
    expect(getQuarter(new Date('2026-12-25'))).toBe(4);
  });

  it('getSeasonLabel returns formatted label', () => {
    expect(getSeasonLabel(2, 2026)).toBe('S2 2026');
  });

  it('getSeasonName returns themed name', () => {
    expect(getSeasonName(1)).toBe('Spring Focused');
    expect(getSeasonName(2)).toBe('Summer Grind');
    expect(getSeasonName(3)).toBe('Fall Steady');
    expect(getSeasonName(4)).toBe('Winter Peak');
  });

  it('getSeasonBadgeColor returns correct colors', () => {
    expect(getSeasonBadgeColor(1)).toBe('#4ade80');
    expect(getSeasonBadgeColor(2)).toBe('#f0c040');
    expect(getSeasonBadgeColor(3)).toBe('#ee682b');
    expect(getSeasonBadgeColor(4)).toBe('#00f2ff');
  });

  it('getSeasonDates returns correct date range', () => {
    const q2 = getSeasonDates(2, 2026);
    expect(q2.start).toBe('2026-04-01');
    expect(q2.end).toBe('2026-06-30');
  });

  it('getSeasonDaysRemaining returns positive for future dates', () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const endStr = formatDateStr(future);
    expect(getSeasonDaysRemaining(endStr)).toBeGreaterThan(0);
  });

  it('getSeasonDaysRemaining returns 0 for past dates', () => {
    expect(getSeasonDaysRemaining('2020-01-01')).toBe(0);
  });
});

describe('work day functions', () => {
  it('isWorkDay returns true for Mon-Fri', () => {
    // 2026-04-06 is a Monday
    expect(isWorkDay(new Date('2026-04-06'))).toBe(true);
    expect(isWorkDay(new Date('2026-04-10'))).toBe(true); // Friday
  });

  it('isWorkDay returns false for weekends', () => {
    expect(isWorkDay(new Date('2026-04-11'))).toBe(false); // Saturday
    expect(isWorkDay(new Date('2026-04-12'))).toBe(false); // Sunday
  });

  it('getPreviousWorkDay skips weekends', () => {
    // Monday → Friday
    const friday = getPreviousWorkDay(new Date('2026-04-06'));
    expect(friday.getDay()).toBe(5); // Friday
  });

  it('getPreviousWorkDay returns previous day mid-week', () => {
    // Wednesday → Tuesday
    const tue = getPreviousWorkDay(new Date('2026-04-08'));
    expect(tue.getDay()).toBe(2); // Tuesday
  });

  it('formatDateStr formats correctly', () => {
    expect(formatDateStr(new Date('2026-04-06'))).toBe('2026-04-06');
  });
});

describe('getNextWorkDay', () => {
  it('advances Monday to Tuesday', () => {
    const mon = new Date('2026-04-13'); // Monday
    const result = getNextWorkDay(mon);
    expect(result.getDay()).toBe(2); // Tuesday
    expect(formatDateStr(result)).toBe('2026-04-14');
  });

  it('advances Friday to next Monday (skips weekend)', () => {
    const fri = new Date('2026-04-17'); // Friday
    const result = getNextWorkDay(fri);
    expect(result.getDay()).toBe(1); // Monday
    expect(formatDateStr(result)).toBe('2026-04-20');
  });

  it('advances Saturday to Monday (skips rest of weekend)', () => {
    const sat = new Date('2026-04-18'); // Saturday
    const result = getNextWorkDay(sat);
    expect(result.getDay()).toBe(1); // Monday
    expect(formatDateStr(result)).toBe('2026-04-20');
  });

  it('advances Sunday to Monday', () => {
    const sun = new Date('2026-04-19'); // Sunday
    const result = getNextWorkDay(sun);
    expect(result.getDay()).toBe(1); // Monday
    expect(formatDateStr(result)).toBe('2026-04-20');
  });

  it('advances Thursday to Friday', () => {
    const thu = new Date('2026-04-16'); // Thursday
    const result = getNextWorkDay(thu);
    expect(result.getDay()).toBe(5); // Friday
    expect(formatDateStr(result)).toBe('2026-04-17');
  });
});
