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
}

export interface StrategicObjective {
  id: number;
  text: string;
  created_at: string;
  completed_at?: string;
  sort_order?: number;
  category_id?: number | null;
}
