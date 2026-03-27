import { Router } from "express";
import { type AuthRequest } from "../middleware/auth.js";

const router = Router();

// In-memory store for online users (userId -> lastSeen timestamp)
const onlineUsers = new Map<number, { lastSeen: number; displayName: string; username: string }>();

// Heartbeat interval: consider user offline after 2 minutes of no heartbeat
const OFFLINE_THRESHOLD = 2 * 60 * 1000;

// POST /api/presence/heartbeat — report user is online
router.post("/heartbeat", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { displayName, username } = req.body;
  onlineUsers.set(userId, {
    lastSeen: Date.now(),
    displayName: displayName || username || `User #${userId}`,
    username: username || "",
  });
  res.json({ success: true });
});

// GET /api/presence/online — get list of online users
router.get("/online", async (req: AuthRequest, res) => {
  const now = Date.now();
  const online: { userId: number; displayName: string; username: string }[] = [];

  for (const [userId, data] of onlineUsers.entries()) {
    if (now - data.lastSeen < OFFLINE_THRESHOLD) {
      online.push({ userId, displayName: data.displayName, username: data.username });
    } else {
      onlineUsers.delete(userId); // Cleanup stale entries
    }
  }

  res.json({ success: true, data: online });
});

export default router;
