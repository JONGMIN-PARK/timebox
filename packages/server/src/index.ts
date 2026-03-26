import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { initDb } from "./db/index.js";
import { authMiddleware } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import todoRoutes from "./routes/todos.js";
import eventRoutes from "./routes/events.js";
import ddayRoutes from "./routes/ddays.js";
import categoryRoutes from "./routes/categories.js";
import timeblockRoutes from "./routes/timeblocks.js";
import telegramRoutes from "./routes/telegram.js";
import { initTelegramBot } from "./telegram/bot.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
initDb();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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
});
