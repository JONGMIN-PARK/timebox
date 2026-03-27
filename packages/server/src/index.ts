import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cron from "node-cron";
import { initDb } from "./db/index.js";
import { authMiddleware } from "./middleware/auth.js";
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
import { initTelegramBot } from "./telegram/bot.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database (async)
await initDb();

// Middleware
app.use(cors());
app.use(express.json());

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

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`TimeBox server running on http://localhost:${PORT}`);

  // Initialize Telegram bot only in production (prevents polling conflict with local dev)
  if (process.env.NODE_ENV === "production") {
    try {
      initTelegramBot();
    } catch (err) {
      console.log("Telegram bot init skipped:", (err as Error).message);
    }
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

        // Send Telegram notification
        const bot = getTelegramBot();
        if (bot) {
          const conf = await db.select().from(telegramConfig).limit(1);
          const chatId = conf[0]?.chatId;
          if (chatId) {
            for (const r of ready) {
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
});
