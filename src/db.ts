import { createClient, type Client, type InArgs } from '@libsql/client';
import type { FocusSession, DailyStat, StrategicObjective, ObjectiveCategory, AuthUser, UserSettings } from './types';

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
