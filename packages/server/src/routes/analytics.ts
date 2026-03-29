import { Router } from "express";
import { db } from "../db/index.js";
import { userActivityLog, users, chatMessages, chatRooms, messages } from "../db/schema.js";
import { eq, desc, sql, and, gte, lte, count } from "drizzle-orm";
import type { AuthRequest } from "../middleware/auth.js";
import { PAGINATION } from "../lib/constants.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError, NotFoundError } from "../lib/errors.js";

const router = Router();

// ── GET /summary ──
router.get("/summary", asyncHandler<AuthRequest>(async (_req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [todayResult] = await db
    .select({ count: count() })
    .from(userActivityLog)
    .where(gte(userActivityLog.createdAt, todayStart));

  const [weekResult] = await db
    .select({ count: count() })
    .from(userActivityLog)
    .where(gte(userActivityLog.createdAt, weekStart));

  const [monthResult] = await db
    .select({ count: count() })
    .from(userActivityLog)
    .where(gte(userActivityLog.createdAt, monthStart));

  const activeUsersToday = await db
    .select({ userId: userActivityLog.userId })
    .from(userActivityLog)
    .where(gte(userActivityLog.createdAt, todayStart))
    .groupBy(userActivityLog.userId);

  const activeUsersWeek = await db
    .select({ userId: userActivityLog.userId })
    .from(userActivityLog)
    .where(gte(userActivityLog.createdAt, weekStart))
    .groupBy(userActivityLog.userId);

  const topFeatures = await db
    .select({
      action: userActivityLog.action,
      count: count(),
    })
    .from(userActivityLog)
    .where(gte(userActivityLog.createdAt, weekStart))
    .groupBy(userActivityLog.action)
    .orderBy(desc(count()))
    .limit(10);

  res.json({
    success: true,
    data: {
      today: { actions: todayResult.count, activeUsers: activeUsersToday.length },
      week: { actions: weekResult.count, activeUsers: activeUsersWeek.length },
      month: { actions: monthResult.count },
      topFeatures,
    },
  });
}));

// ── GET /users ──
router.get("/users", asyncHandler<AuthRequest>(async (_req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();

  const results = await db.execute(sql`
    SELECT
      u.id AS user_id,
      u.username,
      u.display_name,
      COUNT(CASE WHEN ual.created_at >= ${todayStart} THEN 1 END) AS actions_today,
      COUNT(CASE WHEN ual.created_at >= ${weekStart} THEN 1 END) AS actions_this_week,
      MAX(ual.created_at) AS last_active
    FROM ${users} u
    LEFT JOIN ${userActivityLog} ual ON u.id = ual.user_id
    WHERE u.active = true
    GROUP BY u.id, u.username, u.display_name
    ORDER BY actions_this_week DESC
  `);

  res.json({ success: true, data: results.rows });
}));

// ── GET /timeline ──
router.get("/timeline", asyncHandler<AuthRequest>(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const offset = parseInt(req.query.offset as string) || 0;
  const userId = req.query.userId ? parseInt(req.query.userId as string) : null;
  const action = (req.query.action as string) || null;
  const category = (req.query.category as string) || null;
  const search = (req.query.search as string) || null;
  const dateFrom = (req.query.dateFrom as string) || null;
  const dateTo = (req.query.dateTo as string) || null;

  const conditions: ReturnType<typeof sql>[] = [];

  if (userId) conditions.push(sql`ual.user_id = ${userId}`);
  if (action) conditions.push(sql`ual.action ILIKE ${"%" + action + "%"}`);
  if (category) conditions.push(sql`ual.category = ${category}`);
  if (dateFrom) conditions.push(sql`ual.created_at >= ${dateFrom}`);
  if (dateTo) conditions.push(sql`ual.created_at <= ${dateTo + "T23:59:59"}`);
  if (search) {
    const pat = "%" + search + "%";
    conditions.push(sql`(ual.action ILIKE ${pat} OR u.username ILIKE ${pat} OR u.display_name ILIKE ${pat})`);
  }

  const whereClause = conditions.length > 0
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``;

  const results = await db.execute(sql`
    SELECT
      ual.id, ual.user_id, u.username, u.display_name,
      ual.action, ual.category, ual.target_type, ual.target_id,
      ual.project_id, ual.ip_address, ual.user_agent, ual.created_at
    FROM user_activity_log ual
    JOIN users u ON ual.user_id = u.id
    ${whereClause}
    ORDER BY ual.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM user_activity_log ual
    JOIN users u ON ual.user_id = u.id
    ${whereClause}
  `) as any;

  const total = countResult.rows?.[0]?.total ?? results.rows.length;

  res.json({ success: true, data: results.rows, total });
}));

// ── GET /by-category ──
router.get("/by-category", asyncHandler<AuthRequest>(async (_req, res) => {
  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();

  const results = await db
    .select({
      category: userActivityLog.category,
      count: count(),
    })
    .from(userActivityLog)
    .where(gte(userActivityLog.createdAt, weekStart))
    .groupBy(userActivityLog.category)
    .orderBy(desc(count()));

  res.json({ success: true, data: results });
}));

// ── GET /by-feature ──
router.get("/by-feature", asyncHandler<AuthRequest>(async (_req, res) => {
  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();

  const results = await db.execute(sql`
    SELECT
      split_part(ual.action, '.', 1) AS feature,
      ual.action,
      COUNT(*)::int AS count
    FROM ${userActivityLog} ual
    WHERE ual.created_at >= ${weekStart}
    GROUP BY feature, ual.action
    ORDER BY count DESC
  `);

  res.json({ success: true, data: results.rows });
}));

// ── GET /user/:userId ──
router.get("/user/:userId", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = parseInt(req.params.userId as string);
  if (isNaN(userId)) {
    throw new ValidationError("Invalid user ID");
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Get user info
  const [user] = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    throw new NotFoundError("User");
  }

  // Recent actions
  const recentActions = await db
    .select()
    .from(userActivityLog)
    .where(eq(userActivityLog.userId, userId))
    .orderBy(desc(userActivityLog.createdAt))
    .limit(PAGINATION.MESSAGES);

  // Action breakdown this month
  const actionBreakdown = await db
    .select({
      action: userActivityLog.action,
      count: count(),
    })
    .from(userActivityLog)
    .where(and(eq(userActivityLog.userId, userId), gte(userActivityLog.createdAt, monthStart)))
    .groupBy(userActivityLog.action)
    .orderBy(desc(count()));

  // Daily activity this month
  const dailyActivity = await db.execute(sql`
    SELECT
      DATE(ual.created_at) AS date,
      COUNT(*)::int AS count
    FROM ${userActivityLog} ual
    WHERE ual.user_id = ${userId}
      AND ual.created_at >= ${monthStart}
    GROUP BY DATE(ual.created_at)
    ORDER BY date DESC
  `);

  res.json({
    success: true,
    data: {
      user,
      recentActions,
      actionBreakdown,
      dailyActivity: dailyActivity.rows,
    },
  });
}));

// GET /api/analytics/messages
router.get("/messages", asyncHandler<AuthRequest>(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;

  const results = await db.execute(sql`
    SELECT
      cm.id,
      cm.user_id,
      u.username,
      u.display_name,
      cr.name AS room_name,
      cm.content,
      cm.type,
      cm.deleted,
      cm.created_at
    FROM ${chatMessages} cm
    JOIN ${users} u ON cm.user_id = u.id
    JOIN ${chatRooms} cr ON cm.room_id = cr.id
    ORDER BY cm.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  res.json({ success: true, data: results.rows });
}));

// GET /api/analytics/messages/project/:projectId
router.get("/messages/project/:projectId", asyncHandler<AuthRequest>(async (req, res) => {
  const projectId = parseInt(req.params.projectId as string);
  if (isNaN(projectId)) {
    throw new ValidationError("Invalid project ID");
  }

  const results = await db.execute(sql`
    SELECT
      m.id,
      m.project_id,
      m.channel,
      m.sender_id,
      u.username AS sender_username,
      u.display_name AS sender_display_name,
      m.content,
      m.type,
      m.reply_to,
      m.deleted,
      m.created_at
    FROM ${messages} m
    JOIN ${users} u ON m.sender_id = u.id
    WHERE m.project_id = ${projectId}
    ORDER BY m.created_at DESC
    LIMIT 200
  `);

  res.json({ success: true, data: results.rows });
}));

// DELETE /api/analytics/messages/cleanup
router.delete("/messages/cleanup", asyncHandler<AuthRequest>(async (req, res) => {
  const { olderThanDays, deletedOnly } = req.body;

  if (typeof olderThanDays !== "number" || olderThanDays <= 0) {
    throw new ValidationError("olderThanDays must be a positive number");
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  const cutoff = cutoffDate.toISOString();

  let chatMessagesDeleted = 0;
  let projectMessagesDeleted = 0;

  if (deletedOnly) {
    const chatResult = await db
      .delete(chatMessages)
      .where(and(eq(chatMessages.deleted, true), lte(chatMessages.createdAt, cutoff)));
    chatMessagesDeleted = chatResult.rowCount ?? 0;

    const projectResult = await db
      .delete(messages)
      .where(and(eq(messages.deleted, true), lte(messages.createdAt, cutoff)));
    projectMessagesDeleted = projectResult.rowCount ?? 0;
  } else {
    const chatResult = await db
      .delete(chatMessages)
      .where(lte(chatMessages.createdAt, cutoff));
    chatMessagesDeleted = chatResult.rowCount ?? 0;

    const projectResult = await db
      .delete(messages)
      .where(lte(messages.createdAt, cutoff));
    projectMessagesDeleted = projectResult.rowCount ?? 0;
  }

  res.json({
    success: true,
    data: {
      chatMessagesDeleted,
      projectMessagesDeleted,
      totalDeleted: chatMessagesDeleted + projectMessagesDeleted,
    },
  });
}));

export default router;
