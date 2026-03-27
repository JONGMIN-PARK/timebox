import { Router } from "express";
import { db } from "../db/index.js";
import { teamGroups, teamGroupMembers, users, projects } from "../db/schema.js";
import { eq, and, sql, inArray } from "drizzle-orm";
import { type AuthRequest, safeParseId } from "../middleware/auth.js";

const router = Router();

// GET / — list all team groups with member counts
router.get("/", async (req: AuthRequest, res) => {
  try {
    const groups = await db.select().from(teamGroups);
    const members = await db.select().from(teamGroupMembers);

    const data = groups.map(g => ({
      ...g,
      memberCount: members.filter(m => m.groupId === g.id).length,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error("teamGroups:list", error);
    res.status(500).json({ success: false, error: "Failed to fetch groups" });
  }
});

// POST / — create a team group
router.post("/", async (req: AuthRequest, res) => {
  try {
    const { name, description, color } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ success: false, error: "Name is required" });
      return;
    }

    const result = await db.insert(teamGroups).values({
      name: name.trim(),
      description: description?.trim() || null,
      color: color || "#3b82f6",
      createdBy: req.userId!,
    }).returning();

    res.status(201).json({ success: true, data: result[0] });
  } catch (error) {
    console.error("teamGroups:create", error);
    res.status(500).json({ success: false, error: "Failed to create group" });
  }
});

// PUT /:id — update a team group
router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const id = safeParseId(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.color !== undefined) updates.color = req.body.color;

    const result = await db.update(teamGroups).set(updates).where(eq(teamGroups.id, id)).returning();
    if (!result[0]) { res.status(404).json({ success: false, error: "Group not found" }); return; }

    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error("teamGroups:update", error);
    res.status(500).json({ success: false, error: "Failed to update group" });
  }
});

// DELETE /:id — delete a team group
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const id = safeParseId(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }

    // Remove members
    await db.delete(teamGroupMembers).where(eq(teamGroupMembers.groupId, id));
    // Unlink projects
    await db.update(projects).set({ teamGroupId: null }).where(eq(projects.teamGroupId, id));
    // Delete group
    const result = await db.delete(teamGroups).where(eq(teamGroups.id, id)).returning();
    if (!result[0]) { res.status(404).json({ success: false, error: "Group not found" }); return; }

    res.json({ success: true });
  } catch (error) {
    console.error("teamGroups:delete", error);
    res.status(500).json({ success: false, error: "Failed to delete group" });
  }
});

// GET /:id/members — list group members
router.get("/:id/members", async (req: AuthRequest, res) => {
  try {
    const id = safeParseId(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }

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
  } catch (error) {
    console.error("teamGroups:listMembers", error);
    res.status(500).json({ success: false, error: "Failed to fetch members" });
  }
});

// POST /:id/members — add member to group
router.post("/:id/members", async (req: AuthRequest, res) => {
  try {
    const id = safeParseId(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }

    const { userId } = req.body;
    if (!userId) { res.status(400).json({ success: false, error: "userId is required" }); return; }

    // Check group exists
    const group = await db.select().from(teamGroups).where(eq(teamGroups.id, id));
    if (!group[0]) { res.status(404).json({ success: false, error: "Group not found" }); return; }

    // Check user exists
    const user = await db.select().from(users).where(eq(users.id, userId));
    if (!user[0]) { res.status(404).json({ success: false, error: "User not found" }); return; }

    // Check duplicate
    const existing = await db.select().from(teamGroupMembers)
      .where(and(eq(teamGroupMembers.groupId, id), eq(teamGroupMembers.userId, userId)));
    if (existing[0]) { res.status(409).json({ success: false, error: "User is already in this group" }); return; }

    const result = await db.insert(teamGroupMembers).values({
      groupId: id,
      userId,
    }).returning();

    res.status(201).json({
      success: true,
      data: { ...result[0], user: { id: user[0].id, username: user[0].username, displayName: user[0].displayName } },
    });
  } catch (error) {
    console.error("teamGroups:addMember", error);
    res.status(500).json({ success: false, error: "Failed to add member" });
  }
});

// DELETE /:id/members/:userId — remove member from group
router.delete("/:id/members/:userId", async (req: AuthRequest, res) => {
  try {
    const id = safeParseId(req.params.id);
    const userId = safeParseId(req.params.userId);
    if (!id || !userId) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }

    await db.delete(teamGroupMembers)
      .where(and(eq(teamGroupMembers.groupId, id), eq(teamGroupMembers.userId, userId)));

    res.json({ success: true });
  } catch (error) {
    console.error("teamGroups:removeMember", error);
    res.status(500).json({ success: false, error: "Failed to remove member" });
  }
});

// GET /available-users?groupId=N — users not in the specified group
router.get("/available-users", async (req: AuthRequest, res) => {
  try {
    const groupId = parseInt(req.query.groupId as string);
    if (isNaN(groupId)) {
      res.status(400).json({ success: false, error: "groupId is required" });
      return;
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
  } catch (error) {
    console.error("teamGroups:availableUsers", error);
    res.status(500).json({ success: false, error: "Failed to fetch available users" });
  }
});

export default router;
