import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import bcrypt from "bcrypt";
import * as schema from "./schema.js";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });

// Initialize tables
export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TEXT NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS registration_requests (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        message TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by INTEGER,
        reviewed_at TEXT,
        created_at TEXT NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS time_block_templates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        blocks TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#3b82f6',
        icon TEXT
      );

      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        all_day BOOLEAN NOT NULL DEFAULT false,
        category_id INTEGER REFERENCES categories(id),
        recurrence_rule TEXT,
        color TEXT DEFAULT '#3b82f6',
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS time_blocks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'other',
        color TEXT,
        completed BOOLEAN NOT NULL DEFAULT false,
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS todos (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        completed BOOLEAN NOT NULL DEFAULT false,
        priority TEXT NOT NULL DEFAULT 'medium',
        category TEXT NOT NULL DEFAULT 'personal',
        due_date TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        parent_id INTEGER,
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS ddays (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        target_date TEXT NOT NULL,
        color TEXT DEFAULT '#3b82f6',
        icon TEXT,
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        remind_at TEXT NOT NULL,
        repeat_rule TEXT,
        source_type TEXT NOT NULL DEFAULT 'custom',
        source_id INTEGER,
        channel TEXT NOT NULL DEFAULT 'telegram',
        sent BOOLEAN NOT NULL DEFAULT false,
        snoozed_until TEXT,
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        uploaded_via TEXT NOT NULL DEFAULT 'web',
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS telegram_config (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        chat_id TEXT,
        daily_briefing_time TEXT,
        active BOOLEAN NOT NULL DEFAULT false,
        updated_at TEXT NOT NULL DEFAULT now()
      );
    `);

    // Seed default categories if empty
    const catResult = await client.query("SELECT COUNT(*) as cnt FROM categories");
    if (parseInt(catResult.rows[0].cnt) === 0) {
      await client.query(`
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
    const userResult = await client.query("SELECT COUNT(*) as cnt FROM users");
    if (parseInt(userResult.rows[0].cnt) === 0) {
      const hash = bcrypt.hashSync("admin123", 10);
      await client.query(
        "INSERT INTO users (username, password_hash, display_name, role) VALUES ($1, $2, $3, $4)",
        ["admin", hash, "Admin", "admin"]
      );
      console.log("Default admin user created: admin / admin123");
    }
  } finally {
    client.release();
  }
}
