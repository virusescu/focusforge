import { createClient, type Client, type InArgs } from '@libsql/client';
import type { FocusSession, DailyStat, StrategicObjective, ObjectiveCategory, AuthUser, UserSettings, GameSeason, GameState, ToolDefinition, PrestigeTitleDefinition, SeasonArchive, StreakLogEntry } from './types';
import { getQuarter, getSeasonDates, getSeasonLabel, getSeasonName, getSeasonBadgeColor } from './utils/gameEconomy';

let db: Client | null = null;

export function getDb(): Client {
  if (db) return db;
  db = createClient({
    url: import.meta.env.VITE_TURSO_DATABASE_URL,
    authToken: import.meta.env.VITE_TURSO_AUTH_TOKEN,
  });
  return db;
}

export async function initDb() {
  const database = getDb();

  await database.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_sub TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      debug_speed REAL DEFAULT 1.0,
      experience_lvl INTEGER DEFAULT 42,
      day_start_hour INTEGER DEFAULT 8,
      day_end_hour INTEGER DEFAULT 2,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS focus_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS objective_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS objectives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sort_order INTEGER DEFAULT 0,
      completed_at TEXT,
      category_id INTEGER REFERENCES objective_categories(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS session_pauses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      pause_time TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES focus_sessions(id)
    )
  `);

  // ─── Game Economy Tables ────────────────────────────────────────

  await database.execute(`
    CREATE TABLE IF NOT EXISTS game_seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      season_number INTEGER NOT NULL,
      year INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, season_number, year)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS game_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      season_id INTEGER NOT NULL,
      coins REAL NOT NULL DEFAULT 0,
      total_coins_earned REAL NOT NULL DEFAULT 0,
      current_streak_days INTEGER NOT NULL DEFAULT 0,
      streak_last_date TEXT,
      streaks_completed INTEGER NOT NULL DEFAULT 0,
      sessions_today INTEGER NOT NULL DEFAULT 0,
      sessions_today_date TEXT,
      daily_bonus_active INTEGER NOT NULL DEFAULT 0,
      peak_coins_per_hour REAL NOT NULL DEFAULT 0,
      UNIQUE(user_id, season_id)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS game_tool_definitions (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT NOT NULL,
      cost INTEGER NOT NULL,
      effect_type TEXT NOT NULL,
      passive_per_hour REAL NOT NULL DEFAULT 0,
      active_percent REAL NOT NULL DEFAULT 0,
      icon TEXT NOT NULL,
      unlock_order INTEGER NOT NULL,
      prerequisite_id INTEGER REFERENCES game_tool_definitions(id)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS game_owned_tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      season_id INTEGER NOT NULL,
      tool_id INTEGER NOT NULL,
      purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, season_id, tool_id)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS game_prestige_titles (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT NOT NULL,
      unlock_threshold INTEGER NOT NULL,
      icon TEXT NOT NULL
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS game_coin_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      season_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS game_season_archives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      season_id INTEGER NOT NULL,
      season_label TEXT NOT NULL,
      season_name TEXT NOT NULL,
      badge_color TEXT NOT NULL,
      final_coins REAL NOT NULL,
      total_coins_earned REAL NOT NULL,
      total_sessions INTEGER NOT NULL,
      total_streaks INTEGER NOT NULL,
      tools_purchased TEXT NOT NULL,
      cosmetics_purchased TEXT NOT NULL,
      peak_coins_per_hour REAL NOT NULL,
      longest_streak INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, season_id)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS game_streak_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      season_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      had_session INTEGER NOT NULL DEFAULT 0,
      streak_day INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, season_id, date)
    )
  `);

  await seedToolDefinitions();
  await seedPrestigeTitles();
}

// ─── User Management ─────────────────────────────────────────────

export async function upsertUser(googleSub: string, email: string, name: string, avatarUrl?: string): Promise<AuthUser> {
  const database = getDb();

  await database.execute({
    sql: `INSERT INTO users (google_sub, email, name, avatar_url)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(google_sub) DO UPDATE SET email = ?, name = ?, avatar_url = ?`,
    args: [googleSub, email, name, avatarUrl ?? null, email, name, avatarUrl ?? null],
  });

  const result = await database.execute({
    sql: 'SELECT * FROM users WHERE google_sub = ?',
    args: [googleSub],
  });

  const row = result.rows[0];
  return {
    id: row.id as number,
    google_sub: row.google_sub as string,
    email: row.email as string,
    name: row.name as string,
    avatar_url: row.avatar_url as string | undefined,
  };
}

// ─── User Settings ───────────────────────────────────────────────

export async function getUserSettings(userId: number): Promise<UserSettings | null> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM user_settings WHERE user_id = ?',
    args: [userId],
  });

  if (result.rows.length === 0) {
    // Create default settings for this user
    await database.execute({
      sql: 'INSERT INTO user_settings (user_id) VALUES (?)',
      args: [userId],
    });
    const created = await database.execute({
      sql: 'SELECT * FROM user_settings WHERE user_id = ?',
      args: [userId],
    });
    const row = created.rows[0];
    return {
      id: row.id as number,
      user_id: row.user_id as number,
      debug_speed: row.debug_speed as number,
      experience_lvl: row.experience_lvl as number,
      day_start_hour: row.day_start_hour as number,
      day_end_hour: row.day_end_hour as number,
    };
  }

  const row = result.rows[0];
  return {
    id: row.id as number,
    user_id: row.user_id as number,
    debug_speed: row.debug_speed as number,
    experience_lvl: row.experience_lvl as number,
    day_start_hour: row.day_start_hour as number,
    day_end_hour: row.day_end_hour as number,
  };
}

export async function updateUserSettings(userId: number, debugSpeed: number, experienceLvl: number, dayStartHour: number, dayEndHour: number) {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE user_settings SET debug_speed = ?, experience_lvl = ?, day_start_hour = ?, day_end_hour = ? WHERE user_id = ?',
    args: [debugSpeed, experienceLvl, dayStartHour, dayEndHour, userId],
  });
}

// ─── Focus Sessions ──────────────────────────────────────────────

export async function saveFocusSession(userId: number, startTime: string, durationSeconds: number, pauseTimes: string[] = []) {
  const database = getDb();
  const date = startTime.split('T')[0];
  const result = await database.execute({
    sql: 'INSERT INTO focus_sessions (user_id, start_time, duration_seconds, date) VALUES (?, ?, ?, ?)',
    args: [userId, startTime, durationSeconds, date],
  });
  const sessionId = result.lastInsertRowid;
  for (const pauseTime of pauseTimes) {
    await database.execute({
      sql: 'INSERT INTO session_pauses (session_id, pause_time) VALUES (?, ?)',
      args: [Number(sessionId), pauseTime],
    });
  }
}

export async function getRecentSessions(userId: number, limit: number = 3): Promise<FocusSession[]> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM focus_sessions WHERE user_id = ? ORDER BY start_time DESC LIMIT ?',
    args: [userId, limit],
  });
  return result.rows.map(row => ({
    id: row.id as number,
    start_time: row.start_time as string,
    duration_seconds: row.duration_seconds as number,
    date: row.date as string,
  }));
}

export async function getDailyFocusStats(userId: number, days: number = 21): Promise<DailyStat[]> {
  const database = getDb();
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  const startDateStr = d.toISOString().split('T')[0];

  const result = await database.execute({
    sql: `SELECT date(start_time, 'localtime') as date, SUM(duration_seconds) as totalSeconds
          FROM focus_sessions
          WHERE user_id = ? AND date(start_time, 'localtime') >= ?
          GROUP BY date
          ORDER BY date ASC`,
    args: [userId, startDateStr],
  });

  return result.rows.map(row => ({
    date: row.date as string,
    totalSeconds: row.totalSeconds as number,
  }));
}

export async function getSessionsForDay(userId: number, date: string, _startHour: number = 8, endHour: number = 2): Promise<FocusSession[]> {
  const database = getDb();

  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
  const endHourStr = String(endHour).padStart(2, '0') + ':00:00';

  const result = await database.execute({
    sql: `SELECT * FROM focus_sessions
          WHERE user_id = ?
            AND datetime(start_time, 'localtime') >= ? || ' 00:00:00'
            AND datetime(start_time, 'localtime') < ? || ' ' || ?
          ORDER BY start_time ASC`,
    args: [userId, date, nextDayStr, endHourStr],
  });

  const rows = result.rows.map(row => ({
    id: row.id as number,
    start_time: row.start_time as string,
    duration_seconds: row.duration_seconds as number,
    date: row.date as string,
  }));

  if (rows.length === 0) return [];

  const ids = rows.map(r => r.id);
  const placeholders = ids.map(() => '?').join(', ');
  const pauses = await database.execute({
    sql: `SELECT session_id, pause_time FROM session_pauses WHERE session_id IN (${placeholders}) ORDER BY pause_time ASC`,
    args: ids as InArgs,
  });

  const pauseMap = new Map<number, string[]>();
  for (const p of pauses.rows) {
    const sid = p.session_id as number;
    const pt = p.pause_time as string;
    if (!pauseMap.has(sid)) pauseMap.set(sid, []);
    pauseMap.get(sid)!.push(pt);
  }

  return rows.map(row => ({
    ...row,
    pause_times: pauseMap.get(row.id) || [],
  }));
}

export async function deleteFocusSession(id: number) {
  const database = getDb();
  await database.execute({ sql: 'DELETE FROM session_pauses WHERE session_id = ?', args: [id] });
  await database.execute({ sql: 'DELETE FROM focus_sessions WHERE id = ?', args: [id] });
}

export async function updateFocusSession(id: number, startTime: string, durationSeconds: number) {
  const database = getDb();
  const date = startTime.split('T')[0];
  await database.execute({
    sql: 'UPDATE focus_sessions SET start_time = ?, duration_seconds = ?, date = ? WHERE id = ?',
    args: [startTime, durationSeconds, date, id],
  });
}

export async function getGlobalStats(userId: number) {
  const database = getDb();

  const allTime = await database.execute({
    sql: 'SELECT SUM(duration_seconds) as allTimeTotal, MAX(duration_seconds) as allTimePeak FROM focus_sessions WHERE user_id = ?',
    args: [userId],
  });

  const dWeek = new Date();
  dWeek.setDate(dWeek.getDate() - 7);
  const weekStr = dWeek.toISOString().split('T')[0];
  const week = await database.execute({
    sql: "SELECT SUM(duration_seconds) as weekTotal FROM focus_sessions WHERE user_id = ? AND date(start_time, 'localtime') >= ?",
    args: [userId, weekStr],
  });

  const dMonth = new Date();
  dMonth.setDate(dMonth.getDate() - 30);
  const monthStr = dMonth.toISOString().split('T')[0];
  const month = await database.execute({
    sql: "SELECT SUM(duration_seconds) as monthTotal FROM focus_sessions WHERE user_id = ? AND date(start_time, 'localtime') >= ?",
    args: [userId, monthStr],
  });

  return {
    allTimeTotal: (allTime.rows[0]?.allTimeTotal as number) || 0,
    allTimePeak: (allTime.rows[0]?.allTimePeak as number) || 0,
    weekTotal: (week.rows[0]?.weekTotal as number) || 0,
    monthTotal: (month.rows[0]?.monthTotal as number) || 0,
  };
}

export async function getAllSessions(userId: number): Promise<FocusSession[]> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM focus_sessions WHERE user_id = ? ORDER BY start_time ASC',
    args: [userId],
  });
  return result.rows.map(row => ({
    id: row.id as number,
    start_time: row.start_time as string,
    duration_seconds: row.duration_seconds as number,
    date: row.date as string,
  }));
}

export async function getFragmentationStats(userId: number): Promise<{ session_id: number; pause_count: number }[]> {
  const database = getDb();
  const result = await database.execute({
    sql: `SELECT fs.id as session_id, COUNT(sp.id) as pause_count
          FROM focus_sessions fs
          LEFT JOIN session_pauses sp ON sp.session_id = fs.id
          WHERE fs.user_id = ?
          GROUP BY fs.id
          ORDER BY fs.start_time ASC`,
    args: [userId],
  });
  return result.rows.map(row => ({
    session_id: row.session_id as number,
    pause_count: row.pause_count as number,
  }));
}

// ─── Objective Categories ────────────────────────────────────────

export async function getCategories(userId: number): Promise<ObjectiveCategory[]> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM objective_categories WHERE user_id = ? ORDER BY sort_order ASC, id ASC',
    args: [userId],
  });
  return result.rows.map(row => ({
    id: row.id as number,
    label: row.label as string,
    color: row.color as string,
    sort_order: row.sort_order as number,
  }));
}

export async function seedDefaultCategories(userId: number): Promise<void> {
  const database = getDb();
  const countResult = await database.execute({
    sql: 'SELECT COUNT(*) as n FROM objective_categories WHERE user_id = ?',
    args: [userId],
  });
  if ((countResult.rows[0]?.n as number) === 0) {
    await database.execute({
      sql: 'INSERT INTO objective_categories (user_id, label, color, sort_order) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)',
      args: [userId, 'Hard', '#ff4444', 0, userId, 'Normal', '#ffffff', 1, userId, 'Easy', '#888888', 2],
    });
  }
}

export async function addCategory(userId: number, label: string, color: string): Promise<number> {
  const database = getDb();
  const countResult = await database.execute({
    sql: 'SELECT COUNT(*) as n FROM objective_categories WHERE user_id = ?',
    args: [userId],
  });
  const nextOrder = (countResult.rows[0]?.n as number) ?? 0;
  const result = await database.execute({
    sql: 'INSERT INTO objective_categories (user_id, label, color, sort_order) VALUES (?, ?, ?, ?)',
    args: [userId, label, color, nextOrder],
  });
  return Number(result.lastInsertRowid) ?? 0;
}

export async function updateCategory(id: number, label: string, color: string): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE objective_categories SET label = ?, color = ? WHERE id = ?',
    args: [label, color, id],
  });
}

export async function deleteCategory(id: number): Promise<void> {
  const database = getDb();
  await database.execute({ sql: 'UPDATE objectives SET category_id = NULL WHERE category_id = ?', args: [id] });
  await database.execute({ sql: 'DELETE FROM objective_categories WHERE id = ?', args: [id] });
}

// ─── Strategic Objectives ────────────────────────────────────────

export async function getObjectives(userId: number): Promise<StrategicObjective[]> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM objectives WHERE user_id = ? AND completed_at IS NULL ORDER BY sort_order ASC, id ASC',
    args: [userId],
  });
  return result.rows.map(row => ({
    id: row.id as number,
    text: row.text as string,
    created_at: row.created_at as string,
    completed_at: row.completed_at as string | undefined,
    sort_order: row.sort_order as number,
    category_id: row.category_id as number | null,
  }));
}

export async function addObjective(userId: number, text: string, categoryId?: number | null): Promise<number> {
  const database = getDb();
  const countResult = await database.execute({
    sql: 'SELECT COUNT(*) as n FROM objectives WHERE user_id = ?',
    args: [userId],
  });
  const nextOrder = (countResult.rows[0]?.n as number) ?? 0;
  const result = await database.execute({
    sql: 'INSERT INTO objectives (user_id, text, sort_order, category_id) VALUES (?, ?, ?, ?)',
    args: [userId, text, nextOrder, categoryId ?? null],
  });
  return Number(result.lastInsertRowid) ?? 0;
}

export async function deleteObjective(id: number) {
  const database = getDb();
  await database.execute({ sql: 'DELETE FROM objectives WHERE id = ?', args: [id] });
}

export async function updateObjective(id: number, text: string, categoryId?: number | null) {
  const database = getDb();
  if (categoryId !== undefined) {
    await database.execute({
      sql: 'UPDATE objectives SET text = ?, category_id = ? WHERE id = ?',
      args: [text, categoryId, id],
    });
  } else {
    await database.execute({
      sql: 'UPDATE objectives SET text = ? WHERE id = ?',
      args: [text, id],
    });
  }
}

export async function updateObjectiveCategory(id: number, categoryId: number | null): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE objectives SET category_id = ? WHERE id = ?',
    args: [categoryId, id],
  });
}

export async function updateObjectiveCompletedAt(id: number, completedAt: string): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE objectives SET completed_at = ? WHERE id = ?',
    args: [completedAt, id],
  });
}

export async function completeObjective(id: number): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE objectives SET completed_at = ? WHERE id = ?',
    args: [new Date().toISOString(), id],
  });
}

export async function reorderObjectives(orderedIds: number[]): Promise<void> {
  const database = getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await database.execute({
      sql: 'UPDATE objectives SET sort_order = ? WHERE id = ?',
      args: [i, orderedIds[i]],
    });
  }
}

export async function getCompletedObjectivesForDay(userId: number, date: string, startHour: number = 8, endHour: number = 2): Promise<StrategicObjective[]> {
  const database = getDb();

  const startHourStr = String(startHour).padStart(2, '0') + ':00:00';
  const endHourStr = String(endHour).padStart(2, '0') + ':00:00';

  const endDate = endHour > startHour ? date : (() => {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
  })();

  const result = await database.execute({
    sql: `SELECT id, text, completed_at, category_id FROM objectives
          WHERE user_id = ? AND completed_at IS NOT NULL
            AND datetime(completed_at, 'localtime') >= ? || ' ' || ?
            AND datetime(completed_at, 'localtime') < ? || ' ' || ?
          ORDER BY completed_at ASC`,
    args: [userId, date, startHourStr, endDate, endHourStr],
  });

  return result.rows.map(row => ({
    id: row.id as number,
    text: row.text as string,
    created_at: '',
    completed_at: row.completed_at as string,
    category_id: row.category_id as number | null,
  }));
}

export async function getKillRate(userId: number) {
  const database = getDb();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const dayResult = await database.execute({
    sql: "SELECT COUNT(*) as count FROM objectives WHERE user_id = ? AND completed_at IS NOT NULL AND date(completed_at, 'localtime') = ?",
    args: [userId, todayStr],
  });

  const dWeek = new Date();
  dWeek.setDate(dWeek.getDate() - 7);
  const weekStr = dWeek.toISOString().split('T')[0];
  const weekResult = await database.execute({
    sql: "SELECT COUNT(*) as count FROM objectives WHERE user_id = ? AND completed_at IS NOT NULL AND date(completed_at, 'localtime') >= ?",
    args: [userId, weekStr],
  });

  const allResult = await database.execute({
    sql: "SELECT COUNT(*) as count FROM objectives WHERE user_id = ? AND completed_at IS NOT NULL",
    args: [userId],
  });

  return {
    day: (dayResult.rows[0]?.count as number) || 0,
    week: (weekResult.rows[0]?.count as number) || 0,
    allTime: (allResult.rows[0]?.count as number) || 0,
  };
}

// ─── Game Economy: Seed Data ────────────────────────────────────

async function seedToolDefinitions() {
  const database = getDb();
  const tools = [
    [1, 'COFFEE_MAKER', 'Coffee Maker', '+5 coins/hour passive income', 200, 'passive', 5, 0, '☕', 1, null],
    [2, 'STANDING_DESK', 'Standing Desk', '+15% coins during active sessions', 300, 'active', 0, 15, '🖥️', 1, null],
    [3, 'ERGONOMIC_CHAIR', 'Ergonomic Chair', '+10 coins/hour passive income', 400, 'passive', 10, 0, '🪑', 2, 1],
    [4, 'NC_HEADPHONES', 'NC Headphones', '+25% coins during active sessions', 500, 'active', 0, 25, '🎧', 2, 2],
    [5, 'SECOND_MONITOR', 'Second Monitor', '+20 coins/hour passive income', 750, 'passive', 20, 0, '🖥️', 3, 3],
    [6, 'SMART_LIGHTING', 'Smart Lighting', '+30% coins during active sessions', 1000, 'active', 0, 30, '💡', 3, 4],
    [7, 'PRODUCTIVITY_SUITE', 'Productivity Suite', '+50 coins/hour passive income', 1500, 'passive', 50, 0, '📊', 4, 5],
    [8, 'ELITE_WORKSTATION', 'Elite Workstation', '+40% active + 100 coins/hr passive', 2000, 'prestige', 100, 40, '⚡', 5, null],
  ];
  for (const t of tools) {
    await database.execute({
      sql: `INSERT OR IGNORE INTO game_tool_definitions (id, name, display_name, description, cost, effect_type, passive_per_hour, active_percent, icon, unlock_order, prerequisite_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: t,
    });
  }
}

async function seedPrestigeTitles() {
  const database = getDb();
  const titles = [
    [1,  'INITIATE',          'Initiate',          'First steps into the forge',           100,   '🔰'],
    [2,  'OPERATOR',          'Operator',          'Learning the ropes',                   500,   '⚙️'],
    [3,  'FOCUSED',           'Focused',           'Concentration is becoming natural',    1500,  '🎯'],
    [4,  'DEEP_WORKER',       'Deep Worker',       'Master of sustained attention',        3500,  '🧠'],
    [5,  'STREAK_MASTER',     'Streak Master',     'Consistency is your weapon',           7000,  '🔥'],
    [6,  'FORGE_ADEPT',       'Forge Adept',       'The forge bends to your will',         12000, '⚒️'],
    [7,  'NEURAL_ARCHITECT',  'Neural Architect',  'Rewiring focus pathways',              20000, '🏗️'],
    [8,  'APEX_OPERATOR',     'Apex Operator',     'Peak performance unlocked',            30000, '💎'],
    [9,  'TRANSCENDENT',      'Transcendent',      'Beyond ordinary focus',                40000, '✨'],
    [10, 'FORGE_LEGEND',      'Forge Legend',      'The ultimate FocusForge operator',     50000, '⭐'],
  ];
  for (const t of titles) {
    await database.execute({
      sql: `INSERT OR IGNORE INTO game_prestige_titles (id, name, display_name, description, unlock_threshold, icon)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: t,
    });
  }
}

// ─── Game Economy: Season Management ────────────────────────────

export async function initOrGetActiveSeason(userId: number): Promise<GameSeason> {
  const database = getDb();

  // Check for existing active season
  const existing = await database.execute({
    sql: 'SELECT * FROM game_seasons WHERE user_id = ? AND is_active = 1',
    args: [userId],
  });

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    return {
      id: row.id as number,
      user_id: row.user_id as number,
      season_number: row.season_number as number,
      year: row.year as number,
      start_date: row.start_date as string,
      end_date: row.end_date as string,
      is_active: row.is_active as number,
    };
  }

  // Create new season for current quarter
  const now = new Date();
  const quarter = getQuarter(now);
  const year = now.getFullYear();
  const { start, end } = getSeasonDates(quarter, year);

  await database.execute({
    sql: `INSERT OR IGNORE INTO game_seasons (user_id, season_number, year, start_date, end_date, is_active)
          VALUES (?, ?, ?, ?, ?, 1)`,
    args: [userId, quarter, year, start, end],
  });

  const created = await database.execute({
    sql: 'SELECT * FROM game_seasons WHERE user_id = ? AND season_number = ? AND year = ?',
    args: [userId, quarter, year],
  });
  const row = created.rows[0];

  // Initialize game state for this season
  await database.execute({
    sql: `INSERT OR IGNORE INTO game_state (user_id, season_id) VALUES (?, ?)`,
    args: [userId, row.id as number],
  });

  return {
    id: row.id as number,
    user_id: row.user_id as number,
    season_number: row.season_number as number,
    year: row.year as number,
    start_date: row.start_date as string,
    end_date: row.end_date as string,
    is_active: row.is_active as number,
  };
}

export async function archiveSeason(userId: number, seasonId: number): Promise<void> {
  const database = getDb();

  const stateResult = await database.execute({
    sql: 'SELECT * FROM game_state WHERE user_id = ? AND season_id = ?',
    args: [userId, seasonId],
  });
  const state = stateResult.rows[0];
  if (!state) return;

  const seasonResult = await database.execute({
    sql: 'SELECT * FROM game_seasons WHERE id = ?',
    args: [seasonId],
  });
  const season = seasonResult.rows[0];
  if (!season) return;

  // Count total sessions in the season date range
  const sessionsResult = await database.execute({
    sql: 'SELECT COUNT(*) as count FROM focus_sessions WHERE user_id = ? AND date >= ? AND date <= ?',
    args: [userId, season.start_date as string, season.end_date as string],
  });
  const totalSessions = (sessionsResult.rows[0]?.count as number) || 0;

  // Get owned tools names
  const toolsResult = await database.execute({
    sql: `SELECT td.display_name FROM game_owned_tools ot
          JOIN game_tool_definitions td ON td.id = ot.tool_id
          WHERE ot.user_id = ? AND ot.season_id = ?`,
    args: [userId, seasonId],
  });
  const toolNames = toolsResult.rows.map(r => r.display_name as string);

  // Get highest prestige title reached
  const prestigeResult = await database.execute({
    sql: `SELECT display_name FROM game_prestige_titles WHERE unlock_threshold <= ? ORDER BY unlock_threshold DESC`,
    args: [state.total_coins_earned as number],
  });
  const prestigeTitles = prestigeResult.rows.map(r => r.display_name as string);

  const sNum = season.season_number as number;
  const sYear = season.year as number;

  await database.execute({
    sql: `INSERT OR REPLACE INTO game_season_archives
          (user_id, season_id, season_label, season_name, badge_color, final_coins, total_coins_earned, total_sessions, total_streaks, tools_purchased, cosmetics_purchased, peak_coins_per_hour, longest_streak)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      userId, seasonId,
      getSeasonLabel(sNum, sYear),
      getSeasonName(sNum),
      getSeasonBadgeColor(sNum),
      state.coins as number,
      state.total_coins_earned as number,
      totalSessions,
      state.streaks_completed as number,
      JSON.stringify(toolNames),
      JSON.stringify(prestigeTitles),
      state.peak_coins_per_hour as number,
      state.streaks_completed as number,
    ],
  });

  // Deactivate the season
  await database.execute({
    sql: 'UPDATE game_seasons SET is_active = 0 WHERE id = ?',
    args: [seasonId],
  });
}

export async function getSeasonArchives(userId: number): Promise<SeasonArchive[]> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM game_season_archives WHERE user_id = ? ORDER BY created_at DESC',
    args: [userId],
  });
  return result.rows.map(row => ({
    id: row.id as number,
    user_id: row.user_id as number,
    season_id: row.season_id as number,
    season_label: row.season_label as string,
    season_name: row.season_name as string,
    badge_color: row.badge_color as string,
    final_coins: row.final_coins as number,
    total_coins_earned: row.total_coins_earned as number,
    total_sessions: row.total_sessions as number,
    total_streaks: row.total_streaks as number,
    tools_purchased: row.tools_purchased as string,
    cosmetics_purchased: row.cosmetics_purchased as string,
    peak_coins_per_hour: row.peak_coins_per_hour as number,
    longest_streak: row.longest_streak as number,
  }));
}

// ─── Game Economy: State Management ─────────────────────────────

export async function getGameState(userId: number, seasonId: number): Promise<GameState | null> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM game_state WHERE user_id = ? AND season_id = ?',
    args: [userId, seasonId],
  });
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id as number,
    user_id: row.user_id as number,
    season_id: row.season_id as number,
    coins: row.coins as number,
    total_coins_earned: row.total_coins_earned as number,
    current_streak_days: row.current_streak_days as number,
    streak_last_date: row.streak_last_date as string | null,
    streaks_completed: row.streaks_completed as number,
    sessions_today: row.sessions_today as number,
    sessions_today_date: row.sessions_today_date as string | null,
    daily_bonus_active: row.daily_bonus_active as number,
    peak_coins_per_hour: row.peak_coins_per_hour as number,
  };
}

export async function updateGameState(userId: number, seasonId: number, updates: Partial<Omit<GameState, 'id' | 'user_id' | 'season_id'>>): Promise<void> {
  const database = getDb();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, val] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(val as string | number | null);
  }
  if (fields.length === 0) return;
  values.push(userId, seasonId);
  await database.execute({
    sql: `UPDATE game_state SET ${fields.join(', ')} WHERE user_id = ? AND season_id = ?`,
    args: values,
  });
}

// ─── Game Economy: Coin Transactions ────────────────────────────

export async function addCoinTransaction(userId: number, seasonId: number, amount: number, reason: string, metadata?: string): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: `INSERT INTO game_coin_transactions (user_id, season_id, amount, reason, metadata) VALUES (?, ?, ?, ?, ?)`,
    args: [userId, seasonId, amount, reason, metadata ?? null],
  });
  // Update coins in game_state
  await database.execute({
    sql: `UPDATE game_state SET coins = coins + ?, total_coins_earned = CASE WHEN ? > 0 THEN total_coins_earned + ? ELSE total_coins_earned END WHERE user_id = ? AND season_id = ?`,
    args: [amount, amount, amount, userId, seasonId],
  });
}

// ─── Game Economy: Tools ────────────────────────────────────────

export async function getToolDefinitions(): Promise<ToolDefinition[]> {
  const database = getDb();
  const result = await database.execute('SELECT * FROM game_tool_definitions ORDER BY unlock_order ASC, id ASC');
  return result.rows.map(row => ({
    id: row.id as number,
    name: row.name as string,
    display_name: row.display_name as string,
    description: row.description as string,
    cost: row.cost as number,
    effect_type: row.effect_type as 'passive' | 'active' | 'prestige',
    passive_per_hour: row.passive_per_hour as number,
    active_percent: row.active_percent as number,
    icon: row.icon as string,
    unlock_order: row.unlock_order as number,
    prerequisite_id: row.prerequisite_id as number | null,
  }));
}

export async function getOwnedTools(userId: number, seasonId: number): Promise<number[]> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT tool_id FROM game_owned_tools WHERE user_id = ? AND season_id = ?',
    args: [userId, seasonId],
  });
  return result.rows.map(row => row.tool_id as number);
}

export async function purchaseTool(userId: number, seasonId: number, toolId: number, cost: number): Promise<void> {
  const database = getDb();
  // Check balance
  const state = await getGameState(userId, seasonId);
  if (!state || state.coins < cost) throw new Error('Insufficient coins');
  // Insert ownership
  await database.execute({
    sql: 'INSERT OR IGNORE INTO game_owned_tools (user_id, season_id, tool_id) VALUES (?, ?, ?)',
    args: [userId, seasonId, toolId],
  });
  // Deduct coins via transaction
  await addCoinTransaction(userId, seasonId, -cost, 'tool_purchase', JSON.stringify({ tool_id: toolId }));
}

// ─── Game Economy: Prestige Titles ──────────────────────────────

export async function getPrestigeTitles(): Promise<PrestigeTitleDefinition[]> {
  const database = getDb();
  const result = await database.execute('SELECT * FROM game_prestige_titles ORDER BY unlock_threshold ASC');
  return result.rows.map(row => ({
    id: row.id as number,
    name: row.name as string,
    display_name: row.display_name as string,
    description: row.description as string,
    unlock_threshold: row.unlock_threshold as number,
    icon: row.icon as string,
  }));
}

// ─── Game Economy: Streaks ──────────────────────────────────────

export async function recordDailyActivity(userId: number, seasonId: number, date: string, streakDay: number): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: `INSERT INTO game_streak_log (user_id, season_id, date, had_session, streak_day)
          VALUES (?, ?, ?, 1, ?)
          ON CONFLICT(user_id, season_id, date) DO UPDATE SET had_session = 1, streak_day = ?`,
    args: [userId, seasonId, date, streakDay, streakDay],
  });
}

export async function getStreakLog(userId: number, seasonId: number): Promise<StreakLogEntry[]> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM game_streak_log WHERE user_id = ? AND season_id = ? ORDER BY date DESC',
    args: [userId, seasonId],
  });
  return result.rows.map(row => ({
    id: row.id as number,
    user_id: row.user_id as number,
    season_id: row.season_id as number,
    date: row.date as string,
    had_session: row.had_session as number,
    streak_day: row.streak_day as number,
  }));
}
