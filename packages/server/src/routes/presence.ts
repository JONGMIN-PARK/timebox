import { Router } from "express";
import { type AuthRequest } from "../middleware/auth.js";
import { emitPresenceUpdate } from "../socket/index.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

// In-memory store for online users (userId -> lastSeen timestamp)
const onlineUsers = new Map<number, { lastSeen: number; displayName: string; username: string }>();

// Heartbeat interval: consider user offline after 2 minutes of no heartbeat
const OFFLINE_THRESHOLD = 2 * 60 * 1000;

// POST /api/presence/heartbeat — report user is online
router.post("/heartbeat", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { displayName, username } = req.body;
  const wasOnline = onlineUsers.has(userId);
  onlineUsers.set(userId, {
    lastSeen: Date.now(),
    displayName: displayName || username || `User #${userId}`,
    username: username || "",
  });
  // Broadcast presence update when a new user comes online
  if (!wasOnline) {
    emitPresenceUpdate();
  }
  res.json({ success: true });
}));

// GET /api/presence/online — get list of online users (filtered by group)
router.get("/online", asyncHandler<AuthRequest>(async (req, res) => {
  const now = Date.now();
  const userId = req.userId!;
  const online: { userId: number; displayName: string; username: string }[] = [];

  for (const [uid, data] of onlineUsers.entries()) {
    if (now - data.lastSeen < OFFLINE_THRESHOLD) {
      online.push({ userId: uid, displayName: data.displayName, username: data.username });
    } else {
      onlineUsers.delete(uid);
    }
  }

  // Filter by group membership (same logic as inbox/users)
  const { db } = await import("../db/index.js");
  const { users, teamGroupMembers } = await import("../db/schema.js");
  const { eq, inArray } = await import("drizzle-orm");

  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));

  if (me?.role === "admin") {
    // Admin sees everyone
    res.json({ success: true, data: online.filter(u => u.userId !== userId) });
    return;
  }

  const myGroups = await db.select({ groupId: teamGroupMembers.groupId })
    .from(teamGroupMembers).where(eq(teamGroupMembers.userId, userId));
  const myGroupIds = myGroups.map(g => g.groupId);

  if (myGroupIds.length === 0) {
    // No group - only see admins who are online
    const adminUsers = await db.select({ id: users.id }).from(users)
      .where(eq(users.role, "admin"));
    const adminIds = new Set(adminUsers.map(a => a.id));
    res.json({ success: true, data: online.filter(u => u.userId !== userId && adminIds.has(u.userId)) });
    return;
  }

  const groupMembers = await db.select({ userId: teamGroupMembers.userId })
    .from(teamGroupMembers).where(inArray(teamGroupMembers.groupId, myGroupIds));
  const allowedIds = new Set(groupMembers.map(m => m.userId));

  // Also include admins
  const adminUsers = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  adminUsers.forEach(a => allowedIds.add(a.id));

  res.json({ success: true, data: online.filter(u => u.userId !== userId && allowedIds.has(u.userId)) });
}));

export default router;
