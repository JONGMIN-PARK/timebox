import pg from 'pg';
import { lookup } from 'dns/promises';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import bcrypt from 'bcryptjs';
import { runMigrations } from './migrations.js';
import * as schema from './schema.js';

// Resolve hostname to IPv4 address to avoid IPv6 ENETUNREACH on Render
async function resolveToIPv4(dbUrl: string): Promise<string> {
  try {
    const url = new URL(dbUrl);
    // Skip if already an IPv4 address or localhost
    if (/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) || url.hostname === 'localhost') {
      return dbUrl;
    }
    const { address } = await lookup(url.hostname, { family: 4 });
    // Replace hostname with resolved IPv4, keep original host in sslmode/options for SNI
    const original = url.hostname;
    url.hostname = address;
    // Preserve original hostname for SSL SNI via search params
    if (!url.searchParams.has('options')) {
      url.searchParams.set('options', `project=${original.split('.')[0]}`);
    }
    return url.toString();
  } catch (err) {
    console.warn('IPv4 resolution failed, using original URL:', err);
    return dbUrl;
  }
}

// These are set during initDb() before any routes execute
let pool: pg.Pool;
let _db: NodePgDatabase<typeof schema>;

// Export db - guaranteed to be initialized before routes (initDb runs first in index.ts)
export function getDb() {
  return _db;
}
// Keep backward-compatible named export (accessed after initDb completes)
export let db: NodePgDatabase<typeof schema>;

// Initialize pool, db, and tables
export async function initDb() {
  const rawUrl = process.env.DATABASE_URL || '';
  const isLocal = rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1');
  const resolvedUrl = isLocal ? rawUrl : await resolveToIPv4(rawUrl);

  // Log connection host only (never log password)
  try {
    const parsed = new URL(resolvedUrl);
    console.log('DB connecting to:', parsed.hostname + ':' + parsed.port + parsed.pathname);
  } catch {
    console.log('DB connecting...');
  }

  pool = new pg.Pool({
    connectionString: resolvedUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    // Keep well under the Supabase free-tier client cap. A single Render
    // instance does not need many connections, and an oversized pool can hit
    // the pooler's client limit ("remaining connection slots are reserved"),
    // which surfaces as intermittent 500s after only a few requests.
    max: isLocal ? 20 : 8,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    // Recycle connections so stale ones are not reused — Supabase/Supavisor
    // drops idle server connections aggressively.
    maxLifetimeSeconds: 600,
  });

  // node-postgres emits 'error' on idle clients when the database drops a
  // connection (Supabase closes idle connections). Without this listener the
  // event would bubble up as an uncaught exception and crash the whole
  // process, taking down every subsequent request until Render restarts.
  pool.on('error', (err) => {
    console.error('[db] idle client error (recovered):', err.message);
  });

  _db = drizzle(pool, { schema });
  db = _db;

  const client = await pool.connect();
  try {
    await runMigrations(client);

    // Seed default categories if empty
    const catResult = await client.query('SELECT COUNT(*) as cnt FROM categories');
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
    const userResult = await client.query('SELECT COUNT(*) as cnt FROM users');
    if (parseInt(userResult.rows[0].cnt) === 0) {
      const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
      const adminUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
      const hash = bcrypt.hashSync(adminPassword, 10);
      await client.query(
        'INSERT INTO users (username, password_hash, display_name, role) VALUES ($1, $2, $3, $4)',
        [adminUsername, hash, 'Admin', 'admin'],
      );
      console.log('Default admin user created. Change password immediately after first login.');
    }

    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}

export async function closeDb() {
  await pool?.end();
}
