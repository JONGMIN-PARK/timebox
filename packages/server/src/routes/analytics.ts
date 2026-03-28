import { Router } from "express";
import { db } from "../db/index.js";
import { userActivityLog, users } from "../db/schema.js";
import { eq, desc, sql, and, gte, count } from "drizzle-orm";
import type { AuthRequest } from "../middleware/auth.js";

const router = Router();

// ── GET /summary ──
// Overall stats: total actions today/week/month, active users count, most used features
router.get("/summary", async (_req: AuthRequest, res) => {
  try {
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
  } catch (err) {
    console.error("[analytics/summary]", err);
    res.status(500).json({ success: false, error: "Failed to fetch summary" });
  }
});

// ── GET /users ──
// Per-user activity breakdown: actions per user today/this week, last active time
router.get("/users", async (_req: AuthRequest, res) => {
  try {
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
  } catch (err) {
    console.error("[analytics/users]", err);
    res.status(500).json({ success: false, error: "Failed to fetch user activity" });
  }
});

// ── GET /timeline ──
// Recent activity feed (last 100 actions with user names)
router.get("/timeline", async (_req: AuthRequest, res) => {
  try {
    const results = await db.execute(sql`
      SELECT
        ual.id,
        ual.user_id,
        u.username,
        u.display_name,
        ual.action,
        ual.category,
        ual.target_type,
        ual.target_id,
        ual.project_id,
        ual.ip_address,
        ual.created_at
      FROM ${userActivityLog} ual
      JOIN ${users} u ON ual.user_id = u.id
      ORDER BY ual.created_at DESC
      LIMIT 100
    `);

    res.json({ success: true, data: results.rows });
  } catch (err) {
    console.error("[analytics/timeline]", err);
    res.status(500).json({ success: false, error: "Failed to fetch timeline" });
  }
});

// ── GET /by-category ──
// Activity grouped by category (personal/project/general) with counts
router.get("/by-category", async (_req: AuthRequest, res) => {
  try {
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
  } catch (err) {
    console.error("[analytics/by-category]", err);
    res.status(500).json({ success: false, error: "Failed to fetch category breakdown" });
  }
});

// ── GET /by-feature ──
// Activity grouped by action type (todo, event, chat, etc.) with counts
router.get("/by-feature", async (_req: AuthRequest, res) => {
  try {
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
  } catch (err) {
    console.error("[analytics/by-feature]", err);
    res.status(500).json({ success: false, error: "Failed to fetch feature breakdown" });
  }
});

// ── GET /user/:userId ──
// Detailed activity for a specific user
router.get("/user/:userId", async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.userId as string);
    if (isNaN(userId)) {
      res.status(400).json({ success: false, error: "Invalid user ID" });
      return;
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Get user info
    const [user] = await db
      .select({ id: users.id, username: users.username, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    // Recent actions
    const recentActions = await db
      .select()
      .from(userActivityLog)
      .where(eq(userActivityLog.userId, userId))
      .orderBy(desc(userActivityLog.createdAt))
      .limit(50);

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
  } catch (err) {
    console.error("[analytics/user]", err);
    res.status(500).json({ success: false, error: "Failed to fetch user details" });
  }
});

export default router;
