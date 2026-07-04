import { db } from "../db/index.js";
import { users, inboxMessages } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { emitToUser, emitInboxUpdate } from "../socket/index.js";

/**
 * Deliver an inbox notification from one user to another (used by the
 * note/event/to-do "forward to another user" endpoints) and push the realtime
 * socket updates. `subjectFor` receives the sender's display name so callers
 * can build a localized subject line.
 */
export async function notifyForward(opts: {
  fromUserId: number;
  toUserId: number;
  subjectFor: (fromName: string) => string;
  content: string;
}) {
  const [sender] = await db
    .select({ displayName: users.displayName, username: users.username })
    .from(users)
    .where(eq(users.id, opts.fromUserId));
  const fromName = sender?.displayName || sender?.username || "Someone";
  const [msg] = await db
    .insert(inboxMessages)
    .values({
      fromUserId: opts.fromUserId,
      toUserId: opts.toUserId,
      subject: opts.subjectFor(fromName),
      content: opts.content,
      type: "system",
    })
    .returning();
  emitToUser(opts.toUserId, "inbox:new-message", { message: msg, fromName });
  emitInboxUpdate(opts.toUserId);
  return { msg, fromName };
}
