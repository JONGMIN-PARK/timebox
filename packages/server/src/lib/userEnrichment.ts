import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { inArray } from "drizzle-orm";

export async function getUserMap(userIds: number[]): Promise<Map<number, string>> {
  if (userIds.length === 0) return new Map();
  const result = await db.select({ id: users.id, displayName: users.displayName, username: users.username })
    .from(users).where(inArray(users.id, userIds));
  return new Map(result.map(u => [u.id, u.displayName || u.username]));
}
