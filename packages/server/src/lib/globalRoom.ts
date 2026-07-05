/**
 * Global chat room — a single "전체 채팅방" that every registered member
 * automatically belongs to. Unlike user-created group rooms, membership is
 * managed automatically: new users join on registration, and a startup
 * backfill makes sure existing users are members too.
 */
import { db } from "../db/index.js";
import { chatRooms, chatMembers, users } from "../db/schema.js";
import { and, eq } from "drizzle-orm";

export const GLOBAL_ROOM_TYPE = "global";
export const GLOBAL_ROOM_NAME = "전체 채팅방";

/** The single global room, or null if it hasn't been created yet. */
async function findGlobalRoom() {
  const [room] = await db.select().from(chatRooms).where(eq(chatRooms.type, GLOBAL_ROOM_TYPE));
  return room || null;
}

/**
 * Ensure the global room exists and that every user is a member.
 * Idempotent — safe to call on every startup. Returns the room id.
 */
export async function ensureGlobalRoom(): Promise<number> {
  let room = await findGlobalRoom();
  if (!room) {
    // Attribute creation to the first admin (falls back to 0 = system) so the
    // room is never "owned" by a regular user who could then delete it.
    const [admin] = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
    const creatorId = admin?.id ?? 0;
    [room] = await db.insert(chatRooms).values({
      name: GLOBAL_ROOM_NAME,
      type: GLOBAL_ROOM_TYPE,
      description: "모든 가입 회원이 참여하는 공용 채팅방",
      createdBy: creatorId,
    }).returning();
  }

  // Backfill any users who aren't members yet.
  const allUsers = await db.select({ id: users.id }).from(users);
  const existing = await db.select({ userId: chatMembers.userId }).from(chatMembers)
    .where(eq(chatMembers.roomId, room.id));
  const have = new Set(existing.map((m) => m.userId));
  const missing = allUsers.filter((u) => !have.has(u.id));
  if (missing.length > 0) {
    await db.insert(chatMembers).values(missing.map((u) => ({
      roomId: room!.id,
      userId: u.id,
      role: "member" as const,
    })));
  }
  return room.id;
}

/** Add a single (newly-created) user to the global room. */
export async function addUserToGlobalRoom(userId: number): Promise<void> {
  const room = await findGlobalRoom();
  if (!room) { await ensureGlobalRoom(); return; }
  const existing = await db.select().from(chatMembers)
    .where(and(eq(chatMembers.roomId, room.id), eq(chatMembers.userId, userId)));
  if (existing.length === 0) {
    await db.insert(chatMembers).values({ roomId: room.id, userId, role: "member" });
  }
}
