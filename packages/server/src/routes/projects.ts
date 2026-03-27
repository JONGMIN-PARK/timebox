import { Router } from "express";
import { db } from "../db/index.js";
import { projects, projectMembers, users, teamGroupMembers } from "../db/schema.js";
import { eq, and, desc, inArray, sql, count } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";
import { projectMemberMiddleware, projectAdminMiddleware, type ProjectRequest } from "../middleware/projectAuth.js";

const router = Router();

// GET /api/projects - list my projects
router.get("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    // Check if user has team access (is admin or in a team group)
    const userRow = await db.select().from(users).where(eq(users.id, userId));
    const isAdmin = userRow[0]?.role === "admin";

    if (!isAdmin) {
      const teamMemberships = await db.select().from(teamGroupMembers).where(eq(teamGroupMembers.userId, userId));
      if (teamMemberships.length === 0) {
        res.json({ success: true, data: [] });
        return;
      }
    }

    const memberships = await db.select().from(projectMembers).where(eq(projectMembers.userId, userId));
    const projectIds = memberships.map(m => m.projectId);

    if (projectIds.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const myProjects = await db.select().from(projects).where(inArray(projects.id, projectIds));

    // Single query to get member counts grouped by projectId
    const memberCounts = await db.select({
      projectId: projectMembers.projectId,
      memberCount: count(),
    }).from(projectMembers)
      .where(inArray(projectMembers.projectId, projectIds))
      .groupBy(projectMembers.projectId);

    const memberCountMap = new Map(memberCounts.map(mc => [mc.projectId, mc.memberCount]));
    const membershipMap = new Map(memberships.map(m => [m.projectId, m.role]));

    const result = myProjects.map(p => ({
      ...p,
      memberCount: memberCountMap.get(p.id) || 0,
      myRole: membershipMap.get(p.id),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("projects:list", error);
    res.status(500).json({ success: false, error: "Failed to fetch projects" });
  }
});

// POST /api/projects - create project
router.post("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { name, description, color, icon, teamGroupId } = req.body;
    // Verify user has team access
    const userRow = await db.select().from(users).where(eq(users.id, userId));
    const isAdmin = userRow[0]?.role === "admin";
    if (!isAdmin) {
      const teamMemberships = await db.select().from(teamGroupMembers).where(eq(teamGroupMembers.userId, userId));
      if (teamMemberships.length === 0) {
        res.status(403).json({ success: false, error: "Team group membership required to create projects" });
        return;
      }
    }

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: "Name is required" });
      return;
    }

    const result = await db.insert(projects).values({
      name: name.trim(),
      description: description?.trim() || null,
      color: color || "#3b82f6",
      icon: icon || null,
      teamGroupId: teamGroupId || null,
      ownerId: userId,
    }).returning();

    // Add creator as owner member
    await db.insert(projectMembers).values({
      projectId: result[0].id,
      userId,
      role: "owner",
    });

    res.status(201).json({ success: true, data: { ...result[0], memberCount: 1, myRole: "owner" } });
  } catch (error) {
    console.error("projects:create", error);
    res.status(500).json({ success: false, error: "Failed to create project" });
  }
});

// PUT /api/projects/:projectId - update project
router.put("/:projectId", projectMemberMiddleware, projectAdminMiddleware, async (req: ProjectRequest, res) => {
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.color !== undefined) updates.color = req.body.color;
    if (req.body.icon !== undefined) updates.icon = req.body.icon;

    const result = await db.update(projects).set(updates).where(eq(projects.id, req.projectId!)).returning();
    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error("projects:update", error);
    res.status(500).json({ success: false, error: "Failed to update project" });
  }
});

// DELETE /api/projects/:projectId - delete project (owner only)
router.delete("/:projectId", projectMemberMiddleware, async (req: ProjectRequest, res) => {
  try {
    if (req.projectRole !== "owner") {
      res.status(403).json({ success: false, error: "Only owner can delete project" });
      return;
    }
    await db.delete(projectMembers).where(eq(projectMembers.projectId, req.projectId!));
    await db.delete(projects).where(eq(projects.id, req.projectId!));
    res.json({ success: true });
  } catch (error) {
    console.error("projects:delete", error);
    res.status(500).json({ success: false, error: "Failed to delete project" });
  }
});

// GET /api/projects/:projectId/members - list members
router.get("/:projectId/members", projectMemberMiddleware, async (req: ProjectRequest, res) => {
  try {
    const members = await db.select().from(projectMembers).where(eq(projectMembers.projectId, req.projectId!));
    const memberUserIds = members.map(m => m.userId);
    const memberUsers = memberUserIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, memberUserIds))
      : [];
    const userMap = new Map(memberUsers.map(u => [u.id, u]));

    const result = members.map(m => {
      const user = userMap.get(m.userId);
      return {
        ...m,
        username: user?.username,
        displayName: user?.displayName,
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("projects:listMembers", error);
    res.status(500).json({ success: false, error: "Failed to fetch members" });
  }
});

// POST /api/projects/:projectId/members - invite member
router.post("/:projectId/members", projectMemberMiddleware, projectAdminMiddleware, async (req: ProjectRequest, res) => {
  try {
    const { username, role } = req.body;
    if (!username?.trim()) {
      res.status(400).json({ success: false, error: "Username is required" });
      return;
    }

    const userRows = await db.select().from(users).where(eq(users.username, username.trim()));
    if (!userRows[0]) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    // Check if already a member
    const existing = await db.select().from(projectMembers)
      .where(and(eq(projectMembers.projectId, req.projectId!), eq(projectMembers.userId, userRows[0].id)));
    if (existing[0]) {
      res.status(409).json({ success: false, error: "Already a member" });
      return;
    }

    const result = await db.insert(projectMembers).values({
      projectId: req.projectId!,
      userId: userRows[0].id,
      role: role || "member",
    }).returning();

    res.status(201).json({ success: true, data: { ...result[0], username: userRows[0].username, displayName: userRows[0].displayName } });
  } catch (error) {
    console.error("projects:inviteMember", error);
    res.status(500).json({ success: false, error: "Failed to invite member" });
  }
});

// DELETE /api/projects/:projectId/members/:userId - remove member
router.delete("/:projectId/members/:userId", projectMemberMiddleware, projectAdminMiddleware, async (req: ProjectRequest, res) => {
  try {
    const targetUserId = parseInt(req.params.userId as string);
    await db.delete(projectMembers)
      .where(and(eq(projectMembers.projectId, req.projectId!), eq(projectMembers.userId, targetUserId)));
    res.json({ success: true });
  } catch (error) {
    console.error("projects:removeMember", error);
    res.status(500).json({ success: false, error: "Failed to remove member" });
  }
});

export default router;
