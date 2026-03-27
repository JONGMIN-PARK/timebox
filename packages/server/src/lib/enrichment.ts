import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { inArray } from "drizzle-orm";

export interface UserInfo {
  id: number;
  username: string;
  displayName: string | null;
}

export async function getUserMap(userIds: number[]): Promise<Map<number, UserInfo>> {
  if (userIds.length === 0) return new Map();
  const unique = [...new Set(userIds)];
  const rows = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
  }).from(users).where(inArray(users.id, unique));
  return new Map(rows.map(u => [u.id, u]));
}

export function getUserName(userMap: Map<number, UserInfo>, userId: number): string {
  const u = userMap.get(userId);
  return u?.displayName || u?.username || "Unknown";
}
