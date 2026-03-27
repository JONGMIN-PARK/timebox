import { Router } from "express";
import { db } from "../db/index.js";
import { projectTasks, projectMembers, taskComments, activityLog, users } from "../db/schema.js";
import { eq, and, asc, desc } from "drizzle-orm";
import { projectMemberMiddleware, type ProjectRequest } from "../middleware/projectAuth.js";

const router = Router();

// All routes require project membership
router.use("/:projectId/tasks", projectMemberMiddleware);

// GET /api/projects/:projectId/tasks
router.get("/:projectId/tasks", async (req: ProjectRequest, res) => {
  try {
    const { status, assignee } = req.query;
    let tasks = await db.select().from(projectTasks)
      .where(eq(projectTasks.projectId, req.projectId!))
      .orderBy(asc(projectTasks.sortOrder));

    if (status) tasks = tasks.filter(t => t.status === status);
    if (assignee) tasks = tasks.filter(t => t.assigneeId === parseInt(assignee as string));

    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error("projectTasks:list", error);
    res.status(500).json({ success: false, error: "Failed to fetch tasks" });
  }
});

// POST /api/projects/:projectId/tasks
router.post("/:projectId/tasks", async (req: ProjectRequest, res) => {
  try {
    const { title, description, status, priority, assigneeId, dueDate, tags, parentId } = req.body;
    if (!title?.trim()) {
      res.status(400).json({ success: false, error: "Title is required" });
      return;
    }

    const result = await db.insert(projectTasks).values({
      projectId: req.projectId!,
      title: title.trim(),
      description: description?.trim() || null,
      status: status || "todo",
      priority: priority || "medium",
      assigneeId: assigneeId || null,
      reporterId: req.userId!,
      dueDate: dueDate || null,
      tags: JSON.stringify(tags || []),
      parentId: parentId || null,
    }).returning();

    // Log activity
    await db.insert(activityLog).values({
      projectId: req.projectId!,
      userId: req.userId!,
      action: "task_created",
      targetType: "task",
      targetId: result[0].id,
      metadata: JSON.stringify({ title: result[0].title }),
    });

    res.status(201).json({ success: true, data: result[0] });
  } catch (error) {
    console.error("projectTasks:create", error);
    res.status(500).json({ success: false, error: "Failed to create task" });
  }
});

// PUT /api/projects/:projectId/tasks/:taskId
router.put("/:projectId/tasks/:taskId", async (req: ProjectRequest, res) => {
  try {
    const taskId = parseInt(req.params.taskId as string);
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (req.body.title !== undefined) updates.title = req.body.title.trim();
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.status !== undefined) updates.status = req.body.status;
    if (req.body.priority !== undefined) updates.priority = req.body.priority;
    if (req.body.assigneeId !== undefined) updates.assigneeId = req.body.assigneeId;
    if (req.body.dueDate !== undefined) updates.dueDate = req.body.dueDate;
    if (req.body.tags !== undefined) updates.tags = JSON.stringify(req.body.tags);
    if (req.body.sortOrder !== undefined) updates.sortOrder = req.body.sortOrder;

    const result = await db.update(projectTasks).set(updates)
      .where(and(eq(projectTasks.id, taskId), eq(projectTasks.projectId, req.projectId!))).returning();

    if (!result[0]) {
      res.status(404).json({ success: false, error: "Task not found" });
      return;
    }

    // Log status changes
    if (req.body.status) {
      await db.insert(activityLog).values({
        projectId: req.projectId!,
        userId: req.userId!,
        action: req.body.status === "done" ? "task_completed" : "task_updated",
        targetType: "task",
        targetId: taskId,
        metadata: JSON.stringify({ title: result[0].title, status: req.body.status }),
      });
    }

    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error("projectTasks:update", error);
    res.status(500).json({ success: false, error: "Failed to update task" });
  }
});

// PUT /api/projects/:projectId/tasks/reorder - bulk reorder
router.put("/:projectId/tasks/reorder", async (req: ProjectRequest, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      res.status(400).json({ success: false, error: "Items array required" });
      return;
    }

    for (const item of items) {
      const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (item.sortOrder !== undefined) updates.sortOrder = item.sortOrder;
      if (item.status !== undefined) updates.status = item.status;
      await db.update(projectTasks).set(updates)
        .where(and(eq(projectTasks.id, item.id), eq(projectTasks.projectId, req.projectId!)));
    }

    res.json({ success: true });
  } catch (error) {
    console.error("projectTasks:reorder", error);
    res.status(500).json({ success: false, error: "Failed to reorder" });
  }
});

// DELETE /api/projects/:projectId/tasks/:taskId
router.delete("/:projectId/tasks/:taskId", async (req: ProjectRequest, res) => {
  try {
    const taskId = parseInt(req.params.taskId as string);
    const result = await db.delete(projectTasks)
      .where(and(eq(projectTasks.id, taskId), eq(projectTasks.projectId, req.projectId!))).returning();

    if (!result[0]) {
      res.status(404).json({ success: false, error: "Task not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("projectTasks:delete", error);
    res.status(500).json({ success: false, error: "Failed to delete task" });
  }
});

// GET /api/projects/:projectId/tasks/:taskId/comments
router.get("/:projectId/tasks/:taskId/comments", async (req: ProjectRequest, res) => {
  try {
    const taskId = parseInt(req.params.taskId as string);
    const comments = await db.select().from(taskComments)
      .where(eq(taskComments.taskId, taskId))
      .orderBy(asc(taskComments.createdAt));

    const allUsers = await db.select().from(users);
    const result = comments.map(c => ({
      ...c,
      authorName: allUsers.find(u => u.id === c.authorId)?.displayName || "Unknown",
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("projectTasks:listComments", error);
    res.status(500).json({ success: false, error: "Failed to fetch comments" });
  }
});

// POST /api/projects/:projectId/tasks/:taskId/comments
router.post("/:projectId/tasks/:taskId/comments", async (req: ProjectRequest, res) => {
  try {
    const taskId = parseInt(req.params.taskId as string);
    const { content } = req.body;
    if (!content?.trim()) {
      res.status(400).json({ success: false, error: "Content is required" });
      return;
    }

    const result = await db.insert(taskComments).values({
      taskId,
      authorId: req.userId!,
      content: content.trim(),
    }).returning();

    await db.insert(activityLog).values({
      projectId: req.projectId!,
      userId: req.userId!,
      action: "comment_added",
      targetType: "task",
      targetId: taskId,
    });

    res.status(201).json({ success: true, data: result[0] });
  } catch (error) {
    console.error("projectTasks:addComment", error);
    res.status(500).json({ success: false, error: "Failed to add comment" });
  }
});

// GET /api/projects/:projectId/activity
router.get("/:projectId/activity", async (req: ProjectRequest, res) => {
  try {
    const logs = await db.select().from(activityLog)
      .where(eq(activityLog.projectId, req.projectId!))
      .orderBy(desc(activityLog.createdAt))
      .limit(50);

    const allUsers = await db.select().from(users);
    const result = logs.map(l => ({
      ...l,
      userName: allUsers.find(u => u.id === l.userId)?.displayName || "Unknown",
      metadata: JSON.parse(l.metadata),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("projectActivity:list", error);
    res.status(500).json({ success: false, error: "Failed to fetch activity" });
  }
});

// GET /api/projects/:projectId/stats
router.get("/:projectId/stats", async (req: ProjectRequest, res) => {
  try {
    const tasks = await db.select().from(projectTasks).where(eq(projectTasks.projectId, req.projectId!));
    const members = await db.select().from(projectMembers).where(eq(projectMembers.projectId, req.projectId!));

    const total = tasks.length;
    const done = tasks.filter(t => t.status === "done").length;
    const inProgress = tasks.filter(t => t.status === "in_progress").length;
    const overdue = tasks.filter(t => t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10) && t.status !== "done").length;

    // Per-member stats
    const memberStats = members.map(m => {
      const assigned = tasks.filter(t => t.assigneeId === m.userId);
      return {
        userId: m.userId,
        role: m.role,
        total: assigned.length,
        done: assigned.filter(t => t.status === "done").length,
        inProgress: assigned.filter(t => t.status === "in_progress").length,
      };
    });

    res.json({
      success: true,
      data: { total, done, inProgress, overdue, progress: total > 0 ? Math.round((done / total) * 100) : 0, memberStats },
    });
  } catch (error) {
    console.error("projectStats:get", error);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

export default router;
