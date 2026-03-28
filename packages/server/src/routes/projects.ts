import { Router } from "express";
import { db } from "../db/index.js";
import { projects, projectMembers, projectTasks, users, teamGroupMembers } from "../db/schema.js";
import { eq, and, desc, inArray, sql, count, or, ilike, notInArray } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";
import { projectMemberMiddleware, projectAdminMiddleware, type ProjectRequest } from "../middleware/projectAuth.js";

const router = Router();

// GET /api/projects - list my projects
router.get("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    // 1. Projects where user is a direct member
    const memberships = await db.select().from(projectMembers).where(eq(projectMembers.userId, userId));
    const directProjectIds = memberships.map(m => m.projectId);

    // 2. Projects in user's team groups
    const userGroups = await db.select({ groupId: teamGroupMembers.groupId })
      .from(teamGroupMembers).where(eq(teamGroupMembers.userId, userId));
    const groupIds = userGroups.map(g => g.groupId);

    let groupProjectIds: number[] = [];
    if (groupIds.length > 0) {
      const groupProjects = await db.select({ id: projects.id })
        .from(projects).where(inArray(projects.teamGroupId, groupIds));
      groupProjectIds = groupProjects.map(p => p.id);
    }

    // Combine unique project IDs
    const allProjectIds = [...new Set([...directProjectIds, ...groupProjectIds])];

    if (allProjectIds.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const includeArchived = req.query.includeArchived === "true";
    let myProjects = await db.select().from(projects).where(inArray(projects.id, allProjectIds));
    if (!includeArchived) {
      myProjects = myProjects.filter(p => !p.archived);
    }

    // Single query to get member counts grouped by projectId
    const memberCounts = await db.select({
      projectId: projectMembers.projectId,
      memberCount: count(),
    }).from(projectMembers)
      .where(inArray(projectMembers.projectId, allProjectIds))
      .groupBy(projectMembers.projectId);

    const memberCountMap = new Map(memberCounts.map(mc => [mc.projectId, mc.memberCount]));
    const membershipMap = new Map(memberships.map(m => [m.projectId, m.role]));

    const result = myProjects.map(p => ({
      ...p,
      memberCount: memberCountMap.get(p.id) || 0,
      myRole: membershipMap.get(p.id) || (groupIds.includes(p.teamGroupId!) ? "viewer" : undefined),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("projects:list", error);
    res.status(500).json({ success: false, error: "Failed to fetch projects" });
  }
});

// GET /api/projects/summary — all projects summary at a glance
router.get("/summary", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    // Get user's projects (same logic as GET /)
    const memberships = await db.select().from(projectMembers).where(eq(projectMembers.userId, userId));
    const directProjectIds = memberships.map(m => m.projectId);

    const userGroups = await db.select({ groupId: teamGroupMembers.groupId })
      .from(teamGroupMembers).where(eq(teamGroupMembers.userId, userId));
    const groupIds = userGroups.map(g => g.groupId);

    let groupProjectIds: number[] = [];
    if (groupIds.length > 0) {
      const gp = await db.select({ id: projects.id })
        .from(projects).where(inArray(projects.teamGroupId, groupIds));
      groupProjectIds = gp.map(p => p.id);
    }

    const allProjectIds = [...new Set([...directProjectIds, ...groupProjectIds])];
    if (allProjectIds.length === 0) { res.json({ success: true, data: [] }); return; }

    const includeArchived = req.query.includeArchived === "true";
    let myProjects = await db.select().from(projects).where(inArray(projects.id, allProjectIds));
    if (!includeArchived) {
      myProjects = myProjects.filter(p => !p.archived);
    }

    // Get all tasks for these projects
    const allTasks = await db.select().from(projectTasks).where(inArray(projectTasks.projectId, allProjectIds));

    // Get member counts
    const memberCounts = await db.select({
      projectId: projectMembers.projectId,
      count: sql<number>`count(*)::int`,
    }).from(projectMembers)
      .where(inArray(projectMembers.projectId, allProjectIds))
      .groupBy(projectMembers.projectId);
    const memberCountMap = new Map(memberCounts.map(mc => [mc.projectId, mc.count]));

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const summary = myProjects.map(p => {
      const tasks = allTasks.filter(t => t.projectId === p.id);
      const total = tasks.length;
      const completed = tasks.filter(t => t.status === "done").length;
      const inProgress = tasks.filter(t => t.status === "in_progress").length;
      const myTasks = tasks.filter(t => t.assigneeId === userId && t.status !== "done").length;
      const overdue = tasks.filter(t => t.dueDate && t.dueDate < todayStr && t.status !== "done").length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      let dDay: number | null = null;
      if (p.targetDate) {
        const target = new Date(p.targetDate);
        target.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dDay = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        id: p.id,
        name: p.name,
        color: p.color,
        startDate: p.startDate,
        targetDate: p.targetDate,
        dDay,
        total,
        completed,
        inProgress,
        myTasks,
        overdue,
        progress,
        memberCount: memberCountMap.get(p.id) || 0,
        archived: p.archived,
      };
    });

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error("projects:summary", error);
    res.status(500).json({ success: false, error: "Failed to fetch summary" });
  }
});

// POST /api/projects - create project
router.post("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { name, description, color, icon, teamGroupId, startDate, targetDate, docs } = req.body;
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
      startDate: startDate || null,
      targetDate: targetDate || null,
      docs: docs || null,
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

// GET /api/projects/:projectId - get single project
router.get("/:projectId", projectMemberMiddleware, async (req: ProjectRequest, res) => {
  try {
    const project = await db.select().from(projects).where(eq(projects.id, req.projectId!));
    if (!project[0]) {
      res.status(404).json({ success: false, error: "Project not found" });
      return;
    }
    const members = await db.select().from(projectMembers).where(eq(projectMembers.projectId, req.projectId!));
    res.json({
      success: true,
      data: { ...project[0], memberCount: members.length, myRole: req.projectRole },
    });
  } catch (error) {
    console.error("projects:get", error);
    res.status(500).json({ success: false, error: "Failed to fetch project" });
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
    if (req.body.startDate !== undefined) updates.startDate = req.body.startDate;
    if (req.body.targetDate !== undefined) updates.targetDate = req.body.targetDate;
    if (req.body.docs !== undefined) updates.docs = req.body.docs;

    const result = await db.update(projects).set(updates).where(eq(projects.id, req.projectId!)).returning();
    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error("projects:update", error);
    res.status(500).json({ success: false, error: "Failed to update project" });
  }
});

// PUT /api/projects/:projectId/archive - toggle archive status
router.put("/:projectId/archive", projectMemberMiddleware, projectAdminMiddleware, async (req: ProjectRequest, res) => {
  try {
    const [project] = await db.select().from(projects).where(eq(projects.id, req.projectId!));
    if (!project) {
      res.status(404).json({ success: false, error: "Not found" });
      return;
    }

    const result = await db.update(projects)
      .set({ archived: !project.archived, updatedAt: new Date().toISOString() })
      .where(eq(projects.id, req.projectId!))
      .returning();
    res.json({ success: true, data: { ...result[0], archived: !project.archived } });
  } catch (error) {
    console.error("projects:archive", error);
    res.status(500).json({ success: false, error: "Failed to toggle archive" });
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

// GET /api/projects/:projectId/members/search?q=keyword - search users to invite
router.get("/:projectId/members/search", projectMemberMiddleware, projectAdminMiddleware, async (req: ProjectRequest, res) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (q.length < 1) {
      res.json({ success: true, data: [] });
      return;
    }

    // Get existing member user IDs
    const existingMembers = await db.select({ userId: projectMembers.userId })
      .from(projectMembers).where(eq(projectMembers.projectId, req.projectId!));
    const existingIds = existingMembers.map(m => m.userId);

    const pattern = `%${q}%`;
    const conditions = [
      or(ilike(users.username, pattern), ilike(users.displayName, pattern)),
    ];
    if (existingIds.length > 0) {
      conditions.push(notInArray(users.id, existingIds));
    }

    const results = await db.select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
    }).from(users).where(and(...conditions)).limit(10);

    res.json({ success: true, data: results });
  } catch (error) {
    console.error("projects:searchUsers", error);
    res.status(500).json({ success: false, error: "Failed to search users" });
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
