import { Router } from "express";
import { db } from "../db/index.js";
import { teamGroups, teamGroupMembers, users, projects } from "../db/schema.js";
import { eq, and, sql, inArray } from "drizzle-orm";
import { type AuthRequest, safeParseId } from "../middleware/auth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError, NotFoundError, ConflictError } from "../lib/errors.js";

const router = Router();

// GET / — list all team groups with member counts
router.get("/", asyncHandler<AuthRequest>(async (req, res) => {
  const groups = await db.select().from(teamGroups);
  const memberCounts = await db.select({
    groupId: teamGroupMembers.groupId,
    count: sql<number>`count(*)::int`,
  }).from(teamGroupMembers).groupBy(teamGroupMembers.groupId);

  const countMap = new Map(memberCounts.map(mc => [mc.groupId, mc.count]));
  const data = groups.map(g => ({
    ...g,
    memberCount: countMap.get(g.id) || 0,
  }));

  res.json({ success: true, data });
}));

// POST / — create a team group
router.post("/", asyncHandler<AuthRequest>(async (req, res) => {
  const { name, description, color } = req.body;
  if (!name?.trim()) {
    throw new ValidationError("Name is required");
  }

  const result = await db.insert(teamGroups).values({
    name: name.trim(),
    description: description?.trim() || null,
    color: color || "#3b82f6",
    createdBy: req.userId!,
  }).returning();

  res.status(201).json({ success: true, data: result[0] });
}));

// PUT /:id — update a team group
router.put("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const id = safeParseId(req.params.id);
  if (!id) { throw new ValidationError("Invalid ID"); }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (req.body.name !== undefined) updates.name = req.body.name.trim();
  if (req.body.description !== undefined) updates.description = req.body.description;
  if (req.body.color !== undefined) updates.color = req.body.color;

  const result = await db.update(teamGroups).set(updates).where(eq(teamGroups.id, id)).returning();
  if (!result[0]) { throw new NotFoundError("Group"); }

  res.json({ success: true, data: result[0] });
}));

// DELETE /:id — delete a team group
router.delete("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const id = safeParseId(req.params.id);
  if (!id) { throw new ValidationError("Invalid ID"); }

  // Remove members
  await db.delete(teamGroupMembers).where(eq(teamGroupMembers.groupId, id));
  // Unlink projects
  await db.update(projects).set({ teamGroupId: null }).where(eq(projects.teamGroupId, id));
  // Delete group
  const result = await db.delete(teamGroups).where(eq(teamGroups.id, id)).returning();
  if (!result[0]) { throw new NotFoundError("Group"); }

  res.json({ success: true });
}));

// GET /:id/members — list group members
router.get("/:id/members", asyncHandler<AuthRequest>(async (req, res) => {
  const id = safeParseId(req.params.id);
  if (!id) { throw new ValidationError("Invalid ID"); }

  const members = await db.select().from(teamGroupMembers).where(eq(teamGroupMembers.groupId, id));
  if (members.length === 0) {
    res.json({ success: true, data: [] });
    return;
  }

  const userIds = members.map(m => m.userId);
  const userRows = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    role: users.role,
    active: users.active,
  }).from(users).where(inArray(users.id, userIds));
  const userMap = new Map(userRows.map(u => [u.id, u]));

  const data = members.map(m => ({
    ...m,
    user: userMap.get(m.userId) || null,
  }));

  res.json({ success: true, data });
}));

// POST /:id/members — add member to group
router.post("/:id/members", asyncHandler<AuthRequest>(async (req, res) => {
  const id = safeParseId(req.params.id);
  if (!id) { throw new ValidationError("Invalid ID"); }

  const { userId } = req.body;
  if (!userId) { throw new ValidationError("userId is required"); }

  // Check group exists
  const group = await db.select().from(teamGroups).where(eq(teamGroups.id, id));
  if (!group[0]) { throw new NotFoundError("Group"); }

  // Check user exists
  const user = await db.select().from(users).where(eq(users.id, userId));
  if (!user[0]) { throw new NotFoundError("User"); }

  // Check duplicate
  const existing = await db.select().from(teamGroupMembers)
    .where(and(eq(teamGroupMembers.groupId, id), eq(teamGroupMembers.userId, userId)));
  if (existing[0]) { throw new ConflictError("User is already in this group"); }

  const result = await db.insert(teamGroupMembers).values({
    groupId: id,
    userId,
  }).returning();

  res.status(201).json({
    success: true,
    data: { ...result[0], user: { id: user[0].id, username: user[0].username, displayName: user[0].displayName } },
  });
}));

// DELETE /:id/members/:userId — remove member from group
router.delete("/:id/members/:userId", asyncHandler<AuthRequest>(async (req, res) => {
  const id = safeParseId(req.params.id);
  const userId = safeParseId(req.params.userId);
  if (!id || !userId) { throw new ValidationError("Invalid ID"); }

  await db.delete(teamGroupMembers)
    .where(and(eq(teamGroupMembers.groupId, id), eq(teamGroupMembers.userId, userId)));

  res.json({ success: true });
}));

// GET /available-users?groupId=N — users not in the specified group
router.get("/available-users", asyncHandler<AuthRequest>(async (req, res) => {
  const groupId = parseInt(req.query.groupId as string);
  if (isNaN(groupId)) {
    throw new ValidationError("groupId is required");
  }

  const existingMembers = await db.select({ userId: teamGroupMembers.userId })
    .from(teamGroupMembers).where(eq(teamGroupMembers.groupId, groupId));
  const memberIds = existingMembers.map(m => m.userId);

  const allUsers = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    role: users.role,
    active: users.active,
  }).from(users);

  const available = allUsers.filter(u => u.active && !memberIds.includes(u.id));
  res.json({ success: true, data: available });
}));

export default router;
