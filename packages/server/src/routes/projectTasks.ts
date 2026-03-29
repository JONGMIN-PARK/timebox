import { Router } from "express";
import { db } from "../db/index.js";
import { projectTasks, projectMembers, taskComments, activityLog, users, taskTransfers, projects, inboxMessages, telegramConfig, taskReactions, taskWorkLogs } from "../db/schema.js";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { projectMemberMiddleware, projectEditorMiddleware, type ProjectRequest } from "../middleware/projectAuth.js";
import { getTelegramBot } from "../telegram/bot.js";
import { emitToUser, getIO } from "../socket/index.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { logger } from "../lib/logger.js";
import { ValidationError, NotFoundError, ForbiddenError } from "../lib/errors.js";

async function notifyTaskViaTelegram(toUserId: number, projectName: string, taskTitle: string, dueDate: string | null) {
  try {
    const bot = getTelegramBot();
    if (!bot) return;
    const conf = await db.select().from(telegramConfig).where(eq(telegramConfig.userId, toUserId));
    if (!conf[0]?.chatId || !conf[0]?.active) return;
    const msg = `📋 *태스크 할당*\n\n📁 프로젝트: *${projectName}*\n📌 태스크: ${taskTitle}${dueDate ? `\n📅 마감: ${dueDate}` : ""}`;
    await bot.sendMessage(conf[0].chatId, msg, { parse_mode: "Markdown" });
  } catch (e) {
    logger.error("Telegram task notification failed", { toUserId, error: (e as Error).message });
  }
}

const router = Router();

// All routes require project membership
router.use("/:projectId/tasks", projectMemberMiddleware);
router.use("/:projectId/transfers", projectMemberMiddleware);
router.use("/:projectId/stats", projectMemberMiddleware);
router.use("/:projectId/activity", projectMemberMiddleware);

// GET /api/projects/:projectId/tasks
router.get("/:projectId/tasks", asyncHandler<ProjectRequest>(async (req, res) => {
  const { status, assignee } = req.query;
  const conditions = [eq(projectTasks.projectId, req.projectId!)];
  if (status) conditions.push(eq(projectTasks.status, status as string));
  if (assignee) {
    const assigneeId = parseInt(assignee as string);
    if (!isNaN(assigneeId)) conditions.push(eq(projectTasks.assigneeId, assigneeId));
  }
  const tasks = await db.select().from(projectTasks)
    .where(and(...conditions))
    .orderBy(asc(projectTasks.sortOrder));

  // Attach reaction summaries per task
  const taskIds = tasks.map(t => t.id);
  const allReactions = taskIds.length > 0
    ? await db.select().from(taskReactions).where(inArray(taskReactions.taskId, taskIds))
    : [];

  const reactionMap = new Map<number, Record<string, number>>();
  for (const r of allReactions) {
    if (!reactionMap.has(r.taskId)) reactionMap.set(r.taskId, {});
    const map = reactionMap.get(r.taskId)!;
    map[r.emoji] = (map[r.emoji] || 0) + 1;
  }

  const data = tasks.map(t => ({
    ...t,
    reactions: reactionMap.get(t.id) || {},
  }));

  res.json({ success: true, data });
}));

// POST /api/projects/:projectId/tasks
router.post("/:projectId/tasks", projectEditorMiddleware, asyncHandler<ProjectRequest>(async (req, res) => {
  const { title, description, status, priority, assigneeId, startDate, dueDate, tags, parentId } = req.body;
  if (!title?.trim()) {
    throw new ValidationError("Title is required");
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

  // Notify project members via socket
  const io = getIO();
  if (io) io.to(`project-${req.projectId}`).emit("task:created", { projectId: req.projectId, task: result[0] });

  // Notify assignee directly
  if (result[0].assigneeId) {
    emitToUser(result[0].assigneeId, "task:assigned", { projectId: req.projectId, task: result[0] });
  }

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
    notifyTaskViaTelegram(result[0].assigneeId, projectName, result[0].title, result[0].dueDate).catch(e => logger.error("Telegram notify failed", { error: (e as Error).message }));
  }

  res.status(201).json({ success: true, data: result[0] });
}));

// PUT /api/projects/:projectId/tasks/:taskId
router.put("/:projectId/tasks/:taskId", projectEditorMiddleware, asyncHandler<ProjectRequest>(async (req, res) => {
  const taskId = parseInt(req.params.taskId as string);

  // Fetch old task for change tracking
  const oldRows = await db.select().from(projectTasks)
    .where(and(eq(projectTasks.id, taskId), eq(projectTasks.projectId, req.projectId!)));
  if (!oldRows[0]) {
    throw new NotFoundError("Task");
  }
  const oldTask = oldRows[0];

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
    throw new NotFoundError("Task");
  }

  // Notify project members via socket
  const io = getIO();
  if (io) io.to(`project-${req.projectId}`).emit("task:updated", { projectId: req.projectId, task: result[0] });

  // Build detailed change log
  const FIELD_LABELS: Record<string, string> = {
    title: "제목", description: "설명", status: "상태", priority: "우선순위",
    assigneeId: "담당자", startDate: "시작일", dueDate: "마감일", tags: "태그",
  };
  const STATUS_LABELS: Record<string, string> = {
    todo: "할일", in_progress: "진행중", in_review: "검토중", done: "완료",
  };
  const PRIORITY_LABELS: Record<string, string> = {
    low: "낮음", medium: "보통", high: "높음", urgent: "긴급",
  };

  const changes: { field: string; from: string; to: string }[] = [];
  const trackFields = ["title", "description", "status", "priority", "assigneeId", "startDate", "dueDate", "tags"] as const;

  // Resolve assignee names if assigneeId changed
  let assigneeNameMap = new Map<number, string>();
  if (req.body.assigneeId !== undefined && String(oldTask.assigneeId ?? "") !== String(req.body.assigneeId ?? "")) {
    const ids = [oldTask.assigneeId, req.body.assigneeId].filter((id): id is number => !!id);
    if (ids.length > 0) {
      const nameRows = await db.select({ id: users.id, displayName: users.displayName, username: users.username }).from(users).where(inArray(users.id, ids));
      assigneeNameMap = new Map(nameRows.map(u => [u.id, u.displayName || u.username]));
    }
  }

  for (const field of trackFields) {
    if (req.body[field] === undefined) continue;
    const oldVal = String(oldTask[field] ?? "");
    const newVal = field === "tags" ? JSON.stringify(req.body[field]) : String(req.body[field] ?? "");
    if (oldVal === newVal) continue;

    let fromDisplay = oldVal || "(없음)";
    let toDisplay = newVal || "(없음)";

    if (field === "status") {
      fromDisplay = STATUS_LABELS[oldVal] || oldVal || "(없음)";
      toDisplay = STATUS_LABELS[newVal] || newVal || "(없음)";
    } else if (field === "priority") {
      fromDisplay = PRIORITY_LABELS[oldVal] || oldVal || "(없음)";
      toDisplay = PRIORITY_LABELS[newVal] || newVal || "(없음)";
    } else if (field === "description") {
      fromDisplay = oldVal ? `${oldVal.slice(0, 20)}...` : "(없음)";
      toDisplay = newVal ? `${newVal.slice(0, 20)}...` : "(없음)";
    } else if (field === "assigneeId") {
      fromDisplay = oldTask.assigneeId ? (assigneeNameMap.get(oldTask.assigneeId) || oldVal) : "(없음)";
      toDisplay = req.body.assigneeId ? (assigneeNameMap.get(req.body.assigneeId) || newVal) : "(없음)";
    }

    changes.push({ field: FIELD_LABELS[field] || field, from: fromDisplay, to: toDisplay });
  }

  // Log activity with detailed changes (skip sortOrder-only updates)
  if (changes.length > 0) {
    const action = req.body.status === "done" ? "task_completed" : "task_updated";
    await db.insert(activityLog).values({
      projectId: req.projectId!,
      userId: req.userId!,
      action,
      targetType: "task",
      targetId: taskId,
      metadata: JSON.stringify({ title: result[0].title, changes }),
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
    notifyTaskViaTelegram(req.body.assigneeId, projectName, result[0].title, result[0].dueDate).catch(e => logger.error("Telegram notify failed", { error: (e as Error).message }));
  }

  res.json({ success: true, data: result[0] });
}));

// PUT /api/projects/:projectId/tasks/reorder - bulk reorder
router.put("/:projectId/tasks/reorder", projectEditorMiddleware, asyncHandler<ProjectRequest>(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    throw new ValidationError("Items array required");
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
}));

// DELETE /api/projects/:projectId/tasks/:taskId
router.delete("/:projectId/tasks/:taskId", projectEditorMiddleware, asyncHandler<ProjectRequest>(async (req, res) => {
  const taskId = parseInt(req.params.taskId as string);
  const result = await db.delete(projectTasks)
    .where(and(eq(projectTasks.id, taskId), eq(projectTasks.projectId, req.projectId!))).returning();

  if (!result[0]) {
    throw new NotFoundError("Task");
  }

  // Log deletion
  await db.insert(activityLog).values({
    projectId: req.projectId!,
    userId: req.userId!,
    action: "task_deleted",
    targetType: "task",
    targetId: taskId,
    metadata: JSON.stringify({ title: result[0].title }),
  });

  // Notify project members via socket
  const io = getIO();
  if (io) io.to(`project-${req.projectId}`).emit("task:deleted", { projectId: req.projectId, taskId });

  res.json({ success: true });
}));

// GET /api/projects/:projectId/tasks/:taskId/reactions
router.get("/:projectId/tasks/:taskId/reactions", asyncHandler<ProjectRequest>(async (req, res) => {
  const taskId = parseInt(req.params.taskId as string);
  const reactions = await db.select().from(taskReactions).where(eq(taskReactions.taskId, taskId));

  const userIds = [...new Set(reactions.map(r => r.userId))];
  const userRows = userIds.length > 0
    ? await db.select({ id: users.id, displayName: users.displayName, username: users.username }).from(users).where(inArray(users.id, userIds))
    : [];
  const userMap = new Map(userRows.map(u => [u.id, u.displayName || u.username]));

  const data = reactions.map(r => ({
    ...r,
    userName: userMap.get(r.userId) || "Unknown",
  }));
  res.json({ success: true, data });
}));

// POST /api/projects/:projectId/tasks/:taskId/reactions
router.post("/:projectId/tasks/:taskId/reactions", asyncHandler<ProjectRequest>(async (req, res) => {
  const taskId = parseInt(req.params.taskId as string);
  const { emoji } = req.body;
  if (!emoji) { throw new ValidationError("Emoji required"); }

  // Remove existing same reaction from this user (toggle behavior)
  const existing = await db.select().from(taskReactions)
    .where(and(eq(taskReactions.taskId, taskId), eq(taskReactions.userId, req.userId!), eq(taskReactions.emoji, emoji)));

  if (existing[0]) {
    await db.delete(taskReactions).where(eq(taskReactions.id, existing[0].id));
    res.json({ success: true, data: { action: "removed" } });
  } else {
    const result = await db.insert(taskReactions).values({
      taskId,
      userId: req.userId!,
      emoji,
    }).returning();
    res.status(201).json({ success: true, data: { action: "added", reaction: result[0] } });
  }
}));

// POST /api/projects/:projectId/tasks/:taskId/transfer - request transfer
router.post("/:projectId/tasks/:taskId/transfer", projectEditorMiddleware, asyncHandler<ProjectRequest>(async (req, res) => {
  const taskId = parseInt(req.params.taskId as string);
  const { toUserId, message } = req.body;
  if (!toUserId) {
    throw new ValidationError("Target user is required");
  }

  // Verify target user is project member
  const targetMember = await db.select().from(projectMembers)
    .where(and(eq(projectMembers.projectId, req.projectId!), eq(projectMembers.userId, toUserId)));
  if (!targetMember[0]) {
    throw new ValidationError("Target user is not a project member");
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
}));

// GET /api/projects/:projectId/transfers - list pending transfers for me
router.get("/:projectId/transfers", asyncHandler<ProjectRequest>(async (req, res) => {
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
}));

// PUT /api/projects/:projectId/transfers/:transferId/accept
router.put("/:projectId/transfers/:transferId/accept", asyncHandler<ProjectRequest>(async (req, res) => {
  const transferId = parseInt(req.params.transferId as string);
  const transfer = await db.select().from(taskTransfers).where(eq(taskTransfers.id, transferId));
  if (!transfer[0] || transfer[0].toUserId !== req.userId!) {
    throw new NotFoundError("Transfer");
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
}));

// PUT /api/projects/:projectId/transfers/:transferId/reject
router.put("/:projectId/transfers/:transferId/reject", asyncHandler<ProjectRequest>(async (req, res) => {
  const transferId = parseInt(req.params.transferId as string);
  const transfer = await db.select().from(taskTransfers).where(eq(taskTransfers.id, transferId));
  if (!transfer[0] || transfer[0].toUserId !== req.userId!) {
    throw new NotFoundError("Transfer");
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
}));

// GET /api/projects/:projectId/tasks/:taskId/comments
router.get("/:projectId/tasks/:taskId/comments", asyncHandler<ProjectRequest>(async (req, res) => {
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
}));

// POST /api/projects/:projectId/tasks/:taskId/comments
router.post("/:projectId/tasks/:taskId/comments", asyncHandler<ProjectRequest>(async (req, res) => {
  const taskId = parseInt(req.params.taskId as string);
  const taskExists = await db.select({ id: projectTasks.id }).from(projectTasks)
    .where(and(eq(projectTasks.id, taskId), eq(projectTasks.projectId, req.projectId!)));
  if (!taskExists[0]) {
    throw new NotFoundError("Task");
  }

  const { content } = req.body;
  if (!content?.trim()) {
    throw new ValidationError("Content is required");
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
}));

// GET /api/projects/:projectId/tasks/:taskId/worklogs
router.get("/:projectId/tasks/:taskId/worklogs", asyncHandler<ProjectRequest>(async (req, res) => {
  const taskId = parseInt(req.params.taskId as string);
  const logs = await db.select().from(taskWorkLogs)
    .where(and(eq(taskWorkLogs.taskId, taskId), eq(taskWorkLogs.projectId, req.projectId!)))
    .orderBy(desc(taskWorkLogs.createdAt));

  const userIds = [...new Set(logs.map(l => l.userId))];
  const logUsers = userIds.length > 0
    ? await db.select({ id: users.id, displayName: users.displayName, username: users.username }).from(users).where(inArray(users.id, userIds))
    : [];
  const userMap = new Map(logUsers.map(u => [u.id, u.displayName || u.username]));

  const data = logs.map(l => ({
    ...l,
    userName: userMap.get(l.userId) || "Unknown",
  }));

  res.json({ success: true, data });
}));

// POST /api/projects/:projectId/tasks/:taskId/worklogs
router.post("/:projectId/tasks/:taskId/worklogs", asyncHandler<ProjectRequest>(async (req, res) => {
  const taskId = parseInt(req.params.taskId as string);
  const { content } = req.body;
  if (!content?.trim()) {
    throw new ValidationError("Content is required");
  }

  const taskExists = await db.select({ id: projectTasks.id }).from(projectTasks)
    .where(and(eq(projectTasks.id, taskId), eq(projectTasks.projectId, req.projectId!)));
  if (!taskExists[0]) {
    throw new NotFoundError("Task");
  }

  const result = await db.insert(taskWorkLogs).values({
    taskId,
    projectId: req.projectId!,
    userId: req.userId!,
    content: content.trim(),
  }).returning();

  // Log activity
  await db.insert(activityLog).values({
    projectId: req.projectId!,
    userId: req.userId!,
    action: "worklog_added",
    targetType: "task",
    targetId: taskId,
    metadata: JSON.stringify({ title: taskExists[0].id ? content.trim().slice(0, 50) : "" }),
  });

  const user = await db.select({ displayName: users.displayName, username: users.username }).from(users).where(eq(users.id, req.userId!));

  res.status(201).json({
    success: true,
    data: { ...result[0], userName: user[0]?.displayName || user[0]?.username || "Unknown" },
  });
}));

// PUT /api/projects/:projectId/tasks/:taskId/worklogs/:logId
router.put("/:projectId/tasks/:taskId/worklogs/:logId", asyncHandler<ProjectRequest>(async (req, res) => {
  const logId = parseInt(req.params.logId as string);
  const { content } = req.body;
  if (!content?.trim()) {
    throw new ValidationError("Content is required");
  }

  const existing = await db.select().from(taskWorkLogs).where(eq(taskWorkLogs.id, logId));
  if (!existing[0] || existing[0].projectId !== req.projectId!) {
    throw new NotFoundError("Work log");
  }
  // Only author can edit
  if (existing[0].userId !== req.userId!) {
    throw new ForbiddenError("Not authorized");
  }

  const result = await db.update(taskWorkLogs)
    .set({ content: content.trim() })
    .where(eq(taskWorkLogs.id, logId))
    .returning();

  res.json({ success: true, data: result[0] });
}));

// DELETE /api/projects/:projectId/tasks/:taskId/worklogs/:logId
router.delete("/:projectId/tasks/:taskId/worklogs/:logId", asyncHandler<ProjectRequest>(async (req, res) => {
  const logId = parseInt(req.params.logId as string);

  const existing = await db.select().from(taskWorkLogs).where(eq(taskWorkLogs.id, logId));
  if (!existing[0] || existing[0].projectId !== req.projectId!) {
    throw new NotFoundError("Work log");
  }
  // Only author can delete
  if (existing[0].userId !== req.userId!) {
    throw new ForbiddenError("Not authorized");
  }

  await db.delete(taskWorkLogs).where(eq(taskWorkLogs.id, logId));

  res.json({ success: true });
}));

// GET /api/projects/:projectId/activity
router.get("/:projectId/activity", asyncHandler<ProjectRequest>(async (req, res) => {
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
    task_deleted: "deleted",
    worklog_added: "worklog",
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
      changes: parsed.changes || null,
      createdAt: l.createdAt,
    };
  });

  res.json({ success: true, data: result });
}));

// GET /api/projects/:projectId/stats
router.get("/:projectId/stats", asyncHandler<ProjectRequest>(async (req, res) => {
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

  let completed = 0, inProgress = 0, dueSoon = 0, unassigned = 0;
  let weekCompleted = 0, weekInProgress = 0, weekDueSoon = 0;
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  for (const t of tasks) {
    if (t.status === "done") completed++;
    if (t.status === "in_progress") inProgress++;
    if (!t.assigneeId) unassigned++;
    if (t.dueDate && t.dueDate >= todayStr && t.dueDate <= threeDaysFromNow && t.status !== "done") dueSoon++;
    if (t.status === "done" && t.updatedAt && t.updatedAt >= sevenDaysAgo) weekCompleted++;
    if (t.status === "in_progress" && t.updatedAt && t.updatedAt >= sevenDaysAgo) weekInProgress++;
    if (t.dueDate && t.dueDate >= todayStr && t.dueDate <= threeDaysFromNow && t.status !== "done" && t.updatedAt && t.updatedAt >= sevenDaysAgo) weekDueSoon++;
  }
  const total = tasks.length;

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

  res.json({
    success: true,
    data: { total, completed, inProgress, dueSoon, unassigned, progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0, weekCompleted, weekInProgress, weekDueSoon, memberStats, startDate, targetDate, dDay },
  });
}));

export default router;
