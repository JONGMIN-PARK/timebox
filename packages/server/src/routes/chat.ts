import { Router } from "express";
import { db } from "../db/index.js";
import { chatRooms, chatMembers, chatMessages, users } from "../db/schema.js";
import { eq, and, desc, inArray, lt } from "drizzle-orm";
import { type AuthRequest, safeParseId } from "../middleware/auth.js";

const router = Router();

// ── Helper: verify room membership ──
async function verifyMembership(roomId: number, userId: number) {
  const [membership] = await db.select().from(chatMembers)
    .where(and(eq(chatMembers.roomId, roomId), eq(chatMembers.userId, userId)));
  return membership || null;
}

// ── Helper: enrich users by IDs ──
async function getUserMap(userIds: number[]) {
  if (userIds.length === 0) return new Map<number, string>();
  const result = await db.select({ id: users.id, displayName: users.displayName, username: users.username })
    .from(users).where(inArray(users.id, userIds));
  return new Map(result.map(u => [u.id, u.displayName || u.username]));
}

// GET / - List my chat rooms
router.get("/", async (req: AuthRequest, res) => {
  try {
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

    // Get last message per room
    const lastMessages = await Promise.all(
      roomIds.map(async (roomId) => {
        const [msg] = await db.select().from(chatMessages)
          .where(eq(chatMessages.roomId, roomId))
          .orderBy(desc(chatMessages.id))
          .limit(1);
        return { roomId, message: msg || null };
      })
    );
    const lastMessageMap = new Map(lastMessages.map(lm => [lm.roomId, lm.message]));

    // Enrich sender names for last messages
    const senderIds = [...new Set(lastMessages.filter(lm => lm.message).map(lm => lm.message!.userId))];
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
      const lastMsg = lastMessageMap.get(room.id);
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
  } catch (error) {
    console.error("chat:listRooms", error);
    res.status(500).json({ success: false, error: "Failed to fetch chat rooms" });
  }
});

// POST / - Create a new chat room
router.post("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { name, type, description, memberIds } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: "Room name is required" });
      return;
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
  } catch (error) {
    console.error("chat:createRoom", error);
    res.status(500).json({ success: false, error: "Failed to create chat room" });
  }
});

// POST /direct - Find or create a direct (1:1) chat room
router.post("/direct", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { targetUserId } = req.body;

    if (!targetUserId || targetUserId === userId) {
      res.status(400).json({ success: false, error: "Valid target user is required" });
      return;
    }

    // Verify target user exists
    const [targetUser] = await db.select({ id: users.id, displayName: users.displayName, username: users.username })
      .from(users).where(eq(users.id, targetUserId));
    if (!targetUser) {
      res.status(404).json({ success: false, error: "Target user not found" });
      return;
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
  } catch (error) {
    console.error("chat:direct", error);
    res.status(500).json({ success: false, error: "Failed to find or create direct room" });
  }
});

// GET /:roomId - Get room details with member list
router.get("/:roomId", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const roomId = safeParseId(req.params.roomId);
    if (!roomId) {
      res.status(400).json({ success: false, error: "Invalid room ID" });
      return;
    }

    const membership = await verifyMembership(roomId, userId);
    if (!membership) {
      res.status(403).json({ success: false, error: "Not a member of this room" });
      return;
    }

    const [room] = await db.select().from(chatRooms).where(eq(chatRooms.id, roomId));
    if (!room) {
      res.status(404).json({ success: false, error: "Room not found" });
      return;
    }

    const members = await db.select().from(chatMembers)
      .where(eq(chatMembers.roomId, roomId));

    const userMap = await getUserMap(members.map(m => m.userId));

    const membersWithNames = members.map(m => ({
      ...m,
      displayName: userMap.get(m.userId) || "Unknown",
    }));

    res.json({ success: true, data: { ...room, members: membersWithNames } });
  } catch (error) {
    console.error("chat:getRoom", error);
    res.status(500).json({ success: false, error: "Failed to fetch room details" });
  }
});

// DELETE /:roomId - Delete room (owner only)
router.delete("/:roomId", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const roomId = safeParseId(req.params.roomId);
    if (!roomId) {
      res.status(400).json({ success: false, error: "Invalid room ID" });
      return;
    }

    const membership = await verifyMembership(roomId, userId);
    if (!membership || membership.role !== "owner") {
      res.status(403).json({ success: false, error: "Only the room owner can delete the room" });
      return;
    }

    // Delete messages, members, then room
    await db.delete(chatMessages).where(eq(chatMessages.roomId, roomId));
    await db.delete(chatMembers).where(eq(chatMembers.roomId, roomId));
    await db.delete(chatRooms).where(eq(chatRooms.id, roomId));

    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error("chat:deleteRoom", error);
    res.status(500).json({ success: false, error: "Failed to delete room" });
  }
});

// GET /:roomId/messages - Get messages with pagination
router.get("/:roomId/messages", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const roomId = safeParseId(req.params.roomId);
    if (!roomId) {
      res.status(400).json({ success: false, error: "Invalid room ID" });
      return;
    }

    const membership = await verifyMembership(roomId, userId);
    if (!membership) {
      res.status(403).json({ success: false, error: "Not a member of this room" });
      return;
    }

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

    const data = result.map(m => ({
      ...m,
      senderName: userMap.get(m.userId) || "Unknown",
    }));

    // Return in chronological order
    data.reverse();

    res.json({ success: true, data });
  } catch (error) {
    console.error("chat:getMessages", error);
    res.status(500).json({ success: false, error: "Failed to fetch messages" });
  }
});

// POST /:roomId/messages - Send a message
router.post("/:roomId/messages", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const roomId = safeParseId(req.params.roomId);
    if (!roomId) {
      res.status(400).json({ success: false, error: "Invalid room ID" });
      return;
    }

    const membership = await verifyMembership(roomId, userId);
    if (!membership) {
      res.status(403).json({ success: false, error: "Not a member of this room" });
      return;
    }

    const { content, type, replyTo } = req.body;
    if (!content?.trim()) {
      res.status(400).json({ success: false, error: "Message content is required" });
      return;
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

    res.json({
      success: true,
      data: {
        ...message,
        senderName: userMap.get(userId) || "Unknown",
      },
    });
  } catch (error) {
    console.error("chat:sendMessage", error);
    res.status(500).json({ success: false, error: "Failed to send message" });
  }
});

// POST /:roomId/members - Add member to room (admin/owner only)
router.post("/:roomId/members", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const roomId = safeParseId(req.params.roomId);
    if (!roomId) {
      res.status(400).json({ success: false, error: "Invalid room ID" });
      return;
    }

    const membership = await verifyMembership(roomId, userId);
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      res.status(403).json({ success: false, error: "Only admin or owner can add members" });
      return;
    }

    const { userId: newUserId } = req.body;
    if (!newUserId) {
      res.status(400).json({ success: false, error: "userId is required" });
      return;
    }

    // Check if already a member
    const existing = await verifyMembership(roomId, newUserId);
    if (existing) {
      res.status(400).json({ success: false, error: "User is already a member" });
      return;
    }

    // Verify user exists
    const [targetUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, newUserId));
    if (!targetUser) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

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
  } catch (error) {
    console.error("chat:addMember", error);
    res.status(500).json({ success: false, error: "Failed to add member" });
  }
});

// DELETE /:roomId/members/:userId - Remove member or leave room
router.delete("/:roomId/members/:userId", async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.userId!;
    const roomId = safeParseId(req.params.roomId);
    const targetUserId = safeParseId(req.params.userId);
    if (!roomId || !targetUserId) {
      res.status(400).json({ success: false, error: "Invalid room or user ID" });
      return;
    }

    const currentMembership = await verifyMembership(roomId, currentUserId);
    if (!currentMembership) {
      res.status(403).json({ success: false, error: "Not a member of this room" });
      return;
    }

    const isSelf = currentUserId === targetUserId;

    if (!isSelf) {
      // Must be admin or owner to remove others
      if (currentMembership.role !== "owner" && currentMembership.role !== "admin") {
        res.status(403).json({ success: false, error: "Only admin or owner can remove members" });
        return;
      }

      // Cannot remove someone with equal or higher role
      const targetMembership = await verifyMembership(roomId, targetUserId);
      if (!targetMembership) {
        res.status(404).json({ success: false, error: "User is not a member of this room" });
        return;
      }
      if (targetMembership.role === "owner") {
        res.status(403).json({ success: false, error: "Cannot remove the room owner" });
        return;
      }
    }

    await db.delete(chatMembers).where(
      and(eq(chatMembers.roomId, roomId), eq(chatMembers.userId, targetUserId))
    );

    res.json({ success: true, data: { removed: true } });
  } catch (error) {
    console.error("chat:removeMember", error);
    res.status(500).json({ success: false, error: "Failed to remove member" });
  }
});

export default router;
