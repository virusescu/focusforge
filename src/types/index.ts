import { LOG_MESSAGES } from '../logData';

export interface UserSettings {
  id: number;
  name: string;
  email: string;
  avatar_url?: string;
  debug_speed: number;
  experience_lvl: number;
}

export interface LogEntry {
  id: string;
  time: string;
  msg: string;
  type: string;
}

export type LogCategory = keyof typeof LOG_MESSAGES;
