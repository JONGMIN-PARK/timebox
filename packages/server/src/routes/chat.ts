import { Router } from "express";
import { db } from "../db/index.js";
import { chatRooms, chatMembers, chatMessages, users } from "../db/schema.js";
import { eq, and, desc, inArray, lt, sql } from "drizzle-orm";
import { type AuthRequest, safeParseId } from "../middleware/auth.js";
import { getUserMap } from "../lib/userEnrichment.js";
import { emitToUser } from "../socket/index.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError, NotFoundError, ForbiddenError, ConflictError } from "../lib/errors.js";

const router = Router();

// ── Helper: verify room membership ──
async function verifyMembership(roomId: number, userId: number) {
  const [membership] = await db.select().from(chatMembers)
    .where(and(eq(chatMembers.roomId, roomId), eq(chatMembers.userId, userId)));
  return membership || null;
}

// GET / - List my chat rooms
router.get("/", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;

  const memberships = await db.select().from(chatMembers)
    .where(eq(chatMembers.userId, userId));

  const roomIds = memberships.map(m => m.roomId);
  if (roomIds.length === 0) {
    res.json({ success: true, data: [] });
    return;
  }

  const rooms = await db.select().from(chatRooms)
    .where(inArray(chatRooms.id, roomIds));

  // Get member counts per room
  const allMembers = await db.select().from(chatMembers)
    .where(inArray(chatMembers.roomId, roomIds));
  const memberCountMap = new Map<number, number>();
  for (const m of allMembers) {
    memberCountMap.set(m.roomId, (memberCountMap.get(m.roomId) || 0) + 1);
  }

  // Get last message per room in ONE query
  const lastMsgsResult = roomIds.length > 0 ? await db.execute(sql`
    SELECT DISTINCT ON (room_id) room_id, id, content, type, user_id, created_at
    FROM chat_messages
    WHERE room_id IN (${sql.join(roomIds.map(id => sql`${id}`), sql`, `)})
    ORDER BY room_id, id DESC
  `) : { rows: [] };
  const lastMessageMap = new Map<number, { id: number; content: string; type: string; userId: number; createdAt: string }>();
  for (const row of lastMsgsResult.rows as any[]) {
    lastMessageMap.set(row.room_id, {
      id: row.id,
      content: row.content,
      type: row.type,
      userId: row.user_id,
      createdAt: row.created_at,
    });
  }

  // Enrich sender names for last messages
  const senderIds = [...new Set([...lastMessageMap.values()].map(m => m.userId))];
  const userMap = await getUserMap(senderIds);

  // For direct rooms, get the other user's name
  const directRooms = rooms.filter(r => r.type === "direct");
  const directRoomMemberIds = new Set<number>();
  for (const r of directRooms) {
    const members = allMembers.filter(m => m.roomId === r.id);
    for (const m of members) {
      if (m.userId !== userId) directRoomMemberIds.add(m.userId);
    }
  }
  const directUserMap = await getUserMap([...directRoomMemberIds]);

  const data = rooms.map(room => {
    const lastMsg = lastMessageMap.get(room.id) || null;
    // For direct rooms, show the other person's name
    let displayName = room.name;
    if (room.type === "direct") {
      const otherMember = allMembers.find(m => m.roomId === room.id && m.userId !== userId);
      if (otherMember) {
        displayName = directUserMap.get(otherMember.userId) || room.name;
      }
    }
    return {
      ...room,
      displayName,
      memberCount: memberCountMap.get(room.id) || 0,
      lastMessage: lastMsg ? {
        id: lastMsg.id,
        content: lastMsg.content,
        type: lastMsg.type,
        senderName: userMap.get(lastMsg.userId) || "Unknown",
        createdAt: lastMsg.createdAt,
      } : null,
    };
  });

  res.json({ success: true, data });
}));

// POST / - Create a new chat room
router.post("/", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { name, type, description, memberIds } = req.body;

  if (!name?.trim()) {
    throw new ValidationError("Room name is required");
  }

  const [room] = await db.insert(chatRooms).values({
    name: name.trim(),
    type: type || "group",
    description: description || null,
    createdBy: userId,
  }).returning();

  // Add creator as owner
  await db.insert(chatMembers).values({
    roomId: room.id,
    userId,
    role: "owner",
  });

  // Add other members
  if (Array.isArray(memberIds) && memberIds.length > 0) {
    const uniqueIds = [...new Set(memberIds.filter((id: number) => id !== userId))];
    if (uniqueIds.length > 0) {
      await db.insert(chatMembers).values(
        uniqueIds.map((id: number) => ({
          roomId: room.id,
          userId: id,
          role: "member" as const,
        }))
      );
    }
  }

  res.json({ success: true, data: room });
}));

// POST /direct - Find or create a direct (1:1) chat room
router.post("/direct", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { targetUserId } = req.body;

  if (!targetUserId || targetUserId === userId) {
    throw new ValidationError("Valid target user is required");
  }

  // Verify target user exists
  const [targetUser] = await db.select({ id: users.id, displayName: users.displayName, username: users.username })
    .from(users).where(eq(users.id, targetUserId));
  if (!targetUser) {
    throw new NotFoundError("Target user");
  }

  // Find existing direct room between the two users
  const myMemberships = await db.select().from(chatMembers)
    .where(eq(chatMembers.userId, userId));
  const myRoomIds = myMemberships.map(m => m.roomId);

  if (myRoomIds.length > 0) {
    const directRooms = await db.select().from(chatRooms)
      .where(and(inArray(chatRooms.id, myRoomIds), eq(chatRooms.type, "direct")));

    for (const room of directRooms) {
      const members = await db.select().from(chatMembers)
        .where(eq(chatMembers.roomId, room.id));
      const memberUserIds = members.map(m => m.userId);
      if (memberUserIds.length === 2 && memberUserIds.includes(targetUserId)) {
        res.json({ success: true, data: room });
        return;
      }
    }
  }

  // Create new direct room
  const targetName = targetUser.displayName || targetUser.username;
  const [currentUser] = await db.select({ displayName: users.displayName, username: users.username })
    .from(users).where(eq(users.id, userId));
  const myName = currentUser?.displayName || currentUser?.username || "User";

  const [room] = await db.insert(chatRooms).values({
    name: `${myName}, ${targetName}`,
    type: "direct",
    createdBy: userId,
  }).returning();

  await db.insert(chatMembers).values([
    { roomId: room.id, userId, role: "owner" as const },
    { roomId: room.id, userId: targetUserId, role: "member" as const },
  ]);

  res.json({ success: true, data: room });
}));

// GET /:roomId - Get room details with member list
router.get("/:roomId", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const roomId = safeParseId(req.params.roomId);
  if (!roomId) { throw new ValidationError("Invalid room ID"); }

  const membership = await verifyMembership(roomId, userId);
  if (!membership) { throw new ForbiddenError("Not a member of this room"); }

  const [room] = await db.select().from(chatRooms).where(eq(chatRooms.id, roomId));
  if (!room) { throw new NotFoundError("Room"); }

  const members = await db.select().from(chatMembers)
    .where(eq(chatMembers.roomId, roomId));

  const userMap = await getUserMap(members.map(m => m.userId));

  const membersWithNames = members.map(m => ({
    ...m,
    displayName: userMap.get(m.userId) || "Unknown",
  }));

  res.json({ success: true, data: { ...room, members: membersWithNames } });
}));

// DELETE /:roomId - Delete room (owner only)
router.delete("/:roomId", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const roomId = safeParseId(req.params.roomId);
  if (!roomId) { throw new ValidationError("Invalid room ID"); }

  const membership = await verifyMembership(roomId, userId);
  if (!membership || membership.role !== "owner") {
    throw new ForbiddenError("Only the room owner can delete the room");
  }

  // Delete messages, members, then room
  await db.delete(chatMessages).where(eq(chatMessages.roomId, roomId));
  await db.delete(chatMembers).where(eq(chatMembers.roomId, roomId));
  await db.delete(chatRooms).where(eq(chatRooms.id, roomId));

  res.json({ success: true, data: { deleted: true } });
}));

// GET /:roomId/messages - Get messages with pagination
router.get("/:roomId/messages", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const roomId = safeParseId(req.params.roomId);
  if (!roomId) { throw new ValidationError("Invalid room ID"); }

  const membership = await verifyMembership(roomId, userId);
  if (!membership) { throw new ForbiddenError("Not a member of this room"); }

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const before = parseInt(req.query.before as string);

  const conditions = [eq(chatMessages.roomId, roomId)];
  if (!isNaN(before) && before > 0) {
    conditions.push(lt(chatMessages.id, before));
  }

  const result = await db.select().from(chatMessages)
    .where(and(...conditions))
    .orderBy(desc(chatMessages.id))
    .limit(limit);

  // Enrich with sender names
  const senderIds = [...new Set(result.map(m => m.userId))];
  const userMap = await getUserMap(senderIds);

  // Map deleted messages
  const data = result.map(m => ({
    ...m,
    content: m.deleted ? "" : m.content,
    senderName: m.deleted ? "" : (userMap.get(m.userId) || "Unknown"),
    readBy: m.readBy || "[]",
    readCount: (JSON.parse(m.readBy || "[]") as number[]).length,
  }));

  // Return in chronological order
  data.reverse();

  res.json({ success: true, data });
}));

// POST /:roomId/messages - Send a message
router.post("/:roomId/messages", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const roomId = safeParseId(req.params.roomId);
  if (!roomId) { throw new ValidationError("Invalid room ID"); }

  const membership = await verifyMembership(roomId, userId);
  if (!membership) { throw new ForbiddenError("Not a member of this room"); }

  const { content, type, replyTo } = req.body;
  if (!content?.trim()) {
    throw new ValidationError("Message content is required");
  }

  const [message] = await db.insert(chatMessages).values({
    roomId,
    userId,
    content: content.trim(),
    type: type || "text",
    replyTo: replyTo || null,
  }).returning();

  // Enrich with sender name
  const userMap = await getUserMap([userId]);

  // Parse @mentions and notify
  const mentionRegex = /@(\w+)/g;
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    const mentionedUsername = match[1];
    // Find user by username
    const [mentioned] = await db.select().from(users)
      .where(eq(users.username, mentionedUsername));
    if (mentioned && mentioned.id !== userId) {
      emitToUser(mentioned.id, "chat:mentioned", {
        roomId, messageId: message.id, fromUserId: userId,
        fromName: userMap.get(userId) || "Unknown",
        content: content.slice(0, 100),
      });
    }
  }

  res.json({
    success: true,
    data: {
      ...message,
      senderName: userMap.get(userId) || "Unknown",
    },
  });
}));

// PUT /:roomId/read - Mark messages as read
router.put("/:roomId/read", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const roomId = safeParseId(req.params.roomId);
  if (!roomId) { throw new ValidationError("Invalid ID"); }

  // Get unread messages in this room
  const msgs = await db.select().from(chatMessages)
    .where(eq(chatMessages.roomId, roomId));

  // Update readBy for messages not yet read by this user
  for (const msg of msgs) {
    const readBy = JSON.parse(msg.readBy || "[]") as number[];
    if (!readBy.includes(userId) && msg.userId !== userId) {
      readBy.push(userId);
      await db.update(chatMessages).set({ readBy: JSON.stringify(readBy) })
        .where(eq(chatMessages.id, msg.id));
    }
  }

  res.json({ success: true });
}));

// DELETE /:roomId/messages/:messageId - Delete own message (soft delete)
router.delete("/:roomId/messages/:messageId", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const roomId = safeParseId(req.params.roomId);
  const messageId = safeParseId(req.params.messageId);
  if (!roomId || !messageId) { throw new ValidationError("Invalid ID"); }

  const [msg] = await db.select().from(chatMessages)
    .where(and(eq(chatMessages.id, messageId), eq(chatMessages.roomId, roomId)));

  if (!msg) { throw new NotFoundError("Message"); }

  if (msg.userId !== userId) {
    throw new ForbiddenError("Can only delete your own messages");
  }

  await db.update(chatMessages).set({ deleted: true })
    .where(eq(chatMessages.id, messageId));

  res.json({ success: true, data: { deleted: true } });
}));

// POST /:roomId/members - Add member to room (admin/owner only)
router.post("/:roomId/members", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const roomId = safeParseId(req.params.roomId);
  if (!roomId) { throw new ValidationError("Invalid room ID"); }

  const membership = await verifyMembership(roomId, userId);
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    throw new ForbiddenError("Only admin or owner can add members");
  }

  const { userId: newUserId } = req.body;
  if (!newUserId) { throw new ValidationError("userId is required"); }

  // Check if already a member
  const existing = await verifyMembership(roomId, newUserId);
  if (existing) { throw new ConflictError("User is already a member"); }

  // Verify user exists
  const [targetUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, newUserId));
  if (!targetUser) { throw new NotFoundError("User"); }

  const [member] = await db.insert(chatMembers).values({
    roomId,
    userId: newUserId,
    role: "member",
  }).returning();

  const userMap = await getUserMap([newUserId]);

  res.json({
    success: true,
    data: { ...member, displayName: userMap.get(newUserId) || "Unknown" },
  });
}));

// DELETE /:roomId/members/:userId - Remove member or leave room
router.delete("/:roomId/members/:userId", asyncHandler<AuthRequest>(async (req, res) => {
  const currentUserId = req.userId!;
  const roomId = safeParseId(req.params.roomId);
  const targetUserId = safeParseId(req.params.userId);
  if (!roomId || !targetUserId) { throw new ValidationError("Invalid room or user ID"); }

  const currentMembership = await verifyMembership(roomId, currentUserId);
  if (!currentMembership) { throw new ForbiddenError("Not a member of this room"); }

  const isSelf = currentUserId === targetUserId;

  if (!isSelf) {
    // Must be admin or owner to remove others
    if (currentMembership.role !== "owner" && currentMembership.role !== "admin") {
      throw new ForbiddenError("Only admin or owner can remove members");
    }

    // Cannot remove someone with equal or higher role
    const targetMembership = await verifyMembership(roomId, targetUserId);
    if (!targetMembership) { throw new NotFoundError("User is not a member of this room"); }
    if (targetMembership.role === "owner") {
      throw new ForbiddenError("Cannot remove the room owner");
    }
  }

  await db.delete(chatMembers).where(
    and(eq(chatMembers.roomId, roomId), eq(chatMembers.userId, targetUserId))
  );

  res.json({ success: true, data: { removed: true } });
}));

export default router;
