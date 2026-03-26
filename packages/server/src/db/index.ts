import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import * as schema from "./schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || path.join(__dirname, "../../data/timebox.db");

// Ensure data directory exists
import fs from "fs";
import bcrypt from "bcrypt";
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Initialize tables
export function initDb() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#3b82f6',
      icon TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      all_day INTEGER NOT NULL DEFAULT 0,
      category_id INTEGER REFERENCES categories(id),
      recurrence_rule TEXT,
      color TEXT DEFAULT '#3b82f6',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS time_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      color TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      parent_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ddays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      target_date TEXT NOT NULL,
      color TEXT DEFAULT '#3b82f6',
      icon TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      remind_at TEXT NOT NULL,
      repeat_rule TEXT,
      source_type TEXT NOT NULL DEFAULT 'custom',
      source_id INTEGER,
      channel TEXT NOT NULL DEFAULT 'telegram',
      sent INTEGER NOT NULL DEFAULT 0,
      snoozed_until TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      uploaded_via TEXT NOT NULL DEFAULT 'web',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS telegram_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT,
      daily_briefing_time TEXT,
      active INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed default categories if empty
  const count = sqlite.prepare("SELECT COUNT(*) as cnt FROM categories").get() as { cnt: number };
  if (count.cnt === 0) {
    sqlite.exec(`
      INSERT INTO categories (name, color, icon) VALUES
        ('Work', '#3b82f6', 'briefcase'),
        ('Personal', '#8b5cf6', 'user'),
        ('Exercise', '#10b981', 'dumbbell'),
        ('Study', '#f59e0b', 'book-open'),
        ('Meeting', '#ef4444', 'users'),
        ('Break', '#6b7280', 'coffee');
    `);
  }

  // Create default admin if no users exist
  const userCount = sqlite.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number };
  if (userCount.cnt === 0) {
    const hash = bcrypt.hashSync("admin123", 10);
    sqlite.prepare("INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)").run("admin", hash, "Admin", "admin");
    console.log("Default admin user created: admin / admin123");
  }
}
