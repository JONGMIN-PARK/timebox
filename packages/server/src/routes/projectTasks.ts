import { Router } from "express";
import { db } from "../db/index.js";
import { projectTasks, projectMembers, taskComments, activityLog, users, taskTransfers, projects, inboxMessages, telegramConfig } from "../db/schema.js";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { projectMemberMiddleware, type ProjectRequest } from "../middleware/projectAuth.js";
import { getTelegramBot } from "../telegram/bot.js";

async function notifyTaskViaTelegram(toUserId: number, projectName: string, taskTitle: string, dueDate: string | null) {
  try {
    const bot = getTelegramBot();
    if (!bot) return;
    const conf = await db.select().from(telegramConfig).where(eq(telegramConfig.userId, toUserId));
    if (!conf[0]?.chatId || !conf[0]?.active) return;
    const msg = `📋 *태스크 할당*\n\n📁 프로젝트: *${projectName}*\n📌 태스크: ${taskTitle}${dueDate ? `\n📅 마감: ${dueDate}` : ""}`;
    await bot.sendMessage(conf[0].chatId, msg, { parse_mode: "Markdown" });
  } catch (e) {
    console.error("telegram-task-notify:", e);
  }
}

const router = Router();

// All routes require project membership
router.use("/:projectId/tasks", projectMemberMiddleware);
router.use("/:projectId/transfers", projectMemberMiddleware);
router.use("/:projectId/stats", projectMemberMiddleware);
router.use("/:projectId/activity", projectMemberMiddleware);

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
    const { title, description, status, priority, assigneeId, startDate, dueDate, tags, parentId } = req.body;
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
      startDate: startDate || null,
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

    // Send inbox + Telegram notification to assignee
    if (result[0].assigneeId && result[0].assigneeId !== req.userId) {
      const project = await db.select().from(projects).where(eq(projects.id, req.projectId!));
      const projectName = project[0]?.name || "Project";
      await db.insert(inboxMessages).values({
        fromUserId: req.userId!,
        toUserId: result[0].assigneeId,
        subject: `[${projectName}] 새 태스크 할당: ${result[0].title}`,
        content: `프로젝트 "${projectName}"에서 태스크 "${result[0].title}"이(가) 할당되었습니다.${result[0].dueDate ? `\n마감일: ${result[0].dueDate}` : ""}`,
        type: "task_assignment",
        relatedProjectId: req.projectId!,
        relatedTaskId: result[0].id,
      });
      notifyTaskViaTelegram(result[0].assigneeId, projectName, result[0].title, result[0].dueDate);
    }

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
    if (req.body.startDate !== undefined) updates.startDate = req.body.startDate;
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

    // Notify assignee on assignment change
    if (req.body.assigneeId && req.body.assigneeId !== req.userId) {
      const project = await db.select().from(projects).where(eq(projects.id, req.projectId!));
      const projectName = project[0]?.name || "Project";
      await db.insert(inboxMessages).values({
        fromUserId: req.userId!,
        toUserId: req.body.assigneeId,
        subject: `[${projectName}] 태스크 할당: ${result[0].title}`,
        content: `"${result[0].title}" 태스크가 할당되었습니다.${result[0].dueDate ? ` (마감: ${result[0].dueDate})` : ""}`,
        type: "task_assignment",
        relatedProjectId: req.projectId!,
        relatedTaskId: result[0].id,
      });
      notifyTaskViaTelegram(req.body.assigneeId, projectName, result[0].title, result[0].dueDate);
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

    await db.transaction(async (tx) => {
      for (const item of items) {
        const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
        if (item.sortOrder !== undefined) updates.sortOrder = item.sortOrder;
        if (item.status !== undefined) updates.status = item.status;
        await tx.update(projectTasks).set(updates)
          .where(and(eq(projectTasks.id, item.id), eq(projectTasks.projectId, req.projectId!)));
      }
    });

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

// POST /api/projects/:projectId/tasks/:taskId/transfer - request transfer
router.post("/:projectId/tasks/:taskId/transfer", async (req: ProjectRequest, res) => {
  try {
    const taskId = parseInt(req.params.taskId as string);
    const { toUserId, message } = req.body;
    if (!toUserId) {
      res.status(400).json({ success: false, error: "Target user is required" });
      return;
    }

    // Verify target user is project member
    const targetMember = await db.select().from(projectMembers)
      .where(and(eq(projectMembers.projectId, req.projectId!), eq(projectMembers.userId, toUserId)));
    if (!targetMember[0]) {
      res.status(400).json({ success: false, error: "Target user is not a project member" });
      return;
    }

    const result = await db.insert(taskTransfers).values({
      taskId,
      projectId: req.projectId!,
      fromUserId: req.userId!,
      toUserId,
      message: message?.trim() || null,
    }).returning();

    // Log activity
    await db.insert(activityLog).values({
      projectId: req.projectId!,
      userId: req.userId!,
      action: "task_transfer_requested",
      targetType: "task",
      targetId: taskId,
      metadata: JSON.stringify({ toUserId }),
    });

    res.status(201).json({ success: true, data: result[0] });
  } catch (error) {
    console.error("projectTasks:transfer", error);
    res.status(500).json({ success: false, error: "Failed to create transfer" });
  }
});

// GET /api/projects/:projectId/transfers - list pending transfers for me
router.get("/:projectId/transfers", async (req: ProjectRequest, res) => {
  try {
    const userId = req.userId!;
    const transfers = await db.select().from(taskTransfers)
      .where(and(
        eq(taskTransfers.projectId, req.projectId!),
        eq(taskTransfers.toUserId, userId),
        eq(taskTransfers.status, "pending")
      ));

    // Enrich with task and sender info
    const taskIds = [...new Set(transfers.map(t => t.taskId))];
    const fromUserIds = [...new Set(transfers.map(t => t.fromUserId))];

    const transferTasks = taskIds.length > 0
      ? await db.select().from(projectTasks).where(inArray(projectTasks.id, taskIds))
      : [];
    const transferUsers = fromUserIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, fromUserIds))
      : [];

    const taskMap = new Map(transferTasks.map(t => [t.id, t]));
    const userMap = new Map(transferUsers.map(u => [u.id, u]));

    const enriched = transfers.map(t => ({
      ...t,
      task: taskMap.get(t.taskId),
      fromUser: (() => {
        const u = userMap.get(t.fromUserId);
        return u ? { id: u.id, username: u.username, displayName: u.displayName } : null;
      })(),
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error("projectTasks:listTransfers", error);
    res.status(500).json({ success: false, error: "Failed to fetch transfers" });
  }
});

// PUT /api/projects/:projectId/transfers/:transferId/accept
router.put("/:projectId/transfers/:transferId/accept", async (req: ProjectRequest, res) => {
  try {
    const transferId = parseInt(req.params.transferId as string);
    const transfer = await db.select().from(taskTransfers).where(eq(taskTransfers.id, transferId));
    if (!transfer[0] || transfer[0].toUserId !== req.userId!) {
      res.status(404).json({ success: false, error: "Transfer not found" });
      return;
    }

    // Update transfer status
    await db.update(taskTransfers).set({
      status: "accepted",
      respondedAt: new Date().toISOString(),
    }).where(eq(taskTransfers.id, transferId));

    // Update task assignee
    await db.update(projectTasks).set({
      assigneeId: req.userId!,
      updatedAt: new Date().toISOString(),
    }).where(eq(projectTasks.id, transfer[0].taskId));

    // Log activity
    await db.insert(activityLog).values({
      projectId: req.projectId!,
      userId: req.userId!,
      action: "task_transfer_accepted",
      targetType: "task",
      targetId: transfer[0].taskId,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("projectTasks:acceptTransfer", error);
    res.status(500).json({ success: false, error: "Failed to accept transfer" });
  }
});

// PUT /api/projects/:projectId/transfers/:transferId/reject
router.put("/:projectId/transfers/:transferId/reject", async (req: ProjectRequest, res) => {
  try {
    const transferId = parseInt(req.params.transferId as string);
    const transfer = await db.select().from(taskTransfers).where(eq(taskTransfers.id, transferId));
    if (!transfer[0] || transfer[0].toUserId !== req.userId!) {
      res.status(404).json({ success: false, error: "Transfer not found" });
      return;
    }

    await db.update(taskTransfers).set({
      status: "rejected",
      respondedAt: new Date().toISOString(),
    }).where(eq(taskTransfers.id, transferId));

    await db.insert(activityLog).values({
      projectId: req.projectId!,
      userId: req.userId!,
      action: "task_transfer_rejected",
      targetType: "task",
      targetId: transfer[0].taskId,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("projectTasks:rejectTransfer", error);
    res.status(500).json({ success: false, error: "Failed to reject transfer" });
  }
});

// GET /api/projects/:projectId/tasks/:taskId/comments
router.get("/:projectId/tasks/:taskId/comments", async (req: ProjectRequest, res) => {
  try {
    const taskId = parseInt(req.params.taskId as string);
    const comments = await db.select().from(taskComments)
      .where(eq(taskComments.taskId, taskId))
      .orderBy(asc(taskComments.createdAt));

    const commentAuthorIds = [...new Set(comments.map(c => c.authorId))];
    const commentUsers = commentAuthorIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, commentAuthorIds))
      : [];
    const userMap = new Map(commentUsers.map(u => [u.id, u]));
    const result = comments.map(c => ({
      ...c,
      authorName: userMap.get(c.authorId)?.displayName || "Unknown",
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

    const logUserIds = [...new Set(logs.map(l => l.userId))];
    const logUsers = logUserIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, logUserIds))
      : [];
    const activityUserMap = new Map(logUsers.map(u => [u.id, u]));

    const actionMap: Record<string, string> = {
      task_created: "created",
      task_completed: "completed",
      task_updated: "updated",
      comment_added: "commented",
      task_transfer_requested: "transfer_requested",
      task_transfer_accepted: "transfer_accepted",
      task_transfer_rejected: "transfer_rejected",
    };

    const result = logs.map(l => {
      const parsed = typeof l.metadata === "string" ? JSON.parse(l.metadata) : (l.metadata || {});
      return {
        id: l.id,
        userId: l.userId,
        username: activityUserMap.get(l.userId)?.displayName || "Unknown",
        action: actionMap[l.action] || l.action,
        targetTitle: parsed.title || "",
        createdAt: l.createdAt,
      };
    });

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

    const project = await db.select().from(projects).where(eq(projects.id, req.projectId!));
    const startDate = project[0]?.startDate || null;
    const targetDate = project[0]?.targetDate || null;
    let dDay: number | null = null;
    if (targetDate) {
      const target = new Date(targetDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      target.setHours(0, 0, 0, 0);
      dDay = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "done").length;
    const inProgress = tasks.filter(t => t.status === "in_progress").length;

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const todayStr = now.toISOString().slice(0, 10);
    const dueSoon = tasks.filter(t => t.dueDate && t.dueDate >= todayStr && t.dueDate <= threeDaysFromNow && t.status !== "done").length;

    // Weekly stats: tasks updated within the last 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const weekCompleted = tasks.filter(t => t.status === "done" && t.updatedAt && t.updatedAt >= sevenDaysAgo).length;
    const weekInProgress = tasks.filter(t => t.status === "in_progress" && t.updatedAt && t.updatedAt >= sevenDaysAgo).length;
    const weekDueSoon = tasks.filter(t => t.dueDate && t.dueDate >= todayStr && t.dueDate <= threeDaysFromNow && t.status !== "done" && t.updatedAt && t.updatedAt >= sevenDaysAgo).length;

    // Per-member stats with username
    const memberUserIds = members.map(m => m.userId);
    const memberUsers = memberUserIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, memberUserIds))
      : [];
    const memberUserMap = new Map(memberUsers.map(u => [u.id, u]));

    const memberStats = members.map(m => {
      const assigned = tasks.filter(t => t.assigneeId === m.userId);
      return {
        userId: m.userId,
        username: memberUserMap.get(m.userId)?.displayName || memberUserMap.get(m.userId)?.username || "Unknown",
        totalTasks: assigned.length,
        completedTasks: assigned.filter(t => t.status === "done").length,
      };
    });

    const unassigned = tasks.filter(t => !t.assigneeId).length;

    res.json({
      success: true,
      data: { total, completed, inProgress, dueSoon, unassigned, progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0, weekCompleted, weekInProgress, weekDueSoon, memberStats, startDate, targetDate, dDay },
    });
  } catch (error) {
    console.error("projectStats:get", error);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

export default router;
