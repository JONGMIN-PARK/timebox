import { Router } from "express";
import { db } from "../db/index.js";
import {
  users,
  todos,
  events,
  ddays,
  timeBlocks,
  reminders,
  messages,
  chatRooms,
  chatMembers,
  chatMessages,
  inboxMessages,
  projects,
  projectTasks,
  projectMembers,
  projectFiles,
  posts,
  postComments,
  taskComments,
  taskReactions,
  teamGroups,
  teamGroupMembers,
  files,
  activityLog,
  userActivityLog,
} from "../db/schema.js";
import { eq } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError, ForbiddenError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

const router = Router();

// GET /api/backup/export — download all user data as JSON
router.get("/export", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;

  const data = {
    exportedAt: new Date().toISOString(),
    version: 1,
    todos: await db.select().from(todos).where(eq(todos.userId, userId)),
    events: await db.select().from(events).where(eq(events.userId, userId)),
    ddays: await db.select().from(ddays).where(eq(ddays.userId, userId)),
    timeBlocks: await db.select().from(timeBlocks).where(eq(timeBlocks.userId, userId)),
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename=timebox-backup-${new Date().toISOString().slice(0, 10)}.json`);
  res.json({ success: true, data });
}));

// POST /api/backup/import — restore user data from JSON
router.post("/import", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { data, mode } = req.body;

  if (!data || !data.version) {
    throw new ValidationError("Invalid backup data");
  }

  const merge = mode !== "replace";
  let imported = { todos: 0, events: 0, ddays: 0, timeBlocks: 0 };

  // If replace mode, delete existing data first
  if (!merge) {
    await db.delete(todos).where(eq(todos.userId, userId));
    await db.delete(events).where(eq(events.userId, userId));
    await db.delete(ddays).where(eq(ddays.userId, userId));
    await db.delete(timeBlocks).where(eq(timeBlocks.userId, userId));
  }

  // Import todos
  if (data.todos && Array.isArray(data.todos)) {
    for (const t of data.todos) {
      await db.insert(todos).values({
        userId,
        title: t.title,
        completed: t.completed || false,
        priority: t.priority || "medium",
        category: t.category || "personal",
        dueDate: t.dueDate || null,
        sortOrder: t.sortOrder || 0,
        parentId: t.parentId || null,
        projectId: t.projectId ?? null,
      });
      imported.todos++;
    }
  }

  // Import events
  if (data.events && Array.isArray(data.events)) {
    for (const e of data.events) {
      await db.insert(events).values({
        userId,
        title: e.title,
        description: e.description || null,
        startTime: e.startTime,
        endTime: e.endTime,
        allDay: e.allDay || false,
        categoryId: null,
        color: e.color || "#3b82f6",
        projectId: e.projectId ?? null,
      });
      imported.events++;
    }
  }

  // Import ddays
  if (data.ddays && Array.isArray(data.ddays)) {
    for (const d of data.ddays) {
      await db.insert(ddays).values({
        userId,
        title: d.title,
        targetDate: d.targetDate,
        color: d.color || "#3b82f6",
        icon: d.icon || null,
      });
      imported.ddays++;
    }
  }

  // Import timeBlocks
  if (data.timeBlocks && Array.isArray(data.timeBlocks)) {
    for (const b of data.timeBlocks) {
      await db.insert(timeBlocks).values({
        userId,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        title: b.title,
        category: b.category || "other",
        color: b.color || null,
        completed: b.completed || false,
      });
      imported.timeBlocks++;
    }
  }

  logger.info("Backup imported", { userId, imported });
  res.json({ success: true, data: { imported } });
}));

// GET /api/backup/admin-export — admin: full system backup (all users, all data)
router.get("/admin-export", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;

  // Check if user is admin
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId));

  if (!user || user.role !== "admin") {
    throw new ForbiddenError("Admin access required");
  }

  const allUsers = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
    })
    .from(users);

  const data = {
    exportedAt: new Date().toISOString(),
    version: 2,
    totalUsers: allUsers.length,
    users: allUsers,
    todos: await db.select().from(todos),
    events: await db.select().from(events),
    ddays: await db.select().from(ddays),
    timeBlocks: await db.select().from(timeBlocks),
    reminders: await db.select().from(reminders),
    messages: await db.select().from(messages),
    chatRooms: await db.select().from(chatRooms),
    chatMembers: await db.select().from(chatMembers),
    chatMessages: await db.select().from(chatMessages),
    inboxMessages: await db.select().from(inboxMessages),
    projects: await db.select().from(projects),
    projectTasks: await db.select().from(projectTasks),
    projectMembers: await db.select().from(projectMembers),
    projectFiles: await db.select().from(projectFiles),
    posts: await db.select().from(posts),
    postComments: await db.select().from(postComments),
    taskComments: await db.select().from(taskComments),
    taskReactions: await db.select().from(taskReactions),
    teamGroups: await db.select().from(teamGroups),
    teamGroupMembers: await db.select().from(teamGroupMembers),
    files: await db.select().from(files),
    activityLog: await db.select().from(activityLog),
    userActivityLog: await db.select().from(userActivityLog),
  };

  logger.info("Admin backup exported", { adminUserId: userId });

  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=timebox-admin-backup-${new Date().toISOString().slice(0, 10)}.json`
  );
  res.json({ success: true, data });
}));

export default router;
