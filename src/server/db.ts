import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import crypto from 'crypto';

let dbInstance: Database<sqlite3.Database, sqlite3.Statement> | null = null;

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function getDb(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = path.resolve(process.cwd(), 'streaming.db');
  
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await dbInstance.run('PRAGMA foreign_keys = ON');

  // Create tables
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stream_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      name TEXT NOT NULL,
      rtmpUrl TEXT NOT NULL,
      streamKey TEXT NOT NULL,
      enabled INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS playlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      originalname TEXT NOT NULL,
      filepath TEXT NOT NULL,
      size INTEGER NOT NULL,
      duration INTEGER NOT NULL,
      orderIndex INTEGER NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loopPlaylist INTEGER DEFAULT 1,
      logoPath TEXT DEFAULT NULL,
      logoPosition TEXT DEFAULT 'top-right',
      textOverlay TEXT DEFAULT NULL,
      textPosition TEXT DEFAULT 'bottom-left',
      textColor TEXT DEFAULT '#ffffff',
      textSize INTEGER DEFAULT 24,
      resolution TEXT DEFAULT '720p',
      videoBitrate TEXT DEFAULT '2500k',
      audioBitrate TEXT DEFAULT '128k',
      aspectRatio TEXT DEFAULT '16:9',
      scaleMode TEXT DEFAULT 'fit'
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      videoId INTEGER NOT NULL,
      videoTitle TEXT NOT NULL,
      streamKeyId INTEGER NOT NULL,
      streamKeyName TEXT NOT NULL,
      scheduledTime TEXT NOT NULL,
      status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS license_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      usedBy TEXT DEFAULT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  // Run migrations to ensure columns exist in existing DB instances
  try {
    await dbInstance.run(`ALTER TABLE settings ADD COLUMN aspectRatio TEXT DEFAULT '16:9'`);
  } catch (err) {
    // Ignore error if column already exists
  }
  try {
    await dbInstance.run(`ALTER TABLE settings ADD COLUMN scaleMode TEXT DEFAULT 'fit'`);
  } catch (err) {
    // Ignore error if column already exists
  }

  // Seed default license key if not exists
  const keyExists = await dbInstance.get('SELECT * FROM license_keys LIMIT 1');
  if (!keyExists) {
    const now = new Date().toISOString();
    await dbInstance.run('INSERT INTO license_keys (key, usedBy, createdAt) VALUES (?, ?, ?)', ['STREAM-2026-LIVE', null, now]);
    await dbInstance.run('INSERT INTO license_keys (key, usedBy, createdAt) VALUES (?, ?, ?)', ['ADMIN-ACCESS-2026', null, now]);
    console.log('Seeded default license keys: STREAM-2026-LIVE, ADMIN-ACCESS-2026');
  }

  // Seed default admin user if not exists
  const adminExists = await dbInstance.get('SELECT * FROM users WHERE username = ?', ['admin']);
  if (!adminExists) {
    const defaultHash = hashPassword('admin123');
    await dbInstance.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', defaultHash]);
    console.log('Seeded default admin user: admin / admin123');
  }

  // Seed default settings if not exists
  const settingsCount = await dbInstance.get('SELECT COUNT(*) as count FROM settings');
  if (settingsCount && (settingsCount as any).count === 0) {
    await dbInstance.run(`
      INSERT INTO settings (
        loopPlaylist, logoPath, logoPosition, textOverlay, textPosition, textColor, textSize, resolution, videoBitrate, audioBitrate, aspectRatio, scaleMode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [1, null, 'top-right', 'Live Streaming Management System', 'bottom-left', '#ffffff', 24, '720p', '2500k', '128k', '16:9', 'fit']);
    console.log('Seeded default settings');
  }

  return dbInstance;
}

// Log helper to write to database
export async function logEvent(type: 'info' | 'warn' | 'error' | 'success', message: string) {
  try {
    const db = await getDb();
    const timestamp = new Date().toISOString();
    await db.run('INSERT INTO logs (timestamp, type, message) VALUES (?, ?, ?)', [
      timestamp,
      type,
      message
    ]);
    // Truncate logs if they exceed 500 records to keep db clean
    await db.run('DELETE FROM logs WHERE id IN (SELECT id FROM logs ORDER BY timestamp DESC LIMIT -1 OFFSET 500)');
    console.log(`[${type.toUpperCase()}] ${message}`);
  } catch (err) {
    console.error('Error writing log to db:', err);
  }
}
