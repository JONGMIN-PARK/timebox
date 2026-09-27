import type { PoolClient } from 'pg';

// Keep applied migrations immutable. New schema changes append a new version.
const migrations = [
  {
    version: '0001_existing_schema',
    sql: `
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
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
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

      ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS to_user_trashed_at TEXT;
      ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS from_user_trashed_at TEXT;
      ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS to_user_purged_at TEXT;
      ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS from_user_purged_at TEXT;
      ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS deleted_at TEXT;
      CREATE INDEX IF NOT EXISTS idx_telegram_config_user ON telegram_config(user_id);
      CREATE INDEX IF NOT EXISTS idx_telegram_config_chat ON telegram_config(chat_id);
      CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(project_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS task_reactions (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        emoji TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_task_reactions_task ON task_reactions(task_id);

      CREATE TABLE IF NOT EXISTS chat_rooms (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'group',
        description TEXT,
        created_by INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS chat_members (
        id SERIAL PRIMARY KEY,
        room_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        joined_at TEXT NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_chat_members_room ON chat_members(room_id);
      CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);

      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        room_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'text',
        reply_to INTEGER,
        created_at TEXT NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS chat_message_reactions (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        emoji TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_reaction_unique ON chat_message_reactions(message_id, user_id, emoji);

      ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';

      CREATE TABLE IF NOT EXISTS chat_invites (
        id SERIAL PRIMARY KEY,
        room_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        invited_by INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_invite_unique ON chat_invites(room_id, user_id);

      CREATE TABLE IF NOT EXISTS user_activity_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        category TEXT NOT NULL,
        target_type TEXT,
        target_id INTEGER,
        project_id INTEGER,
        metadata TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity_log(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_activity_category ON user_activity_log(category, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_activity_login ON user_activity_log(user_id, action, created_at DESC);

      ALTER TABLE files ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE project_files ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

      ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS read_by TEXT NOT NULL DEFAULT '[]';

      ALTER TABLE todos ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE todos ADD COLUMN IF NOT EXISTS deleted_at TEXT;
      ALTER TABLE todos ADD COLUMN IF NOT EXISTS project_id INTEGER;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS project_id INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS calendar_feed_token TEXT UNIQUE;

      CREATE TABLE IF NOT EXISTS project_invites (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'member',
        created_by INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        used_at TEXT,
        used_by_user_id INTEGER,
        created_at TEXT NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_project_invites_project ON project_invites(project_id);

      ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_models TEXT NOT NULL DEFAULT '[]';

      ALTER TABLE time_blocks ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE time_blocks ADD COLUMN IF NOT EXISTS meta TEXT;

      CREATE TABLE IF NOT EXISTS task_work_logs (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL,
        project_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_task_work_logs_task ON task_work_logs(task_id);

      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(user_id, sent, remind_at);
      CREATE INDEX IF NOT EXISTS idx_messages_project_deleted ON messages(project_id, deleted);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_deleted ON chat_messages(deleted, created_at);

      CREATE TABLE IF NOT EXISTS google_calendar_config (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        token_expiry TEXT,
        email TEXT,
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_google_calendar_config_user ON google_calendar_config(user_id);
      ALTER TABLE events ADD COLUMN IF NOT EXISTS google_event_id TEXT;
      ALTER TABLE todos ADD COLUMN IF NOT EXISTS memo TEXT;

      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL DEFAULT 'text',
        title TEXT,
        content TEXT NOT NULL DEFAULT '',
        file_name TEXT,
        color TEXT,
        pinned BOOLEAN NOT NULL DEFAULT false,
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id, pinned DESC, updated_at DESC);
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS trashed_at TEXT;
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS summary TEXT;
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS labels TEXT;
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS archived_at TEXT;
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE notes ADD COLUMN IF NOT EXISTS remind_at TEXT;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'todos' AND column_name = 'status') THEN
          ALTER TABLE todos ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
          UPDATE todos SET status = CASE WHEN completed THEN 'completed' ELSE 'active' END;
        END IF;
      END $$;
`,
  },
  {
    version: '0002_reminder_delivery',
    sql: `
    ALTER TABLE reminders ADD COLUMN IF NOT EXISTS telegram_delivered_at TEXT;
    ALTER TABLE reminders ADD COLUMN IF NOT EXISTS telegram_claimed_at TEXT;
    ALTER TABLE reminders ADD COLUMN IF NOT EXISTS telegram_claim_token TEXT;
    CREATE INDEX IF NOT EXISTS idx_reminders_telegram_due ON reminders(remind_at)
      WHERE sent = false AND telegram_delivered_at IS NULL AND channel IN ('telegram', 'both');
  `,
  },
];

export async function runMigrations(client: Pick<PoolClient, 'query'>) {
  await client.query('BEGIN');
  try {
    // Serialize startup schema changes across application instances.
    await client.query('SELECT pg_advisory_xact_lock(74626901)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS timebox_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
    for (const migration of migrations) {
      const applied = await client.query(
        'SELECT version FROM timebox_migrations WHERE version = $1',
        [migration.version],
      );
      if (applied.rowCount) continue;
      await client.query(migration.sql);
      await client.query('INSERT INTO timebox_migrations (version) VALUES ($1)', [
        migration.version,
      ]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
