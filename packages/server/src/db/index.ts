import pg from "pg";
import { lookup } from "dns/promises";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import bcrypt from "bcrypt";
import * as schema from "./schema.js";

// Resolve hostname to IPv4 address to avoid IPv6 ENETUNREACH on Render
async function resolveToIPv4(dbUrl: string): Promise<string> {
  try {
    const url = new URL(dbUrl);
    // Skip if already an IPv4 address or localhost
    if (/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) || url.hostname === "localhost") {
      return dbUrl;
    }
    const { address } = await lookup(url.hostname, { family: 4 });
    // Replace hostname with resolved IPv4, keep original host in sslmode/options for SNI
    const original = url.hostname;
    url.hostname = address;
    // Preserve original hostname for SSL SNI via search params
    if (!url.searchParams.has("options")) {
      url.searchParams.set("options", `project=${original.split(".")[0]}`);
    }
    return url.toString();
  } catch (err) {
    console.warn("IPv4 resolution failed, using original URL:", err);
    return dbUrl;
  }
}

// These are set during initDb() before any routes execute
let pool: pg.Pool;
let _db: NodePgDatabase<typeof schema>;

// Export db - guaranteed to be initialized before routes (initDb runs first in index.ts)
export function getDb() { return _db; }
// Keep backward-compatible named export (accessed after initDb completes)
export let db: NodePgDatabase<typeof schema>;

// Initialize pool, db, and tables
export async function initDb() {
  const rawUrl = process.env.DATABASE_URL || "";
  const isLocal = rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1");
  const resolvedUrl = isLocal ? rawUrl : await resolveToIPv4(rawUrl);

  // Log connection host only (never log password)
  try {
    const parsed = new URL(resolvedUrl);
    console.log("DB connecting to:", parsed.hostname + ":" + parsed.port + parsed.pathname);
  } catch {
    console.log("DB connecting...");
  }

  pool = new pg.Pool({
    connectionString: resolvedUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 20,               // max connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  _db = drizzle(pool, { schema });
  db = _db;

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

      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT NOT NULL DEFAULT '#3b82f6',
        icon TEXT,
        owner_id INTEGER NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'team',
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS project_members (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        joined_at TEXT NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS project_tasks (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'todo',
        priority TEXT NOT NULL DEFAULT 'medium',
        assignee_id INTEGER,
        reporter_id INTEGER NOT NULL,
        due_date TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        sort_order INTEGER NOT NULL DEFAULT 0,
        parent_id INTEGER,
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS task_comments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id INTEGER,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT now()
      );

      -- Indexes for common queries
      CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
      CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
      CREATE INDEX IF NOT EXISTS idx_time_blocks_user_id ON time_blocks(user_id);
      CREATE INDEX IF NOT EXISTS idx_ddays_user_id ON ddays(user_id);
      CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
      CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
      CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
      CREATE INDEX IF NOT EXISTS idx_time_blocks_date ON time_blocks(date);
      CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee ON project_tasks(assignee_id);
      CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
      CREATE INDEX IF NOT EXISTS idx_activity_log_project ON activity_log(project_id);

      CREATE TABLE IF NOT EXISTS task_transfers (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL,
        project_id INTEGER NOT NULL,
        from_user_id INTEGER NOT NULL,
        to_user_id INTEGER NOT NULL,
        message TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT now(),
        responded_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_task_transfers_to_user ON task_transfers(to_user_id);

      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        pinned BOOLEAN NOT NULL DEFAULT false,
        category TEXT NOT NULL DEFAULT 'discussion',
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS post_comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS project_files (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        uploader_id INTEGER NOT NULL,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        folder TEXT NOT NULL DEFAULT '/',
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        channel TEXT NOT NULL DEFAULT 'general',
        sender_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'text',
        reply_to INTEGER,
        created_at TEXT NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_posts_project ON posts(project_id);
      CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(project_id, author_id);
      CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);
      CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);
      CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id);
      CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(project_id, channel);
      CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);

      CREATE TABLE IF NOT EXISTS team_groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT NOT NULL DEFAULT '#3b82f6',
        created_by INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS team_group_members (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        joined_at TEXT NOT NULL DEFAULT now(),
        UNIQUE(group_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_tgm_group ON team_group_members(group_id);
      CREATE INDEX IF NOT EXISTS idx_tgm_user ON team_group_members(user_id);

      ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_group_id INTEGER;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_date TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS docs TEXT;
      ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS start_date TEXT;

      CREATE TABLE IF NOT EXISTS inbox_messages (
        id SERIAL PRIMARY KEY,
        from_user_id INTEGER NOT NULL,
        to_user_id INTEGER NOT NULL,
        subject TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'message',
        related_project_id INTEGER,
        related_task_id INTEGER,
        read BOOLEAN NOT NULL DEFAULT false,
        created_at TEXT NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_inbox_to_user ON inbox_messages(to_user_id);
      CREATE INDEX IF NOT EXISTS idx_inbox_from_user ON inbox_messages(from_user_id);

      CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(project_id, status);
      CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(project_id, category);
      CREATE INDEX IF NOT EXISTS idx_inbox_to_read ON inbox_messages(to_user_id, read);
      CREATE INDEX IF NOT EXISTS idx_inbox_created ON inbox_messages(to_user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_telegram_config_user ON telegram_config(user_id);
      CREATE INDEX IF NOT EXISTS idx_telegram_config_chat ON telegram_config(chat_id);
      CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(project_id, created_at DESC);
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
      const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";
      const adminUsername = process.env.DEFAULT_ADMIN_USERNAME || "admin";
      const hash = bcrypt.hashSync(adminPassword, 10);
      await client.query(
        "INSERT INTO users (username, password_hash, display_name, role) VALUES ($1, $2, $3, $4)",
        [adminUsername, hash, "Admin", "admin"]
      );
      console.log("Default admin user created. Change password immediately after first login.");
    }

    console.log("Database initialized successfully");
  } finally {
    client.release();
  }
}
