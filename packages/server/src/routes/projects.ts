import { createHash, randomBytes } from "crypto";
import { Router } from "express";
import { db } from "../db/index.js";
import {
  projects, projectMembers, projectTasks, users, teamGroupMembers, events, projectInvites,
} from "../db/schema.js";
import { eq, and, desc, inArray, sql, count, or, ilike, notInArray, gte, lte, ne, isNotNull } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";
import { projectMemberMiddleware, projectAdminMiddleware, type ProjectRequest } from "../middleware/projectAuth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { kstToday, kstNow } from "../lib/kst.js";
import { ValidationError, NotFoundError, ForbiddenError, ConflictError } from "../lib/errors.js";

const router = Router();

// GET /api/projects - list my projects
router.get("/", asyncHandler<AuthRequest>(async (req, res) => {
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
}));

// GET /api/projects/summary — all projects summary at a glance
router.get("/summary", asyncHandler<AuthRequest>(async (req, res) => {
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

  const todayStr = kstToday();

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
      const todayKst = kstNow();
      todayKst.setHours(0, 0, 0, 0);
      dDay = Math.ceil((target.getTime() - todayKst.getTime()) / (1000 * 60 * 60 * 24));
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
}));

// POST /api/projects - create project
router.post("/", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { name, description, color, icon, teamGroupId, startDate, targetDate, docs } = req.body;
  // Verify user has team access
  const userRow = await db.select().from(users).where(eq(users.id, userId));
  const isAdmin = userRow[0]?.role === "admin";
  if (!isAdmin) {
    const teamMemberships = await db.select().from(teamGroupMembers).where(eq(teamGroupMembers.userId, userId));
    if (teamMemberships.length === 0) {
      throw new ForbiddenError("Team group membership required to create projects");
    }
  }

  if (!name?.trim()) {
    throw new ValidationError("Name is required");
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
}));

function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

// POST /api/projects/invites/accept — join project with link token (authenticated)
router.post("/invites/accept", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { token } = req.body as { token?: string };
  if (!token || typeof token !== "string" || token.length < 16) {
    throw new ValidationError("Invalid invite token");
  }
  const tokenHash = hashInviteToken(token.trim());
  const rows = await db.select().from(projectInvites).where(eq(projectInvites.tokenHash, tokenHash));
  const inv = rows[0];
  if (!inv || inv.revokedAt || inv.usedAt) {
    throw new ValidationError("Invite is invalid or already used");
  }
  if (inv.expiresAt < new Date().toISOString()) {
    throw new ValidationError("Invite has expired");
  }
  const existing = await db.select().from(projectMembers)
    .where(and(eq(projectMembers.projectId, inv.projectId), eq(projectMembers.userId, userId)));
  if (existing[0]) {
    throw new ConflictError("Already a member of this project");
  }
  await db.insert(projectMembers).values({
    projectId: inv.projectId,
    userId,
    role: inv.role || "member",
  });
  await db.update(projectInvites)
    .set({ usedAt: new Date().toISOString(), usedByUserId: userId })
    .where(eq(projectInvites.id, inv.id));
  const proj = await db.select().from(projects).where(eq(projects.id, inv.projectId));
  res.json({ success: true, data: { projectId: inv.projectId, projectName: proj[0]?.name } });
}));

// GET /api/projects/:projectId/calendar?start=&end= — project timeline (member)
router.get("/:projectId/calendar", projectMemberMiddleware, asyncHandler<ProjectRequest>(async (req, res) => {
  const projectId = req.projectId!;
  const userId = req.userId!;
  const start = req.query.start as string | undefined;
  const end = req.query.end as string | undefined;
  if (!start || !end) {
    throw new ValidationError("start and end query params are required (ISO datetime)");
  }

  const linkedEvents = await db
    .select()
    .from(events)
    .where(and(
      eq(events.projectId, projectId),
      sql`${events.startTime} < ${end}`,
      sql`${events.endTime} > ${start}`,
    ));

  const myEvents = linkedEvents.filter((e) => e.userId === userId).map((e) => ({
    type: "personal_event" as const,
    id: e.id,
    title: e.title,
    startTime: e.startTime,
    endTime: e.endTime,
    allDay: e.allDay,
    color: e.color,
    userId: e.userId,
    isMine: true,
  }));

  const othersBusy = linkedEvents
    .filter((e) => e.userId !== userId)
    .map((e) => ({
      type: "busy" as const,
      id: e.id,
      title: "Busy",
      startTime: e.startTime,
      endTime: e.endTime,
      allDay: e.allDay,
      userId: e.userId,
      isMine: false,
    }));

  const taskRows = await db
    .select()
    .from(projectTasks)
    .where(and(
      eq(projectTasks.projectId, projectId),
      isNotNull(projectTasks.dueDate),
      gte(projectTasks.dueDate, start.slice(0, 10)),
      lte(projectTasks.dueDate, end.slice(0, 10)),
      ne(projectTasks.status, "done"),
    ));

  const projectTaskItems = taskRows.map((t) => ({
    type: "project_task" as const,
    id: t.id,
    title: t.title,
    dueDate: t.dueDate,
    status: t.status,
    assigneeId: t.assigneeId,
    priority: t.priority,
  }));

  res.json({
    success: true,
    data: { myEvents, othersBusy, projectTasks: projectTaskItems },
  });
}));

// POST /api/projects/:projectId/invites — create invite link (admin)
router.post("/:projectId/invites", projectMemberMiddleware, projectAdminMiddleware, asyncHandler<ProjectRequest>(async (req, res) => {
  const projectId = req.projectId!;
  const userId = req.userId!;
  const role = (req.body?.role === "viewer" ? "viewer" : "member") as string;
  const expiresInDays = Math.min(30, Math.max(1, parseInt(String(req.body?.expiresInDays || 7), 10) || 7));
  const plain = randomBytes(32).toString("base64url");
  const tokenHash = hashInviteToken(plain);
  const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();
  const [row] = await db.insert(projectInvites).values({
    projectId,
    tokenHash,
    role,
    createdBy: userId,
    expiresAt,
  }).returning();
  res.status(201).json({
    success: true,
    data: {
      id: row.id,
      token: plain,
      expiresAt: row.expiresAt,
      role: row.role,
    },
  });
}));

// GET /api/projects/:projectId/invites — list pending invites (admin)
router.get("/:projectId/invites", projectMemberMiddleware, projectAdminMiddleware, asyncHandler<ProjectRequest>(async (req, res) => {
  const projectId = req.projectId!;
  const rows = await db.select({
    id: projectInvites.id,
    role: projectInvites.role,
    expiresAt: projectInvites.expiresAt,
    revokedAt: projectInvites.revokedAt,
    usedAt: projectInvites.usedAt,
    createdAt: projectInvites.createdAt,
  }).from(projectInvites)
    .where(eq(projectInvites.projectId, projectId))
    .orderBy(desc(projectInvites.createdAt));
  const pending = rows.filter((r) => !r.revokedAt && !r.usedAt && r.expiresAt >= new Date().toISOString());
  res.json({ success: true, data: { all: rows, pending } });
}));

// DELETE /api/projects/:projectId/invites/:inviteId — revoke (admin)
router.delete("/:projectId/invites/:inviteId", projectMemberMiddleware, projectAdminMiddleware, asyncHandler<ProjectRequest>(async (req, res) => {
  const projectId = req.projectId!;
  const inviteId = parseInt(req.params.inviteId as string, 10);
  if (Number.isNaN(inviteId)) throw new ValidationError("Invalid invite id");
  const rows = await db.select().from(projectInvites)
    .where(and(eq(projectInvites.id, inviteId), eq(projectInvites.projectId, projectId)));
  if (!rows[0]) throw new NotFoundError("Invite");
  await db.update(projectInvites)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(projectInvites.id, inviteId));
  res.json({ success: true });
}));

// GET /api/projects/:projectId - get single project
router.get("/:projectId", projectMemberMiddleware, asyncHandler<ProjectRequest>(async (req, res) => {
  const project = await db.select().from(projects).where(eq(projects.id, req.projectId!));
  if (!project[0]) {
    throw new NotFoundError("Project");
  }
  const members = await db.select().from(projectMembers).where(eq(projectMembers.projectId, req.projectId!));
  res.json({
    success: true,
    data: { ...project[0], memberCount: members.length, myRole: req.projectRole },
  });
}));

// PUT /api/projects/:projectId - update project
router.put("/:projectId", projectMemberMiddleware, projectAdminMiddleware, asyncHandler<ProjectRequest>(async (req, res) => {
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
}));

// PUT /api/projects/:projectId/archive - toggle archive status
router.put("/:projectId/archive", projectMemberMiddleware, projectAdminMiddleware, asyncHandler<ProjectRequest>(async (req, res) => {
  const [project] = await db.select().from(projects).where(eq(projects.id, req.projectId!));
  if (!project) {
    throw new NotFoundError("Project");
  }

  const result = await db.update(projects)
    .set({ archived: !project.archived, updatedAt: new Date().toISOString() })
    .where(eq(projects.id, req.projectId!))
    .returning();
  res.json({ success: true, data: { ...result[0], archived: !project.archived } });
}));

// DELETE /api/projects/:projectId - delete project (owner only)
router.delete("/:projectId", projectMemberMiddleware, asyncHandler<ProjectRequest>(async (req, res) => {
  if (req.projectRole !== "owner") {
    throw new ForbiddenError("Only owner can delete project");
  }
  await db.delete(projectMembers).where(eq(projectMembers.projectId, req.projectId!));
  await db.delete(projects).where(eq(projects.id, req.projectId!));
  res.json({ success: true });
}));

// GET /api/projects/:projectId/members - list members
router.get("/:projectId/members", projectMemberMiddleware, asyncHandler<ProjectRequest>(async (req, res) => {
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
}));

// GET /api/projects/:projectId/members/search?q=keyword - search users to invite
router.get("/:projectId/members/search", projectMemberMiddleware, projectAdminMiddleware, asyncHandler<ProjectRequest>(async (req, res) => {
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
}));

// POST /api/projects/:projectId/members - invite member
router.post("/:projectId/members", projectMemberMiddleware, projectAdminMiddleware, asyncHandler<ProjectRequest>(async (req, res) => {
  const { username, role } = req.body;
  if (!username?.trim()) {
    throw new ValidationError("Username is required");
  }

  const userRows = await db.select().from(users).where(eq(users.username, username.trim()));
  if (!userRows[0]) {
    throw new NotFoundError("User");
  }

  // Check if already a member
  const existing = await db.select().from(projectMembers)
    .where(and(eq(projectMembers.projectId, req.projectId!), eq(projectMembers.userId, userRows[0].id)));
  if (existing[0]) {
    throw new ConflictError("Already a member");
  }

  const result = await db.insert(projectMembers).values({
    projectId: req.projectId!,
    userId: userRows[0].id,
    role: role || "member",
  }).returning();

  res.status(201).json({ success: true, data: { ...result[0], username: userRows[0].username, displayName: userRows[0].displayName } });
}));

// DELETE /api/projects/:projectId/members/:userId - remove member
router.delete("/:projectId/members/:userId", projectMemberMiddleware, projectAdminMiddleware, asyncHandler<ProjectRequest>(async (req, res) => {
  const targetUserId = parseInt(req.params.userId as string);
  await db.delete(projectMembers)
    .where(and(eq(projectMembers.projectId, req.projectId!), eq(projectMembers.userId, targetUserId)));
  res.json({ success: true });
}));

export default router;
