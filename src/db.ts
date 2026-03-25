import Database from '@tauri-apps/plugin-sql';
import type { FocusSession, DailyStat, StrategicObjective } from './types';

let db: Database | null = null;

export async function getDb() {
  if (db) return db;
  db = await Database.load('sqlite:focusforge.db');
  return db;
}

export async function initDb() {
  const database = await getDb();
  
  // Create user_settings table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      avatar_url TEXT,
      debug_speed REAL DEFAULT 1.0,
      experience_lvl INTEGER DEFAULT 42
    )
  `);

  // Create focus_sessions table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS focus_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      date TEXT NOT NULL
    )
  `);

  // Create objectives table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS objectives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create session_pauses table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS session_pauses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      pause_time TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES focus_sessions(id)
    )
  `);

  // Migration for existing users who don't have the debug_speed column
  try {
    await database.execute('ALTER TABLE user_settings ADD COLUMN debug_speed REAL DEFAULT 1.0');
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration for experience_lvl
  try {
    await database.execute('ALTER TABLE user_settings ADD COLUMN experience_lvl INTEGER DEFAULT 42');
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration for objectives sort order
  try {
    await database.execute('ALTER TABLE objectives ADD COLUMN sort_order INTEGER DEFAULT 0');
    // Seed existing rows with their current rowid order
    await database.execute(`
      UPDATE objectives SET sort_order = (
        SELECT COUNT(*) FROM objectives o2 WHERE o2.id <= objectives.id
      )
    `);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration for objective completion tracking
  try {
    await database.execute('ALTER TABLE objectives ADD COLUMN completed_at TEXT');
  } catch (e) {
    // Column already exists, ignore
  }

  // Check if we have a user, if not insert default
  const users = await database.select<any[]>('SELECT * FROM user_settings LIMIT 1');
  if (users.length === 0) {
    await database.execute(
      'INSERT INTO user_settings (name, email, debug_speed, experience_lvl) VALUES (?, ?, ?, ?)',
      ['NEURAL_OP_42', 'operator@focusforge.sync', 1.0, 42]
    );
  }
}

export async function updateUserSettings(name: string, email: string, debugSpeed: number, experienceLvl: number) {
  const database = await getDb();
  await database.execute(
    'UPDATE user_settings SET name = ?, email = ?, debug_speed = ?, experience_lvl = ? WHERE id = 1',
    [name, email, debugSpeed, experienceLvl]
  );
}

export async function getUserSettings() {
  const database = await getDb();
  const users = await database.select<any[]>('SELECT * FROM user_settings WHERE id = 1');
  return users[0];
}

// Helper for Gravatar
export async function getGravatarUrl(email: string) {
  const trimmedEmail = email.trim().toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(trimmedEmail);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `https://www.gravatar.com/avatar/${hashHex}?d=identicon&s=200`;
}

// Focus Session Functions
export async function saveFocusSession(startTime: string, durationSeconds: number, pauseTimes: string[] = []) {
  const database = await getDb();
  const date = startTime.split('T')[0];
  const result = await database.execute(
    'INSERT INTO focus_sessions (start_time, duration_seconds, date) VALUES (?, ?, ?)',
    [startTime, durationSeconds, date]
  );
  const sessionId = result.lastInsertId;
  for (const pauseTime of pauseTimes) {
    await database.execute(
      'INSERT INTO session_pauses (session_id, pause_time) VALUES (?, ?)',
      [sessionId, pauseTime]
    );
  }
}

export async function getRecentSessions(limit: number = 3): Promise<FocusSession[]> {
  const database = await getDb();
  return await database.select<FocusSession[]>(
    'SELECT * FROM focus_sessions ORDER BY start_time DESC LIMIT $1',
    [limit]
  );
}

export async function getDailyFocusStats(days: number = 21): Promise<DailyStat[]> {
  const database = await getDb();
  
  // Calculate the date N days ago
  const d = new Date();
  d.setDate(d.getDate() - (days - 1)); // -1 because we want to include today
  const startDateStr = d.toISOString().split('T')[0];

  const results = await database.select<{ date: string, totalSeconds: number }[]>(
    `SELECT date, SUM(duration_seconds) as totalSeconds 
     FROM focus_sessions 
     WHERE date >= $1 
     GROUP BY date 
     ORDER BY date ASC`,
    [startDateStr]
  );
  
  return results;
}

export async function getSessionsForDay(date: string): Promise<FocusSession[]> {
  const database = await getDb();

  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayStr = nextDay.toISOString().split('T')[0];

  const rows = await database.select<FocusSession[]>(
    `SELECT * FROM focus_sessions
     WHERE (date = $1 AND strftime('%H:%M:%S', start_time) >= '08:00:00')
        OR (date = $2 AND strftime('%H:%M:%S', start_time) < '02:00:00')
     ORDER BY start_time ASC`,
    [date, nextDayStr]
  );

  if (rows.length === 0) return [];

  const ids = rows.map(r => r.id);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const pauses = await database.select<{ session_id: number; pause_time: string }[]>(
    `SELECT session_id, pause_time FROM session_pauses WHERE session_id IN (${placeholders}) ORDER BY pause_time ASC`,
    ids
  );

  const pauseMap = new Map<number, string[]>();
  for (const p of pauses) {
    if (!pauseMap.has(p.session_id)) pauseMap.set(p.session_id, []);
    pauseMap.get(p.session_id)!.push(p.pause_time);
  }

  return rows.map(row => ({
    ...row,
    pause_times: pauseMap.get(row.id) || [],
  }));
}

export async function deleteFocusSession(id: number) {
  const database = await getDb();
  await database.execute('DELETE FROM session_pauses WHERE session_id = ?', [id]);
  await database.execute('DELETE FROM focus_sessions WHERE id = ?', [id]);
}

export async function getGlobalStats() {
  const database = await getDb();
  
  // All time stats
  const allTime = await database.select<{ allTimeTotal: number, allTimePeak: number }[]>(
    'SELECT SUM(duration_seconds) as allTimeTotal, MAX(duration_seconds) as allTimePeak FROM focus_sessions'
  );

  // Week stats (last 7 days)
  const dWeek = new Date();
  dWeek.setDate(dWeek.getDate() - 7);
  const weekStr = dWeek.toISOString().split('T')[0];
  const week = await database.select<{ weekTotal: number }[]>(
    'SELECT SUM(duration_seconds) as weekTotal FROM focus_sessions WHERE date >= $1',
    [weekStr]
  );

  // Month stats (last 30 days)
  const dMonth = new Date();
  dMonth.setDate(dMonth.getDate() - 30);
  const monthStr = dMonth.toISOString().split('T')[0];
  const month = await database.select<{ monthTotal: number }[]>(
    'SELECT SUM(duration_seconds) as monthTotal FROM focus_sessions WHERE date >= $1',
    [monthStr]
  );

  return {
    allTimeTotal: allTime[0]?.allTimeTotal || 0,
    allTimePeak: allTime[0]?.allTimePeak || 0,
    weekTotal: week[0]?.weekTotal || 0,
    monthTotal: month[0]?.monthTotal || 0
  };
}

// Strategic Objective Functions
export async function getObjectives(): Promise<StrategicObjective[]> {
  const database = await getDb();
  return await database.select<StrategicObjective[]>(
    'SELECT * FROM objectives WHERE completed_at IS NULL ORDER BY sort_order ASC, id ASC'
  );
}

export async function reorderObjectives(orderedIds: number[]): Promise<void> {
  const database = await getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await database.execute(
      'UPDATE objectives SET sort_order = ? WHERE id = ?',
      [i, orderedIds[i]]
    );
  }
}

export async function addObjective(text: string): Promise<number> {
  const database = await getDb();
  const countResult = await database.select<{ n: number }[]>('SELECT COUNT(*) as n FROM objectives');
  const nextOrder = countResult[0]?.n ?? 0;
  const result = await database.execute(
    'INSERT INTO objectives (text, sort_order) VALUES (?, ?)',
    [text, nextOrder]
  );
  return result.lastInsertId;
}

export async function deleteObjective(id: number) {
  const database = await getDb();
  await database.execute('DELETE FROM objectives WHERE id = ?', [id]);
}

export async function completeObjective(id: number): Promise<void> {
  const database = await getDb();
  await database.execute(
    'UPDATE objectives SET completed_at = ? WHERE id = ?',
    [new Date().toISOString(), id]
  );
}

export async function getCompletedObjectivesForDay(date: string): Promise<StrategicObjective[]> {
  const database = await getDb();
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayStr = nextDay.toISOString().split('T')[0];

  return await database.select<StrategicObjective[]>(
    `SELECT id, text, completed_at FROM objectives
     WHERE completed_at IS NOT NULL
       AND (
         date(completed_at) = $1
         OR (date(completed_at) = $2 AND strftime('%H:%M:%S', completed_at) < '02:00:00')
       )
     ORDER BY completed_at ASC`,
    [date, nextDayStr]
  );
}
