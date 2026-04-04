import express from "express";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import dotenv from "dotenv";
import cron from "node-cron";
import { validateEnv } from "./lib/env.js";
import { initDb } from "./db/index.js";
import { authMiddleware, adminMiddleware } from "./middleware/auth.js";
import { sanitizeMiddleware } from "./middleware/sanitize.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./lib/logger.js";
import authRoutes from "./routes/auth.js";
import todoRoutes from "./routes/todos.js";
import eventRoutes from "./routes/events.js";
import ddayRoutes from "./routes/ddays.js";
import categoryRoutes from "./routes/categories.js";
import timeblockRoutes from "./routes/timeblocks.js";
import telegramRoutes from "./routes/telegram.js";
import backupRoutes from "./routes/backup.js";
import fileRoutes from "./routes/files.js";
import reminderRoutes from "./routes/reminders.js";
import projectRoutes from "./routes/projects.js";
import projectTaskRoutes from "./routes/projectTasks.js";
import projectPostRoutes from "./routes/projectPosts.js";
import projectFileRoutes from "./routes/projectFiles.js";
import projectMessageRoutes from "./routes/projectMessages.js";
import teamGroupRoutes from "./routes/teamGroups.js";
import presenceRoutes from "./routes/presence.js";
import inboxRoutes from "./routes/inbox.js";
import chatRoutes from "./routes/chat.js";
import { initTelegramBot } from "./telegram/bot.js";
import { initSocket } from "./socket/index.js";
import analyticsRoutes from "./routes/analytics.js";
import calendarFeedRoutes from "./routes/calendarFeed.js";
import googleCalendarRoutes from "./routes/googleCalendar.js";
import summaryRoutes from "./routes/summary.js";
import exportRoutes from "./routes/export.js";
import sketchRoutes from "./routes/sketches.js";
import importRoutes from "./routes/import.js";
import { activityTracker } from "./middleware/activityTracker.js";
import { KST_TIMEZONE } from "./lib/kst.js";

dotenv.config();

// Validate all required environment variables at startup
const env = validateEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const PORT = env.PORT;

// Initialize database (async)
await initDb();

// Auto-migrate: ensure new columns exist
import { db } from "./db/index.js";
import { sql } from "drizzle-orm";
try {
  await db.execute(sql`SELECT status FROM todos LIMIT 0`);
} catch {
  logger.info("Auto-migrating: adding status column to todos table...");
  await db.execute(sql`ALTER TABLE todos ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`);
  await db.execute(sql`UPDATE todos SET status = 'completed' WHERE completed = true`);
  await db.execute(sql`UPDATE todos SET status = 'active' WHERE completed = false`);
  logger.info("Auto-migration complete: todos.status column added");
}
try {
  await db.execute(sql`SELECT deleted_at FROM todos LIMIT 0`);
} catch {
  logger.info("Auto-migrating: adding deleted_at column to todos table...");
  await db.execute(sql`ALTER TABLE todos ADD COLUMN deleted_at TEXT`);
  logger.info("Auto-migration complete: todos.deleted_at column added");
}
try {
  await db.execute(sql`SELECT project_id FROM events LIMIT 0`);
} catch {
  logger.info("Auto-migrating: adding project_id to events / todos, calendar_feed_token, project_invites...");
  await db.execute(sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS project_id INTEGER`);
  await db.execute(sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS project_id INTEGER`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS calendar_feed_token TEXT`);
  await db.execute(sql`
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
    )
  `);
  logger.info("Auto-migration complete: project bridge columns");
}

// Middleware
app.use(compression());
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(s => s.trim())
  : undefined;
app.use(cors(allowedOrigins ? { origin: allowedOrigins, credentials: true } : undefined));
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(sanitizeMiddleware);

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests, please try again later" },
});
app.use("/api/", apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: "Too many login attempts, please try again later" },
});
app.use("/api/auth/login", authLimiter);

// Per-user rate limiting for authenticated routes
const perUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use userId from auth token if available, fall back to IP
    return (req as any).userId?.toString() || req.ip || "unknown";
  },
  message: { success: false, error: "Per-user rate limit exceeded, please try again later" },
});

// Request logging
if (env.NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });
}

// Health check
app.get("/api/health", async (_req, res) => {
  try {
    const { db } = await import("./db/index.js");
    const { categories } = await import("./db/schema.js");
    await db.select().from(categories).limit(1);
    res.json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "error", db: "disconnected", timestamp: new Date().toISOString() });
  }
});

// Activity tracking (must be before routes to hook into res.finish)
app.use(activityTracker);

// Public routes
app.use("/api/auth", authRoutes);
app.use("/api/calendar", calendarFeedRoutes);
// Google OAuth popup callback (public — Google redirects here directly)
app.get("/api/google-calendar/oauth-popup", (req, res) => {
  const code = req.query.code as string || "";
  const error = req.query.error as string || "";
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html><html><body><script>
    window.opener && window.opener.postMessage(
      { type: "google-oauth-callback", code: ${JSON.stringify(code)}, error: ${JSON.stringify(error)} },
      window.location.origin
    );
    window.close();
  </script><p>Redirecting...</p></body></html>`);
});

// Protected routes (auth + per-user rate limiting)
const protectedMiddleware = [authMiddleware, perUserLimiter];
app.use("/api/todos", ...protectedMiddleware, todoRoutes);
app.use("/api/events", ...protectedMiddleware, eventRoutes);
app.use("/api/ddays", ...protectedMiddleware, ddayRoutes);
app.use("/api/categories", ...protectedMiddleware, categoryRoutes);
app.use("/api/timeblocks", ...protectedMiddleware, timeblockRoutes);
app.use("/api/telegram", ...protectedMiddleware, telegramRoutes);
app.use("/api/backup", ...protectedMiddleware, backupRoutes);
app.use("/api/files", ...protectedMiddleware, fileRoutes);
app.use("/api/reminders", ...protectedMiddleware, reminderRoutes);
app.use("/api/projects", ...protectedMiddleware, projectRoutes);
app.use("/api/projects", ...protectedMiddleware, projectTaskRoutes);
app.use("/api/projects", ...protectedMiddleware, projectPostRoutes);
app.use("/api/projects", ...protectedMiddleware, projectFileRoutes);
app.use("/api/projects", ...protectedMiddleware, projectMessageRoutes);
app.use("/api/admin/groups", authMiddleware, perUserLimiter, adminMiddleware, teamGroupRoutes);
app.use("/api/presence", ...protectedMiddleware, presenceRoutes);
app.use("/api/inbox", ...protectedMiddleware, inboxRoutes);
app.use("/api/chat", ...protectedMiddleware, chatRoutes);
app.use("/api/analytics", authMiddleware, perUserLimiter, adminMiddleware, analyticsRoutes);
app.use("/api/summary", ...protectedMiddleware, summaryRoutes);
app.use("/api/google-calendar", ...protectedMiddleware, googleCalendarRoutes); // auth-protected endpoints
app.use("/api/export", ...protectedMiddleware, exportRoutes);
app.use("/api/sketches", ...protectedMiddleware, sketchRoutes);
app.use("/api/import", ...protectedMiddleware, importRoutes);

// Global error handler (must be after all routes)
app.use(errorHandler);

// Serve static files in production
if (env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "../../client/dist");
  // Hashed assets (js, css, images) can be cached long-term
  app.use("/assets", express.static(path.join(clientDist, "assets"), {
    maxAge: "30d",
    immutable: true,
  }));
  // Everything else (index.html, manifest, icons) - no cache
  app.use(express.static(clientDist, {
    maxAge: 0,
    etag: true,
  }));
  // SPA fallback: only for navigation requests (not .js/.css/.map files)
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || /\.\w+$/.test(req.path)) {
      return next();
    }
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Initialize Socket.io
initSocket(httpServer);

httpServer.listen(PORT, () => {
  logger.info(`TimeBox server running on http://localhost:${PORT}`);

  // Initialize Telegram bot only in production (prevents polling conflict with local dev)
  if (env.NODE_ENV === "production") {
    initTelegramBot()
      .then(() => logger.info("Telegram bot initialization complete"))
      .catch((err) => logger.error("Telegram bot init failed", { error: (err as Error).message }));

    // Notify admins that server started (deploy notification is handled by CI)
    setTimeout(async () => {
      try {
        const { db } = await import("./db/index.js");
        const { users, telegramConfig } = await import("./db/schema.js");
        const { eq, and } = await import("drizzle-orm");
        const { getTelegramBot } = await import("./telegram/bot.js");
        const bot = getTelegramBot();
        if (!bot) return;

        const fs = await import("fs");

        // Read version
        const versionPath = path.join(__dirname, "../../shared/version.json");
        let version = "unknown";
        try {
          version = JSON.parse(fs.readFileSync(versionPath, "utf-8")).version;
        } catch {}

        const koTime = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
        const msg = `✅ *TimeBox v${version}* 서버 시작 완료\n⏰ ${koTime}`;

        const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
        for (const admin of admins) {
          const [conf] = await db.select().from(telegramConfig)
            .where(and(eq(telegramConfig.userId, admin.id), eq(telegramConfig.active, true)));
          if (conf?.chatId) {
            await bot.sendMessage(conf.chatId, msg, { parse_mode: "Markdown" });
          }
        }
        logger.info("Server start notification sent to admins");
      } catch (e) {
        logger.error("Failed to notify admins", { error: (e as Error).message });
      }
    }, 5000);
  } else {
    logger.info("Telegram bot skipped in dev mode (set NODE_ENV=production to enable)");
  }

  // Check for due reminders every minute and send Telegram notifications
  cron.schedule("* * * * *", async () => {
    try {
      const { db } = await import("./db/index.js");
      const { reminders, telegramConfig } = await import("./db/schema.js");
      const { eq, and, lte } = await import("drizzle-orm");
      const { getTelegramBot } = await import("./telegram/bot.js");

      const now = new Date().toISOString();
      const dueReminders = await db.select().from(reminders)
        .where(and(
          eq(reminders.sent, false),
          lte(reminders.remindAt, now)
        ));

      const ready = dueReminders.filter(r => !r.snoozedUntil || r.snoozedUntil <= now);

      if (ready.length > 0) {
        logger.info("Due reminders found", { count: ready.length });

        // Send Telegram notification to each reminder's user
        const bot = getTelegramBot();
        if (bot) {
          for (const r of ready) {
            const conf = await db.select().from(telegramConfig).where(eq(telegramConfig.userId, r.userId));
            const chatId = conf[0]?.chatId;
            if (chatId && conf[0]?.active) {
              const msg = `🔔 *리마인더*\n\n⏰ *${r.title}*${r.message ? `\n${r.message}` : ""}\n\n_${new Date(r.remindAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}_`;
              try {
                await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
              } catch (e) {
                logger.error("Telegram reminder failed", { error: (e as Error).message });
              }
            }
          }
        }
      }
    } catch (err) {
      logger.error("Reminder cron failed", { error: (err as Error).message });
    }
  });

  // Auto-cleanup: permanently delete soft-deleted messages older than 30 days (runs daily at 3 AM KST)
  cron.schedule("0 3 * * *", async () => {
    try {
      const { db } = await import("./db/index.js");
      const { chatMessages, messages } = await import("./db/schema.js");
      const { and, eq, lte } = await import("drizzle-orm");

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const cutoffStr = cutoff.toISOString();

      const chatResult = await db.delete(chatMessages)
        .where(and(eq(chatMessages.deleted, true), lte(chatMessages.createdAt, cutoffStr)));

      const projectResult = await db.delete(messages)
        .where(and(eq(messages.deleted, true), lte(messages.createdAt, cutoffStr)));

      logger.info("Cleanup: removed old deleted messages");
    } catch (err) {
      logger.error("Cleanup cron failed", { error: (err as Error).message });
    }
  }, { timezone: KST_TIMEZONE });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down...");
  httpServer.close();
  process.exit(0);
});
