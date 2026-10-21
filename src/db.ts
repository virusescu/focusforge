import { createClient, type Client, type InArgs } from '@libsql/client';
import type { FocusSession, DailyStat, StrategicObjective, ObjectiveCategory, AuthUser, UserSettings, GameSeason, GameState, PrestigeTitleDefinition, SeasonArchive, StreakLogEntry, Alarm, Bucket, BucketKind, BucketGeometry, CanvasNote, Template, TemplateInput } from './types';
import { getQuarter, getSeasonDates, getSeasonLabel, getSeasonName, getSeasonBadgeColor } from './utils/gameEconomy';

let db: Client | null = null;

export function initDbClient(url: string, authToken: string) {
  db = createClient({ url, authToken });
}

export function getDb(): Client {
  if (!db) {
    throw new Error('Database not initialized. Call initDbClient() first.');
  }
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
    CREATE TABLE IF NOT EXISTS buckets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      w REAL NOT NULL DEFAULT 300,
      h REAL NOT NULL DEFAULT 420,
      sort_order INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'custom',
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL,
      category_id INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS canvas_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL,
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      w REAL NOT NULL DEFAULT 260,
      h REAL NOT NULL DEFAULT 200,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS objectives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sort_order INTEGER DEFAULT 0,
      completed_at TEXT,
      category_id INTEGER REFERENCES objective_categories(id),
      is_mission INTEGER DEFAULT 1,
      last_interacted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      bucket_id INTEGER REFERENCES buckets(id),
      bucket_sort_order INTEGER,
      deadline_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Migrations: add missing columns if they don't exist
  try {
    await database.execute('ALTER TABLE objectives ADD COLUMN is_mission INTEGER DEFAULT 1');
  } catch (e) { /* already exists or other error */ }

  try {
    await database.execute('ALTER TABLE objectives ADD COLUMN details TEXT');
  } catch (e) { /* already exists or other error */ }

  try {
    await database.execute('ALTER TABLE objectives ADD COLUMN last_interacted_at TEXT');
  } catch (e) { /* already exists or other error */ }

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

  await database.execute(`
    CREATE TABLE IF NOT EXISTS alarms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      time TEXT NOT NULL,
      days_of_week TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // ─── Migrations ──────────────────────────────────────────────────
  // Add coin_bounty column to objective_categories (safe if already exists)
  try {
    await database.execute(`ALTER TABLE objective_categories ADD COLUMN coin_bounty INTEGER DEFAULT 25`);
    // Migrate existing seeded categories to their intended bounties
    await database.execute(`UPDATE objective_categories SET coin_bounty = 50 WHERE label = 'Hard' AND coin_bounty = 25`);
    await database.execute(`UPDATE objective_categories SET coin_bounty = 10 WHERE label = 'Easy' AND coin_bounty = 25`);
  } catch {
    // Column already exists — no action needed
  }

  // Add is_mission column to objectives (1 = Mission, 0 = Backlog; existing = mission)
  try {
    await database.execute(`ALTER TABLE objectives ADD COLUMN is_mission INTEGER DEFAULT 1`);
  } catch {
    // Column already exists — no action needed
  }

  // Add details column to objectives
  try {
    await database.execute(`ALTER TABLE objectives ADD COLUMN details TEXT`);
  } catch {
    // Column already exists — no action needed
  }

  // Add bucket columns to objectives (backfilled per user in ensureSystemBuckets)
  try {
    await database.execute(`ALTER TABLE objectives ADD COLUMN bucket_id INTEGER`);
  } catch {
    // Column already exists — no action needed
  }

  try {
    await database.execute(`ALTER TABLE objectives ADD COLUMN bucket_sort_order INTEGER`);
  } catch {
    // Column already exists — no action needed
  }

  // Optional deadline (ISO, UTC)
  try {
    await database.execute(`ALTER TABLE objectives ADD COLUMN deadline_at TEXT`);
  } catch {
    // Column already exists — no action needed
  }

  // One Mission and one Unsorted bucket per user. Merge duplicates left by an earlier
  // check-then-insert race (keep the lowest id), then enforce it with a unique index.
  try {
    await database.execute(`
      UPDATE objectives SET bucket_id = (
        SELECT MIN(keep.id) FROM buckets dup
        JOIN buckets keep ON keep.user_id = dup.user_id AND keep.kind = dup.kind
        WHERE dup.id = objectives.bucket_id
      )
      WHERE bucket_id IN (
        SELECT b.id FROM buckets b
        WHERE b.kind IN ('mission', 'unsorted')
          AND b.id > (SELECT MIN(m.id) FROM buckets m WHERE m.user_id = b.user_id AND m.kind = b.kind)
      )
    `);
    await database.execute(`
      DELETE FROM buckets
      WHERE kind IN ('mission', 'unsorted')
        AND id > (SELECT MIN(m.id) FROM buckets m WHERE m.user_id = buckets.user_id AND m.kind = buckets.kind)
    `);
    await database.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_buckets_user_system ON buckets(user_id, kind) WHERE kind IN ('mission', 'unsorted')`);
  } catch (e) {
    console.error('Failed to enforce unique system buckets', e);
  }

  // The Deadlines panel is a system bucket too (a separate index: the one above predates it)
  try {
    await database.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_buckets_user_deadlines ON buckets(user_id, kind) WHERE kind = 'deadlines'`);
  } catch (e) {
    console.error('Failed to enforce a unique Deadlines bucket', e);
  }

  // Migrate prestige titles to 12 titles with even 5k spacing
  try {
    await database.execute(`UPDATE game_prestige_titles SET unlock_threshold = 5000  WHERE id = 1`);
    await database.execute(`UPDATE game_prestige_titles SET unlock_threshold = 10000 WHERE id = 2`);
    await database.execute(`UPDATE game_prestige_titles SET unlock_threshold = 15000 WHERE id = 3`);
    await database.execute(`UPDATE game_prestige_titles SET unlock_threshold = 20000 WHERE id = 4`);
    await database.execute(`UPDATE game_prestige_titles SET unlock_threshold = 25000 WHERE id = 5`);
    await database.execute(`UPDATE game_prestige_titles SET unlock_threshold = 30000 WHERE id = 6`);
    await database.execute(`UPDATE game_prestige_titles SET unlock_threshold = 35000 WHERE id = 7`);
    await database.execute(`UPDATE game_prestige_titles SET unlock_threshold = 40000 WHERE id = 8`);
    await database.execute(`UPDATE game_prestige_titles SET unlock_threshold = 45000 WHERE id = 9`);
    await database.execute(`UPDATE game_prestige_titles SET unlock_threshold = 50000 WHERE id = 10`);
  } catch {
    // Table may not exist yet — seed will handle it
  }

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
    coin_bounty: (row.coin_bounty as number) ?? 25,
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
      sql: 'INSERT INTO objective_categories (user_id, label, color, sort_order, coin_bounty) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)',
      args: [userId, 'Hard', '#ff4444', 0, 50, userId, 'Normal', '#ffffff', 1, 25, userId, 'Easy', '#888888', 2, 10],
    });
  }
}

export async function addCategory(userId: number, label: string, color: string, coinBounty: number = 25): Promise<number> {
  const database = getDb();
  const countResult = await database.execute({
    sql: 'SELECT COUNT(*) as n FROM objective_categories WHERE user_id = ?',
    args: [userId],
  });
  const nextOrder = (countResult.rows[0]?.n as number) ?? 0;
  const result = await database.execute({
    sql: 'INSERT INTO objective_categories (user_id, label, color, sort_order, coin_bounty) VALUES (?, ?, ?, ?, ?)',
    args: [userId, label, color, nextOrder, coinBounty],
  });
  return Number(result.lastInsertRowid) ?? 0;
}

export async function updateCategory(id: number, label: string, color: string, coinBounty: number = 25): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE objective_categories SET label = ?, color = ?, coin_bounty = ? WHERE id = ?',
    args: [label, color, coinBounty, id],
  });
}

export async function reorderCategories(orderedIds: number[]): Promise<void> {
  const database = getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await database.execute({
      sql: 'UPDATE objective_categories SET sort_order = ? WHERE id = ?',
      args: [i, orderedIds[i]],
    });
  }
}

export async function deleteCategory(id: number): Promise<void> {
  const database = getDb();
  await database.execute({ sql: 'UPDATE objectives SET category_id = NULL WHERE category_id = ?', args: [id] });
  await database.execute({ sql: 'UPDATE templates SET category_id = NULL WHERE category_id = ?', args: [id] });
  await database.execute({ sql: 'DELETE FROM objective_categories WHERE id = ?', args: [id] });
}

// ─── Templates ───────────────────────────────────────────────────

export async function getTemplates(userId: number): Promise<Template[]> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT id, name, title, details, color, category_id, sort_order FROM templates WHERE user_id = ? ORDER BY sort_order ASC, id ASC',
    args: [userId],
  });
  return result.rows.map(row => ({
    id: Number(row.id),
    name: row.name as string,
    title: (row.title as string | null) ?? '',
    details: (row.details as string | null) ?? '',
    color: row.color as string,
    category_id: (row.category_id as number | null) ?? null,
    sort_order: Number(row.sort_order),
  }));
}

// New templates go to the end of the user's template order
export async function addTemplate(userId: number, template: TemplateInput): Promise<number> {
  const database = getDb();
  const maxResult = await database.execute({
    sql: 'SELECT MAX(sort_order) as maxOrder FROM templates WHERE user_id = ?',
    args: [userId],
  });
  const nextOrder = ((maxResult.rows[0]?.maxOrder as number | null) ?? -1) + 1;
  const result = await database.execute({
    sql: 'INSERT INTO templates (user_id, name, title, details, color, category_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [userId, template.name, template.title, template.details, template.color, template.category_id, nextOrder],
  });
  return Number(result.lastInsertRowid);
}

export async function updateTemplate(id: number, template: TemplateInput): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE templates SET name = ?, title = ?, details = ?, color = ?, category_id = ? WHERE id = ?',
    args: [template.name, template.title, template.details, template.color, template.category_id, id],
  });
}

export async function deleteTemplate(id: number): Promise<void> {
  const database = getDb();
  await database.execute({ sql: 'DELETE FROM templates WHERE id = ?', args: [id] });
}

export async function reorderTemplates(orderedIds: number[]): Promise<void> {
  const database = getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await database.execute({
      sql: 'UPDATE templates SET sort_order = ? WHERE id = ?',
      args: [i, orderedIds[i]],
    });
  }
}

// ─── Buckets ─────────────────────────────────────────────────────

export const SYSTEM_BUCKET_DEFAULTS = {
  mission: { name: 'Mission', color: '#00ff88', x: 0, y: 0, w: 320, h: 480 },
  unsorted: { name: 'Unsorted', color: '#888888', x: 360, y: 0, w: 300, h: 420 },
  deadlines: { name: 'Deadlines', color: '#ff5555', x: 700, y: 0, w: 300, h: 420 },
} as const satisfies Record<'mission' | 'unsorted' | 'deadlines', { name: string; color: string } & BucketGeometry>;

const SYSTEM_BUCKET_KINDS = ['mission', 'unsorted', 'deadlines'] as const;
const SYSTEM_BUCKET_SORT_ORDER = { mission: 0, unsorted: 1, deadlines: 2 } as const;

async function getUnsortedBucketId(userId: number): Promise<number> {
  const database = getDb();
  const result = await database.execute({
    sql: "SELECT id FROM buckets WHERE user_id = ? AND kind = 'unsorted' ORDER BY id ASC LIMIT 1",
    args: [userId],
  });
  if (result.rows.length === 0) throw new Error('Unsorted bucket missing');
  return result.rows[0].id as number;
}

// Overlapping refreshes (e.g. StrictMode's double mount) share one run per user
const ensureSystemBucketsInFlight = new Map<number, Promise<void>>();

export function ensureSystemBuckets(userId: number): Promise<void> {
  const pending = ensureSystemBucketsInFlight.get(userId);
  if (pending) return pending;
  const run = runEnsureSystemBuckets(userId).finally(() => ensureSystemBucketsInFlight.delete(userId));
  ensureSystemBucketsInFlight.set(userId, run);
  return run;
}

async function runEnsureSystemBuckets(userId: number): Promise<void> {
  const database = getDb();
  const existing = await database.execute({
    sql: "SELECT kind FROM buckets WHERE user_id = ? AND kind IN ('mission', 'unsorted', 'deadlines')",
    args: [userId],
  });
  const kinds = new Set(existing.rows.map(r => r.kind as string));
  for (const kind of SYSTEM_BUCKET_KINDS) {
    if (kinds.has(kind)) continue;
    const d = SYSTEM_BUCKET_DEFAULTS[kind];
    await database.execute({
      // OR IGNORE: the unique index on (user_id, kind) wins any race with another client
      sql: 'INSERT OR IGNORE INTO buckets (user_id, name, color, x, y, w, h, sort_order, kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [userId, d.name, d.color, d.x, d.y, d.w, d.h, SYSTEM_BUCKET_SORT_ORDER[kind], kind],
    });
  }
  // Backfill: objectives without a bucket (pre-bucket data) land in Unsorted
  const unsortedId = await getUnsortedBucketId(userId);
  await database.execute({
    sql: 'UPDATE objectives SET bucket_id = ?, bucket_sort_order = COALESCE(bucket_sort_order, sort_order) WHERE user_id = ? AND bucket_id IS NULL',
    args: [unsortedId, userId],
  });
}

export async function getBuckets(userId: number): Promise<Bucket[]> {
  await ensureSystemBuckets(userId);
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM buckets WHERE user_id = ? ORDER BY sort_order ASC, id ASC',
    args: [userId],
  });
  return result.rows.map(row => ({
    id: Number(row.id),
    name: row.name as string,
    color: row.color as string,
    x: Number(row.x),
    y: Number(row.y),
    w: Number(row.w),
    h: Number(row.h),
    sort_order: Number(row.sort_order),
    kind: row.kind as BucketKind,
  }));
}

export async function addBucket(userId: number, name: string, color: string, geometry: BucketGeometry): Promise<number> {
  const database = getDb();
  const maxResult = await database.execute({
    sql: 'SELECT MAX(sort_order) as maxOrder FROM buckets WHERE user_id = ?',
    args: [userId],
  });
  const maxOrder = (maxResult.rows[0]?.maxOrder as number | null) ?? -1;
  const result = await database.execute({
    sql: "INSERT INTO buckets (user_id, name, color, x, y, w, h, sort_order, kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'custom')",
    args: [userId, name, color, geometry.x, geometry.y, geometry.w, geometry.h, maxOrder + 1],
  });
  return Number(result.lastInsertRowid);
}

export async function updateBucket(id: number, name: string, color: string): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE buckets SET name = ?, color = ? WHERE id = ?',
    args: [name, color, id],
  });
}

// Gives the bucket the highest sort_order among its user's buckets, which puts it on top on the canvas
export async function bringBucketToFront(id: number): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE buckets SET sort_order = (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM buckets WHERE user_id = (SELECT user_id FROM buckets WHERE id = ?)) WHERE id = ?',
    args: [id, id],
  });
}

export async function updateBucketGeometry(id: number, geometry: BucketGeometry): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE buckets SET x = ?, y = ?, w = ?, h = ? WHERE id = ?',
    args: [geometry.x, geometry.y, geometry.w, geometry.h, id],
  });
}

export async function deleteBucket(id: number): Promise<void> {
  const database = getDb();
  const bucketResult = await database.execute({
    sql: 'SELECT user_id, kind FROM buckets WHERE id = ?',
    args: [id],
  });
  if (bucketResult.rows.length === 0) return;
  const { user_id, kind } = bucketResult.rows[0];
  if (kind !== 'custom') throw new Error('Cannot delete system bucket');

  // Move every objective (open and completed) to Unsorted so none keep a dangling bucket_id,
  // appended after Unsorted's open objectives in their existing order
  const unsortedId = await getUnsortedBucketId(user_id as number);
  const orderResult = await database.execute({
    sql: `SELECT
      (SELECT MAX(bucket_sort_order) FROM objectives WHERE bucket_id = ? AND completed_at IS NULL) as maxOrder,
      (SELECT MIN(COALESCE(bucket_sort_order, 0)) FROM objectives WHERE bucket_id = ?) as minOrder`,
    args: [unsortedId, id],
  });
  const maxOrder = (orderResult.rows[0]?.maxOrder as number | null) ?? -1;
  const minOrder = (orderResult.rows[0]?.minOrder as number | null) ?? 0;
  await database.execute({
    sql: 'UPDATE objectives SET bucket_id = ?, bucket_sort_order = COALESCE(bucket_sort_order, 0) + ? WHERE bucket_id = ?',
    args: [unsortedId, maxOrder + 1 - minOrder, id],
  });
  await database.execute({ sql: 'DELETE FROM buckets WHERE id = ?', args: [id] });
}

// ─── Canvas notes ────────────────────────────────────────────────

export async function getCanvasNotes(userId: number): Promise<CanvasNote[]> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM canvas_notes WHERE user_id = ? ORDER BY sort_order ASC, id ASC',
    args: [userId],
  });
  return result.rows.map(row => ({
    id: Number(row.id),
    content: (row.content as string | null) ?? '',
    color: row.color as string,
    x: Number(row.x),
    y: Number(row.y),
    w: Number(row.w),
    h: Number(row.h),
    sort_order: Number(row.sort_order),
  }));
}

// New notes start empty (or with `content`, for duplicates), on top of the user's other notes
export async function addCanvasNote(userId: number, color: string, geometry: BucketGeometry, content: string = ''): Promise<number> {
  const database = getDb();
  const maxResult = await database.execute({
    sql: 'SELECT MAX(sort_order) as maxOrder FROM canvas_notes WHERE user_id = ?',
    args: [userId],
  });
  const maxOrder = (maxResult.rows[0]?.maxOrder as number | null) ?? -1;
  const result = await database.execute({
    sql: 'INSERT INTO canvas_notes (user_id, content, color, x, y, w, h, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [userId, content, color, geometry.x, geometry.y, geometry.w, geometry.h, maxOrder + 1],
  });
  return Number(result.lastInsertRowid);
}

export async function updateCanvasNoteContent(id: number, content: string): Promise<void> {
  const database = getDb();
  await database.execute({ sql: 'UPDATE canvas_notes SET content = ? WHERE id = ?', args: [content, id] });
}

export async function updateCanvasNoteColor(id: number, color: string): Promise<void> {
  const database = getDb();
  await database.execute({ sql: 'UPDATE canvas_notes SET color = ? WHERE id = ?', args: [color, id] });
}

export async function updateCanvasNoteGeometry(id: number, geometry: BucketGeometry): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE canvas_notes SET x = ?, y = ?, w = ?, h = ? WHERE id = ?',
    args: [geometry.x, geometry.y, geometry.w, geometry.h, id],
  });
}

// Gives the note the highest sort_order among its user's notes, which puts it in front of the other notes
export async function bringCanvasNoteToFront(id: number): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE canvas_notes SET sort_order = (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM canvas_notes WHERE user_id = (SELECT user_id FROM canvas_notes WHERE id = ?)) WHERE id = ?',
    args: [id, id],
  });
}

export async function deleteCanvasNote(id: number): Promise<void> {
  const database = getDb();
  await database.execute({ sql: 'DELETE FROM canvas_notes WHERE id = ?', args: [id] });
}

export async function moveObjectiveToBucket(id: number, bucketId: number): Promise<void> {
  const database = getDb();
  const bucketResult = await database.execute({
    sql: 'SELECT user_id, kind FROM buckets WHERE id = ?',
    args: [bucketId],
  });
  if (bucketResult.rows.length === 0) return;
  const { user_id, kind } = bucketResult.rows[0];
  // Mission membership is is_mission, never a bucket; the Deadlines panel just lists tasks that have a deadline
  if (kind === 'mission') throw new Error('Cannot move objective into mission bucket');
  if (kind === 'deadlines') throw new Error('Cannot move objective into deadlines bucket');

  const maxResult = await database.execute({
    sql: 'SELECT MAX(bucket_sort_order) as maxOrder FROM objectives WHERE user_id = ? AND bucket_id = ? AND completed_at IS NULL',
    args: [user_id as number, bucketId],
  });
  const maxOrder = (maxResult.rows[0]?.maxOrder as number | null) ?? -1;

  await database.execute({
    sql: 'UPDATE objectives SET bucket_id = ?, bucket_sort_order = ? WHERE id = ?',
    args: [bucketId, maxOrder + 1, id],
  });
}

export async function reorderBucketObjectives(orderedIds: number[]): Promise<void> {
  const database = getDb();
  for (let i = 0; i < orderedIds.length; i++) {
    await database.execute({
      sql: 'UPDATE objectives SET bucket_sort_order = ? WHERE id = ?',
      args: [i, orderedIds[i]],
    });
  }
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
    is_mission: (row.is_mission as number) ?? 1,
    details: row.details as string | null,
    last_interacted_at: (row.last_interacted_at as string) || (row.created_at as string),
    bucket_id: (row.bucket_id as number | null) ?? null,
    bucket_sort_order: (row.bucket_sort_order as number | null) ?? null,
    deadline_at: (row.deadline_at as string | null) ?? null,
  }));
}

export async function updateObjectiveInteractionTime(id: number): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE objectives SET last_interacted_at = CURRENT_TIMESTAMP WHERE id = ?',
    args: [id],
  });
}

export async function addObjective(
  userId: number,
  text: string,
  categoryId?: number | null,
  isMission: number = 1,
  prepend: boolean = false,
  bucketId: number | null = null,
  details: string | null = null
): Promise<number> {
  const database = getDb();
  let sortOrder: number;
  if (prepend) {
    const minResult = await database.execute({
      sql: 'SELECT MIN(sort_order) as minOrder FROM objectives WHERE user_id = ? AND is_mission = ? AND completed_at IS NULL',
      args: [userId, isMission],
    });
    const minOrder = (minResult.rows[0]?.minOrder as number | null) ?? 0;
    sortOrder = minOrder - 1;
  } else {
    const maxResult = await database.execute({
      sql: 'SELECT MAX(sort_order) as maxOrder FROM objectives WHERE user_id = ? AND is_mission = ? AND completed_at IS NULL',
      args: [userId, isMission],
    });
    const maxOrder = (maxResult.rows[0]?.maxOrder as number | null) ?? -1;
    sortOrder = maxOrder + 1;
  }
  const targetBucketId = bucketId ?? await getUnsortedBucketId(userId);
  const bucketMax = await database.execute({
    sql: 'SELECT MAX(bucket_sort_order) as maxOrder FROM objectives WHERE user_id = ? AND bucket_id = ? AND completed_at IS NULL',
    args: [userId, targetBucketId],
  });
  const bucketSortOrder = ((bucketMax.rows[0]?.maxOrder as number | null) ?? -1) + 1;
  const result = await database.execute({
    sql: 'INSERT INTO objectives (user_id, text, sort_order, category_id, is_mission, details, bucket_id, bucket_sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [userId, text, sortOrder, categoryId ?? null, isMission, details, targetBucketId, bucketSortOrder],
  });
  return Number(result.lastInsertRowid) ?? 0;
}

// Copies text, category, details, deadline, mission flag and bucket; the copy sits directly after the
// original in both the Mission list and its bucket. Returns the new id, or null if `id` is gone.
export async function duplicateObjective(id: number): Promise<number | null> {
  const database = getDb();
  const found = await database.execute({
    sql: 'SELECT user_id, text, sort_order, category_id, is_mission, details, bucket_id, bucket_sort_order, deadline_at FROM objectives WHERE id = ?',
    args: [id],
  });
  const row = found.rows[0];
  if (!row) return null;
  const userId = row.user_id as number;
  const isMission = (row.is_mission as number) ?? 1;
  const sortOrder = ((row.sort_order as number | null) ?? 0) + 1;
  const bucketId = (row.bucket_id as number | null) ?? await getUnsortedBucketId(userId);

  await database.execute({
    sql: 'UPDATE objectives SET sort_order = sort_order + 1 WHERE user_id = ? AND is_mission = ? AND completed_at IS NULL AND sort_order >= ?',
    args: [userId, isMission, sortOrder],
  });

  let bucketSortOrder: number;
  const originalBucketOrder = row.bucket_sort_order as number | null;
  if (originalBucketOrder === null) {
    const bucketMax = await database.execute({
      sql: 'SELECT MAX(bucket_sort_order) as maxOrder FROM objectives WHERE user_id = ? AND bucket_id = ? AND completed_at IS NULL',
      args: [userId, bucketId],
    });
    bucketSortOrder = ((bucketMax.rows[0]?.maxOrder as number | null) ?? -1) + 1;
  } else {
    bucketSortOrder = originalBucketOrder + 1;
    await database.execute({
      sql: 'UPDATE objectives SET bucket_sort_order = bucket_sort_order + 1 WHERE user_id = ? AND bucket_id = ? AND completed_at IS NULL AND bucket_sort_order >= ?',
      args: [userId, bucketId, bucketSortOrder],
    });
  }

  const result = await database.execute({
    sql: 'INSERT INTO objectives (user_id, text, sort_order, category_id, is_mission, details, bucket_id, bucket_sort_order, deadline_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [userId, row.text as string, sortOrder, (row.category_id as number | null) ?? null, isMission, (row.details as string | null) ?? null, bucketId, bucketSortOrder, (row.deadline_at as string | null) ?? null],
  });
  return Number(result.lastInsertRowid);
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

export async function updateObjectiveDetails(id: number, details: string | null): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE objectives SET details = ? WHERE id = ?',
    args: [details, id],
  });
}

// `deadline` is an ISO string (UTC), or null to remove the deadline
export async function updateObjectiveDeadline(id: number, deadline: string | null): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE objectives SET deadline_at = ? WHERE id = ?',
    args: [deadline, id],
  });
}

export async function setObjectiveMission(id: number, isMission: number): Promise<void> {
  const database = getDb();
  const objResult = await database.execute({
    sql: 'SELECT user_id FROM objectives WHERE id = ?',
    args: [id],
  });
  if (objResult.rows.length === 0) return;
  const userId = objResult.rows[0].user_id as number;

  const maxResult = await database.execute({
    sql: 'SELECT MAX(sort_order) as maxOrder FROM objectives WHERE user_id = ? AND is_mission = ? AND completed_at IS NULL',
    args: [userId, isMission],
  });
  const maxOrder = (maxResult.rows[0]?.maxOrder as number | null) ?? -1;

  await database.execute({
    sql: 'UPDATE objectives SET is_mission = ?, sort_order = ? WHERE id = ?',
    args: [isMission, maxOrder + 1, id],
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
    sql: 'UPDATE objectives SET completed_at = ?, details = NULL WHERE id = ?',
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
    sql: `SELECT id, text, created_at, completed_at, category_id, is_mission, last_interacted_at FROM objectives
          WHERE user_id = ? AND completed_at IS NOT NULL
            AND datetime(completed_at, 'localtime') >= ? || ' ' || ?
            AND datetime(completed_at, 'localtime') < ? || ' ' || ?
          ORDER BY completed_at ASC`,
    args: [userId, date, startHourStr, endDate, endHourStr],
  });

  return result.rows.map(row => ({
    id: row.id as number,
    text: row.text as string,
    created_at: row.created_at as string,
    completed_at: row.completed_at as string,
    category_id: row.category_id as number | null,
    is_mission: (row.is_mission as number) ?? 1,
    last_interacted_at: (row.last_interacted_at as string) || (row.created_at as string),
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

async function seedPrestigeTitles() {
  const database = getDb();
  const titles = [
    [1,  'INITIATE',          'Initiate',          'First steps into the forge',             5000,  '🔰'],
    [2,  'OPERATOR',          'Operator',          'Learning the ropes',                     10000, '⚙️'],
    [3,  'FOCUSED',           'Focused',           'Concentration is becoming natural',      15000, '🎯'],
    [4,  'DEEP_WORKER',       'Deep Worker',       'Master of sustained attention',          20000, '🧠'],
    [5,  'STREAK_MASTER',     'Streak Master',     'Consistency is your weapon',             25000, '🔥'],
    [6,  'FORGE_ADEPT',       'Forge Adept',       'The forge bends to your will',           30000, '⚒️'],
    [7,  'NEURAL_ARCHITECT',  'Neural Architect',  'Rewiring focus pathways',                35000, '🏗️'],
    [8,  'APEX_OPERATOR',     'Apex Operator',     'Peak performance unlocked',              40000, '💎'],
    [9,  'TRANSCENDENT',      'Transcendent',      'Beyond ordinary focus',                  45000, '✨'],
    [10, 'FORGE_LEGEND',      'Forge Legend',      'The ultimate FocusForge operator',       50000, '⭐'],
    [11, 'ETERNAL_FLAME',     'Eternal Flame',     'The forge burns eternal',                55000, '🔱'],
    [12, 'SINGULARITY',       'Singularity',       'Where focus and will become one',        60000, '🌀'],
  ];
  for (const t of titles) {
    await database.execute({
      sql: `INSERT OR REPLACE INTO game_prestige_titles (id, name, display_name, description, unlock_threshold, icon)
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
      '[]', // tools_purchased: legacy column, tool shop removed
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

// ─── Alarms ─────────────────────────────────────────────────────

export async function getAlarms(userId: number): Promise<Alarm[]> {
  const database = getDb();
  const result = await database.execute({
    sql: 'SELECT * FROM alarms WHERE user_id = ? ORDER BY time ASC',
    args: [userId],
  });
  return result.rows.map(row => ({
    id: row.id as number,
    user_id: row.user_id as number,
    title: row.title as string,
    time: row.time as string,
    days_of_week: JSON.parse(row.days_of_week as string),
    is_active: Boolean(row.is_active),
  }));
}

export async function addAlarm(userId: number, title: string, time: string, daysOfWeek: number[]): Promise<number> {
  const database = getDb();
  const result = await database.execute({
    sql: 'INSERT INTO alarms (user_id, title, time, days_of_week, is_active) VALUES (?, ?, ?, ?, 1)',
    args: [userId, title, time, JSON.stringify(daysOfWeek)],
  });
  return Number(result.lastInsertRowid);
}

export async function updateAlarm(id: number, title: string, time: string, daysOfWeek: number[]): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE alarms SET title = ?, time = ?, days_of_week = ? WHERE id = ?',
    args: [title, time, JSON.stringify(daysOfWeek), id],
  });
}

export async function toggleAlarm(id: number, isActive: boolean): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'UPDATE alarms SET is_active = ? WHERE id = ?',
    args: [isActive ? 1 : 0, id],
  });
}

export async function deleteAlarm(id: number): Promise<void> {
  const database = getDb();
  await database.execute({
    sql: 'DELETE FROM alarms WHERE id = ?',
    args: [id],
  });
}
