import express from "express";
import compression from "compression";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import dotenv from "dotenv";
import cron from "node-cron";
import { initDb } from "./db/index.js";
import { authMiddleware, adminMiddleware } from "./middleware/auth.js";
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
import { activityTracker } from "./middleware/activityTracker.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Initialize database (async)
await initDb();

// Middleware
app.use(compression());
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(s => s.trim())
  : undefined;
app.use(cors(allowedOrigins ? { origin: allowedOrigins, credentials: true } : undefined));
app.use(express.json({ limit: "1mb" }));

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

// Request logging
if (process.env.NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
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

// Protected routes
app.use("/api/todos", authMiddleware, todoRoutes);
app.use("/api/events", authMiddleware, eventRoutes);
app.use("/api/ddays", authMiddleware, ddayRoutes);
app.use("/api/categories", authMiddleware, categoryRoutes);
app.use("/api/timeblocks", authMiddleware, timeblockRoutes);
app.use("/api/telegram", authMiddleware, telegramRoutes);
app.use("/api/backup", authMiddleware, backupRoutes);
app.use("/api/files", authMiddleware, fileRoutes);
app.use("/api/reminders", authMiddleware, reminderRoutes);
app.use("/api/projects", authMiddleware, projectRoutes);
app.use("/api/projects", authMiddleware, projectTaskRoutes);
app.use("/api/projects", authMiddleware, projectPostRoutes);
app.use("/api/projects", authMiddleware, projectFileRoutes);
app.use("/api/projects", authMiddleware, projectMessageRoutes);
app.use("/api/admin/groups", authMiddleware, adminMiddleware, teamGroupRoutes);
app.use("/api/presence", authMiddleware, presenceRoutes);
app.use("/api/inbox", authMiddleware, inboxRoutes);
app.use("/api/chat", authMiddleware, chatRoutes);
app.use("/api/analytics", authMiddleware, adminMiddleware, analyticsRoutes);

// Serve static files in production
if (process.env.NODE_ENV === "production") {
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
  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Initialize Socket.io
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`TimeBox server running on http://localhost:${PORT}`);

  // Initialize Telegram bot only in production (prevents polling conflict with local dev)
  if (process.env.NODE_ENV === "production") {
    try {
      initTelegramBot();
    } catch (err) {
      console.log("Telegram bot init skipped:", (err as Error).message);
    }

    // Notify admins of deployment via Telegram
    setTimeout(async () => {
      try {
        const { db } = await import("./db/index.js");
        const { users, telegramConfig } = await import("./db/schema.js");
        const { eq, and } = await import("drizzle-orm");
        const { getTelegramBot } = await import("./telegram/bot.js");
        const bot = getTelegramBot();
        if (!bot) return;

        const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
        for (const admin of admins) {
          const [conf] = await db.select().from(telegramConfig)
            .where(and(eq(telegramConfig.userId, admin.id), eq(telegramConfig.active, true)));
          if (conf?.chatId) {
            const msg = `🚀 *TimeBox 배포 완료*\n\n📦 버전: v1.0.0\n⏰ ${new Date().toLocaleString("ko-KR")}\n✅ 서버가 정상 시작되었습니다.`;
            await bot.sendMessage(conf.chatId, msg, { parse_mode: "Markdown" });
          }
        }
        console.log("[deploy] Admin notification sent");
      } catch (e) {
        console.error("[deploy] Failed to notify admins:", e);
      }
    }, 5000); // 5초 후 (봇 초기화 대기)
  } else {
    console.log("Telegram bot skipped in dev mode (set NODE_ENV=production to enable)");
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
        console.log(`[cron] ${ready.length} due reminder(s) found`);

        // Send Telegram notification to each reminder's user
        const bot = getTelegramBot();
        if (bot) {
          for (const r of ready) {
            const conf = await db.select().from(telegramConfig).where(eq(telegramConfig.userId, r.userId));
            const chatId = conf[0]?.chatId;
            if (chatId && conf[0]?.active) {
              const msg = `🔔 *리마인더*\n\n⏰ *${r.title}*${r.message ? `\n${r.message}` : ""}\n\n_${new Date(r.remindAt).toLocaleString("ko-KR")}_`;
              try {
                await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
              } catch (e) {
                console.error("telegram-reminder:", e);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("reminder-cron:", err);
    }
  });

  // Auto-cleanup: permanently delete soft-deleted messages older than 30 days (runs daily at 3 AM)
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

      console.log(`[cron] Cleanup: removed old deleted messages`);
    } catch (err) {
      console.error("cleanup-cron:", err);
    }
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  httpServer.close();
  process.exit(0);
});
