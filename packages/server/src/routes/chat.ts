import { Router } from "express";
import { db } from "../db/index.js";
import { chatRooms, chatMembers, chatMessages, chatMessageReactions, chatInvites, users } from "../db/schema.js";
import { eq, and, desc, inArray, isNull, isNotNull, lt, sql } from "drizzle-orm";
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

// ── Helper: aggregate reactions for a set of message ids ──
// Returns a map: messageId -> [{ emoji, count, mine }]
async function reactionsForMessages(messageIds: number[], viewerId: number) {
  const map = new Map<number, { emoji: string; count: number; mine: boolean }[]>();
  if (messageIds.length === 0) return map;
  const rows = await db.select().from(chatMessageReactions)
    .where(inArray(chatMessageReactions.messageId, messageIds));
  // Group by messageId + emoji preserving first-seen order.
  for (const r of rows) {
    const list = map.get(r.messageId) || [];
    let entry = list.find((e) => e.emoji === r.emoji);
    if (!entry) { entry = { emoji: r.emoji, count: 0, mine: false }; list.push(entry); }
    entry.count += 1;
    if (r.userId === viewerId) entry.mine = true;
    map.set(r.messageId, list);
  }
  return map;
}

// ── Helper: build reply previews for a set of replyTo ids ──
async function replyPreviews(replyIds: number[]) {
  const map = new Map<number, { id: number; senderName: string; content: string; type: string }>();
  if (replyIds.length === 0) return map;
  const rows = await db.select().from(chatMessages).where(inArray(chatMessages.id, replyIds));
  const names = await getUserMap([...new Set(rows.map((m) => m.userId))]);
  for (const m of rows) {
    map.set(m.id, {
      id: m.id,
      senderName: m.deleted ? "" : (names.get(m.userId) || "Unknown"),
      content: m.deleted ? "" : m.content,
      type: m.type,
    });
  }
  return map;
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
    .where(and(inArray(chatRooms.id, roomIds), isNull(chatRooms.deletedAt)));

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
  const { name, type, description, memberIds, visibility } = req.body;

  if (!name?.trim()) {
    throw new ValidationError("Room name is required");
  }

  const [room] = await db.insert(chatRooms).values({
    name: name.trim(),
    type: type || "group",
    visibility: visibility === "public" ? "public" : "private",
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

// GET /trash - List my trashed rooms (rooms I own that were soft-deleted)
router.get("/trash", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const owned = await db.select().from(chatMembers)
    .where(and(eq(chatMembers.userId, userId), eq(chatMembers.role, "owner")));
  const roomIds = owned.map((m) => m.roomId);
  if (roomIds.length === 0) { res.json({ success: true, data: [] }); return; }
  const rooms = await db.select().from(chatRooms)
    .where(and(inArray(chatRooms.id, roomIds), isNotNull(chatRooms.deletedAt)))
    .orderBy(desc(chatRooms.deletedAt));
  res.json({ success: true, data: rooms });
}));

// GET /public - Browse public rooms the user hasn't joined yet
router.get("/public", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const myMemberships = await db.select().from(chatMembers).where(eq(chatMembers.userId, userId));
  const myRoomIds = new Set(myMemberships.map((m) => m.roomId));

  const publicRooms = await db.select().from(chatRooms)
    .where(and(eq(chatRooms.visibility, "public"), eq(chatRooms.type, "group"), isNull(chatRooms.deletedAt)))
    .orderBy(desc(chatRooms.updatedAt));
  const notJoined = publicRooms.filter((r) => !myRoomIds.has(r.id));
  if (notJoined.length === 0) { res.json({ success: true, data: [] }); return; }

  const roomIds = notJoined.map((r) => r.id);
  const members = await db.select().from(chatMembers).where(inArray(chatMembers.roomId, roomIds));
  const countMap = new Map<number, number>();
  for (const m of members) countMap.set(m.roomId, (countMap.get(m.roomId) || 0) + 1);

  const data = notJoined.map((r) => ({ ...r, memberCount: countMap.get(r.id) || 0 }));
  res.json({ success: true, data });
}));

// POST /:roomId/join - Join a public room directly
router.post("/:roomId/join", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const roomId = safeParseId(req.params.roomId);
  if (!roomId) { throw new ValidationError("Invalid room ID"); }

  const [room] = await db.select().from(chatRooms).where(eq(chatRooms.id, roomId));
  if (!room || room.deletedAt) { throw new NotFoundError("Room"); }
  if (room.visibility !== "public" || room.type !== "group") {
    throw new ForbiddenError("This room is invite-only");
  }

  const existing = await verifyMembership(roomId, userId);
  if (!existing) {
    await db.insert(chatMembers).values({ roomId, userId, role: "member" });
    // Any pending invite is now redundant.
    await db.delete(chatInvites).where(and(eq(chatInvites.roomId, roomId), eq(chatInvites.userId, userId)));
    emitToUser(userId, "chat:rooms-updated", { roomId });
  }
  res.json({ success: true, data: room });
}));

// GET /invites - My pending room invitations
router.get("/invites", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const invites = await db.select().from(chatInvites).where(eq(chatInvites.userId, userId));
  if (invites.length === 0) { res.json({ success: true, data: [] }); return; }

  const roomIds = invites.map((i) => i.roomId);
  const rooms = await db.select().from(chatRooms).where(inArray(chatRooms.id, roomIds));
  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const inviterMap = await getUserMap(invites.map((i) => i.invitedBy));

  // Drop invites whose room was deleted; surface the rest with room + inviter names.
  const data = invites
    .filter((i) => roomMap.get(i.roomId) && !roomMap.get(i.roomId)!.deletedAt)
    .map((i) => ({
      id: i.id,
      roomId: i.roomId,
      roomName: roomMap.get(i.roomId)!.name,
      invitedBy: i.invitedBy,
      inviterName: inviterMap.get(i.invitedBy) || "Unknown",
      createdAt: i.createdAt,
    }));
  res.json({ success: true, data });
}));

// POST /invites/:roomId/accept - Accept a pending invite (join the room)
router.post("/invites/:roomId/accept", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const roomId = safeParseId(req.params.roomId);
  if (!roomId) { throw new ValidationError("Invalid room ID"); }

  const [invite] = await db.select().from(chatInvites)
    .where(and(eq(chatInvites.roomId, roomId), eq(chatInvites.userId, userId)));
  if (!invite) { throw new NotFoundError("Invite"); }

  const existing = await verifyMembership(roomId, userId);
  if (!existing) {
    await db.insert(chatMembers).values({ roomId, userId, role: "member" });
  }
  await db.delete(chatInvites).where(eq(chatInvites.id, invite.id));
  emitToUser(userId, "chat:rooms-updated", { roomId });
  res.json({ success: true, data: { joined: true, roomId } });
}));

// POST /invites/:roomId/decline - Decline a pending invite
router.post("/invites/:roomId/decline", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const roomId = safeParseId(req.params.roomId);
  if (!roomId) { throw new ValidationError("Invalid room ID"); }
  await db.delete(chatInvites).where(and(eq(chatInvites.roomId, roomId), eq(chatInvites.userId, userId)));
  res.json({ success: true, data: { declined: true } });
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

// DELETE /:roomId - Move room to trash (soft delete; owner only)
router.delete("/:roomId", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const roomId = safeParseId(req.params.roomId);
  if (!roomId) { throw new ValidationError("Invalid room ID"); }

  const membership = await verifyMembership(roomId, userId);
  if (!membership || membership.role !== "owner") {
    throw new ForbiddenError("Only the room owner can delete the room");
  }

  const [target] = await db.select().from(chatRooms).where(eq(chatRooms.id, roomId));
  if (target?.type === "global") {
    throw new ForbiddenError("The all-members room cannot be deleted");
  }

  // Soft delete: keep messages/members so it can be restored from the trash.
  await db.update(chatRooms)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(chatRooms.id, roomId));

  // Notify members so their room lists update.
  const members = await db.select().from(chatMembers).where(eq(chatMembers.roomId, roomId));
  for (const m of members) emitToUser(m.userId, "chat:rooms-updated", { roomId });

  res.json({ success: true, data: { trashed: true } });
}));

// POST /:roomId/restore - Restore a trashed room (owner only)
router.post("/:roomId/restore", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const roomId = safeParseId(req.params.roomId);
  if (!roomId) { throw new ValidationError("Invalid room ID"); }

  const membership = await verifyMembership(roomId, userId);
  if (!membership || membership.role !== "owner") {
    throw new ForbiddenError("Only the room owner can restore the room");
  }

  await db.update(chatRooms).set({ deletedAt: null }).where(eq(chatRooms.id, roomId));
  const members = await db.select().from(chatMembers).where(eq(chatMembers.roomId, roomId));
  for (const m of members) emitToUser(m.userId, "chat:rooms-updated", { roomId });

  res.json({ success: true, data: { restored: true } });
}));

// DELETE /:roomId/permanent - Permanently delete a trashed room (owner only)
router.delete("/:roomId/permanent", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const roomId = safeParseId(req.params.roomId);
  if (!roomId) { throw new ValidationError("Invalid room ID"); }

  const membership = await verifyMembership(roomId, userId);
  if (!membership || membership.role !== "owner") {
    throw new ForbiddenError("Only the room owner can delete the room");
  }

  const [target] = await db.select().from(chatRooms).where(eq(chatRooms.id, roomId));
  if (target?.type === "global") {
    throw new ForbiddenError("The all-members room cannot be deleted");
  }

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

  // Reactions + reply previews for these messages.
  const reactionMap = await reactionsForMessages(result.map((m) => m.id), userId);
  const replyMap = await replyPreviews(
    [...new Set(result.map((m) => m.replyTo).filter((v): v is number => !!v))],
  );

  // Map deleted messages
  const data = result.map(m => ({
    ...m,
    content: m.deleted ? "" : m.content,
    senderName: m.deleted ? "" : (userMap.get(m.userId) || "Unknown"),
    readBy: m.readBy || "[]",
    readCount: (JSON.parse(m.readBy || "[]") as number[]).length,
    reactions: reactionMap.get(m.id) || [],
    replyToMessage: m.replyTo ? (replyMap.get(m.replyTo) || null) : null,
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

  const replyMap = message.replyTo ? await replyPreviews([message.replyTo]) : null;

  res.json({
    success: true,
    data: {
      ...message,
      senderName: userMap.get(userId) || "Unknown",
      reactions: [],
      replyToMessage: message.replyTo ? (replyMap?.get(message.replyTo) || null) : null,
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

// POST /:roomId/messages/:messageId/reactions - Toggle an emoji reaction (KakaoTalk 공감)
router.post("/:roomId/messages/:messageId/reactions", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const roomId = safeParseId(req.params.roomId);
  const messageId = safeParseId(req.params.messageId);
  if (!roomId || !messageId) { throw new ValidationError("Invalid ID"); }

  const membership = await verifyMembership(roomId, userId);
  if (!membership) { throw new ForbiddenError("Not a member of this room"); }

  const emoji = (req.body?.emoji || "").toString().trim();
  if (!emoji || emoji.length > 8) { throw new ValidationError("Invalid emoji"); }

  const [msg] = await db.select().from(chatMessages)
    .where(and(eq(chatMessages.id, messageId), eq(chatMessages.roomId, roomId)));
  if (!msg) { throw new NotFoundError("Message"); }

  // Toggle: remove if this user already reacted with this emoji, else add.
  const existing = await db.select().from(chatMessageReactions).where(and(
    eq(chatMessageReactions.messageId, messageId),
    eq(chatMessageReactions.userId, userId),
    eq(chatMessageReactions.emoji, emoji),
  ));
  if (existing.length > 0) {
    await db.delete(chatMessageReactions).where(eq(chatMessageReactions.id, existing[0].id));
  } else {
    await db.insert(chatMessageReactions).values({ messageId, userId, emoji });
  }

  // Broadcast the updated reaction set (viewer-agnostic) to room members.
  const reactionMap = await reactionsForMessages([messageId], userId);
  const reactions = reactionMap.get(messageId) || [];
  const members = await db.select().from(chatMembers).where(eq(chatMembers.roomId, roomId));
  for (const m of members) {
    emitToUser(m.userId, "chat:reaction", { roomId, messageId, reactions });
  }

  res.json({ success: true, data: { messageId, reactions } });
}));

// POST /:roomId/invite - Invite a user to a room (any member can invite)
router.post("/:roomId/invite", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const roomId = safeParseId(req.params.roomId);
  if (!roomId) { throw new ValidationError("Invalid room ID"); }
  const inviteeId = Number(req.body?.userId);
  if (!inviteeId || inviteeId === userId) { throw new ValidationError("Valid user is required"); }

  const membership = await verifyMembership(roomId, userId);
  if (!membership) { throw new ForbiddenError("Not a member of this room"); }

  const [room] = await db.select().from(chatRooms).where(eq(chatRooms.id, roomId));
  if (!room || room.deletedAt) { throw new NotFoundError("Room"); }
  if (room.type !== "group") { throw new ForbiddenError("Cannot invite to this room"); }

  const [invitee] = await db.select({ id: users.id }).from(users).where(eq(users.id, inviteeId));
  if (!invitee) { throw new NotFoundError("User"); }

  const alreadyMember = await verifyMembership(roomId, inviteeId);
  if (alreadyMember) { throw new ConflictError("User is already a member"); }

  // Create the pending invite (idempotent on the unique room+user index).
  const existing = await db.select().from(chatInvites)
    .where(and(eq(chatInvites.roomId, roomId), eq(chatInvites.userId, inviteeId)));
  if (existing.length === 0) {
    await db.insert(chatInvites).values({ roomId, userId: inviteeId, invitedBy: userId });
  }

  const inviterMap = await getUserMap([userId]);
  emitToUser(inviteeId, "chat:invited", {
    roomId,
    roomName: room.name,
    inviterName: inviterMap.get(userId) || "Unknown",
  });

  res.json({ success: true, data: { invited: true } });
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
