import type { SessionRewardInput, SessionRewardOutput, ToolDefinition, ObjectiveBountyInput, ObjectiveBountyOutput } from '../types';

/**
 * Pure functions for the FocusForge game economy.
 * No side effects, no DB access — fully testable.
 */

export function calculateSessionReward(input: SessionRewardInput): SessionRewardOutput {
  const minutes = Math.floor(input.durationSeconds / 60);

  // Base: 1 coin per minute
  const base = minutes;

  // Milestone multiplier based on duration thresholds
  let milestoneMult = 1.0;
  let milestoneName = 'NONE';
  if (minutes >= 60) {
    milestoneMult = 2.0;
    milestoneName = 'SUPER_FORGE';
  } else if (minutes >= 30) {
    milestoneMult = 1.5;
    milestoneName = 'DEEP_FOCUS';
  } else if (minutes >= 15) {
    milestoneMult = 1.2;
    milestoneName = 'FOCUS_LOCKED';
  }

  // Pause penalty: -0.05x per pause (minimum 0.5x floor so pauses hurt but don't zero out)
  const pausePenalty = Math.min(input.pauseCount * 0.05, 0.5);
  const pauseAdjustedMult = Math.max(milestoneMult - pausePenalty, 0.5);

  // Only sessions 30+ min count toward daily challenge
  const countsForProgress = minutes >= 30;

  // Streak multiplier: based on consecutive days of completed daily challenges
  // Day 1 = 1.0x, Day 2 = 1.5x, Day 3 = 2.0x, Day 4 = 3.0x
  const streakMult = getStreakMultiplier(input.currentStreakDays);

  // Daily challenge: 3+ qualifying sessions (30+ min) today → 2x
  const sessionsTodayAfter = countsForProgress ? input.sessionsToday + 1 : input.sessionsToday;
  const dailyMult = sessionsTodayAfter >= 3 ? 2.0 : 1.0;
  const dailyJustCompleted = countsForProgress && input.sessionsToday < 3 && sessionsTodayAfter >= 3;

  // Active tool multiplier: sum of all active tool percents
  const activePercent = input.ownedActiveToolPercents.reduce((sum, p) => sum + p, 0);
  const activeMult = 1.0 + activePercent / 100;

  const total = Math.round(base * pauseAdjustedMult * streakMult * dailyMult * activeMult);

  return {
    baseCoins: base,
    durationMinutes: minutes,
    milestoneMultiplier: milestoneMult,
    milestoneName,
    pausePenalty,
    streakMultiplier: streakMult,
    dailyBonusMultiplier: dailyMult,
    activeToolMultiplier: activeMult,
    totalCoins: total,
    dailyChallengeJustCompleted: dailyJustCompleted,
    countsForProgress,
  };
}

export function calculateObjectiveBounty(input: ObjectiveBountyInput): ObjectiveBountyOutput {
  const streakMult = getStreakMultiplier(input.currentStreakDays);
  const activePercent = input.ownedActiveToolPercents.reduce((sum, p) => sum + p, 0);
  const activeMult = 1.0 + activePercent / 100;
  const total = Math.round(input.baseBounty * streakMult * activeMult);

  return {
    baseBounty: input.baseBounty,
    streakMultiplier: streakMult,
    activeToolMultiplier: activeMult,
    totalCoins: total,
  };
}

export function calculatePassiveIncomePerHour(ownedPassiveTools: ToolDefinition[]): number {
  return ownedPassiveTools.reduce((sum, tool) => sum + tool.passive_per_hour, 0);
}

export function getStreakExtendCost(currentStreakDays: number): number {
  return 100 + currentStreakDays * 50;
}

/**
 * Streak multiplier based on consecutive days of completed daily challenges.
 * Day 1 (first day, no prior completions) = 1.0x
 * Day 2 = 1.5x, Day 3 = 2.0x, Day 4 = 3.0x
 */
export function getStreakMultiplier(currentStreakDays: number): number {
  const multipliers: Record<number, number> = { 0: 1.0, 1: 1.0, 2: 1.5, 3: 2.0, 4: 3.0 };
  return multipliers[Math.min(currentStreakDays, 4)] ?? 1.0;
}

/** Returns quarter number (1-4) for a date. */
export function getQuarter(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

/** Returns season label like "S2 2026". */
export function getSeasonLabel(seasonNumber: number, year: number): string {
  return `S${seasonNumber} ${year}`;
}

/** Returns themed season name based on quarter. */
export function getSeasonName(seasonNumber: number): string {
  const names: Record<number, string> = {
    1: 'Spring Focused',
    2: 'Summer Grind',
    3: 'Fall Steady',
    4: 'Winter Peak',
  };
  return names[seasonNumber] || 'Unknown Season';
}

/** Returns badge color hex based on quarter. */
export function getSeasonBadgeColor(seasonNumber: number): string {
  const colors: Record<number, string> = {
    1: '#4ade80', // green
    2: '#f0c040', // gold
    3: '#ee682b', // orange
    4: '#00f2ff', // blue/cyan
  };
  return colors[seasonNumber] || '#ffffff';
}

/** Returns start and end dates for a given quarter/year. */
export function getSeasonDates(seasonNumber: number, year: number): { start: string; end: string } {
  const starts: Record<number, string> = {
    1: `${year}-01-01`,
    2: `${year}-04-01`,
    3: `${year}-07-01`,
    4: `${year}-10-01`,
  };
  const ends: Record<number, string> = {
    1: `${year}-03-31`,
    2: `${year}-06-30`,
    3: `${year}-09-30`,
    4: `${year}-12-31`,
  };
  return { start: starts[seasonNumber], end: ends[seasonNumber] };
}

/** Calculates days remaining in a season. */
export function getSeasonDaysRemaining(endDate: string): number {
  const end = new Date(endDate + 'T23:59:59');
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/** Checks if a date is a work day (Mon-Fri). */
export function isWorkDay(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

/**
 * Gets the previous work day from a given date.
 * Friday → Thursday, Monday → Friday, etc.
 */
export function getPreviousWorkDay(date: Date): Date {
  const prev = new Date(date);
  prev.setDate(prev.getDate() - 1);
  // Skip weekends backwards
  while (prev.getDay() === 0 || prev.getDay() === 6) {
    prev.setDate(prev.getDate() - 1);
  }
  return prev;
}

/** Format a date as YYYY-MM-DD. */
export function formatDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
