import Database from '@tauri-apps/plugin-sql';

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
