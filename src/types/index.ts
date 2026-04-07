import { LOG_MESSAGES } from '../logData';

export interface AuthUser {
  id: number;
  google_sub: string;
  email: string;
  name: string;
  avatar_url?: string;
}

export interface UserSettings {
  id: number;
  user_id: number;
  debug_speed: number;
  experience_lvl: number;
  day_start_hour: number;
  day_end_hour: number;
}

export interface LogEntry {
  id: string;
  time: string;
  msg: string;
  type: string;
}

export type LogCategory = keyof typeof LOG_MESSAGES;

export interface FocusSession {
  id: number;
  start_time: string;
  duration_seconds: number;
  date: string;
  pause_times?: string[];
}

export interface DailyStat {
  date: string;
  totalSeconds: number;
}

export interface ObjectiveCategory {
  id: number;
  label: string;
  color: string;
  sort_order: number;
  coin_bounty: number;
}

export interface StrategicObjective {
  id: number;
  text: string;
  created_at: string;
  completed_at?: string;
  sort_order?: number;
  category_id?: number | null;
}

// ─── Game Economy Types ─────────────────────────────────────────

export interface GameSeason {
  id: number;
  user_id: number;
  season_number: number;
  year: number;
  start_date: string;
  end_date: string;
  is_active: number;
}

export interface GameState {
  id: number;
  user_id: number;
  season_id: number;
  coins: number;
  total_coins_earned: number;
  current_streak_days: number;
  streak_last_date: string | null;
  streaks_completed: number;
  sessions_today: number;
  sessions_today_date: string | null;
  daily_bonus_active: number;
  peak_coins_per_hour: number;
}

export interface ToolDefinition {
  id: number;
  name: string;
  display_name: string;
  description: string;
  cost: number;
  effect_type: 'passive' | 'active' | 'prestige';
  passive_per_hour: number;
  active_percent: number;
  icon: string;
  unlock_order: number;
  prerequisite_id: number | null;
}

export interface PrestigeTitleDefinition {
  id: number;
  name: string;
  display_name: string;
  description: string;
  unlock_threshold: number;
  icon: string;
}

export interface CoinTransaction {
  id: number;
  user_id: number;
  season_id: number;
  amount: number;
  reason: string;
  metadata: string | null;
  created_at: string;
}

export interface SeasonArchive {
  id: number;
  user_id: number;
  season_id: number;
  season_label: string;
  season_name: string;
  badge_color: string;
  final_coins: number;
  total_coins_earned: number;
  total_sessions: number;
  total_streaks: number;
  tools_purchased: string;
  cosmetics_purchased: string;
  peak_coins_per_hour: number;
  longest_streak: number;
}

export interface StreakLogEntry {
  id: number;
  user_id: number;
  season_id: number;
  date: string;
  had_session: number;
  streak_day: number;
}

export interface RewardToastData {
  baseCoins: number;
  totalCoins: number;
  durationMinutes: number;
  milestoneMultiplier: number;
  milestoneName: string;
  pausePenalty: number;
  streakMultiplier: number;
  dailyBonusMultiplier: number;
  activeToolMultiplier: number;
  currentStreakDays: number;
  sessionsToday: number;
  dailyChallengeJustCompleted: boolean;
  streakJustCompleted: boolean;
  objectiveBounty?: {
    baseBounty: number;
    streakMultiplier: number;
    activeToolMultiplier: number;
  };
}

export interface ObjectiveBountyInput {
  baseBounty: number;
  currentStreakDays: number;
  ownedActiveToolPercents: number[];
}

export interface ObjectiveBountyOutput {
  baseBounty: number;
  streakMultiplier: number;
  activeToolMultiplier: number;
  totalCoins: number;
}

export interface SessionRewardInput {
  durationSeconds: number;
  pauseCount: number;
  currentStreakDays: number;
  streaksCompletedThisSeason: number;
  sessionsToday: number;
  ownedActiveToolPercents: number[];
}

export interface SessionRewardOutput {
  baseCoins: number;
  durationMinutes: number;
  milestoneMultiplier: number;
  milestoneName: string;
  pausePenalty: number;
  streakMultiplier: number;
  dailyBonusMultiplier: number;
  activeToolMultiplier: number;
  totalCoins: number;
  dailyChallengeJustCompleted: boolean;
  /** True if session is 15+ minutes — only these count toward daily challenge and streaks */
  countsForProgress: boolean;
}
