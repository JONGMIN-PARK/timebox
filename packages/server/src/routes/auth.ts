import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db/index.js";
import { users, registrationRequests, teamGroups, teamGroupMembers, projectMembers, userActivityLog } from "../db/schema.js";
import { signToken, authMiddleware, adminMiddleware, safeParseId, type AuthRequest } from "../middleware/auth.js";
import { eq, and, desc } from "drizzle-orm";

async function getUserTeamGroups(userId: number) {
  const memberships = await db.select({
    id: teamGroups.id,
    name: teamGroups.name,
    color: teamGroups.color,
  }).from(teamGroupMembers)
    .innerJoin(teamGroups, eq(teamGroupMembers.groupId, teamGroups.id))
    .where(eq(teamGroupMembers.userId, userId));
  return memberships;
}

async function hasProjectMembership(userId: number): Promise<boolean> {
  const rows = await db.select({ id: projectMembers.id }).from(projectMembers)
    .where(eq(projectMembers.userId, userId)).limit(1);
  return rows.length > 0;
}

async function getLastLoginAt(userId: number): Promise<string | null> {
  const rows = await db.select({ createdAt: userActivityLog.createdAt })
    .from(userActivityLog)
    .where(and(eq(userActivityLog.userId, userId), eq(userActivityLog.action, "auth.login")))
    .orderBy(desc(userActivityLog.createdAt))
    .limit(1);
  return rows[0]?.createdAt || null;
}

const router = Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ success: false, error: "Username and password are required" });
      return;
    }

    const rows = await db.select().from(users).where(eq(users.username, username));
    const user = rows[0];
    if (!user) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    if (!user.active) {
      res.status(401).json({ success: false, error: "Account is deactivated" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: "Invalid credentials" });
      return;
    }

    const token = signToken(user.id, user.role);
    const [teamGroupsList, hasProjects, lastLoginAt] = await Promise.all([
      getUserTeamGroups(user.id),
      hasProjectMembership(user.id),
      getLastLoginAt(user.id),
    ]);

    // Log login
    db.insert(userActivityLog).values({
      userId: user.id, action: "auth.login", category: "general", targetType: "auth",
      ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "",
      userAgent: req.headers["user-agent"] || "",
      metadata: JSON.stringify({ method: "POST", path: "/api/auth/login" }),
    }).catch(() => {});

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, aiModel: user.aiModel, allowedModels: JSON.parse(user.allowedModels || "[]"), teamGroups: teamGroupsList, hasProjectAccess: hasProjects || teamGroupsList.length > 0, lastLoginAt },
      },
    });
  } catch (error) {
    console.error("auth:login", error);
    res.status(500).json({ success: false, error: "Login failed" });
  }
});

// POST /api/auth/request — public signup request
router.post("/request", async (req, res) => {
  try {
    const { username, password, displayName, message } = req.body;
    if (!username?.trim() || !password) {
      res.status(400).json({ success: false, error: "Username and password are required" });
      return;
    }

    const existingUser = await db.select().from(users).where(eq(users.username, username.trim()));
    if (existingUser[0]) {
      res.status(409).json({ success: false, error: "Username already taken" });
      return;
    }

    const existingReq = await db.select().from(registrationRequests)
      .where(eq(registrationRequests.username, username.trim()));
    if (existingReq.filter((r) => r.status === "pending").length > 0) {
      res.status(409).json({ success: false, error: "A request for this username is already pending" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.insert(registrationRequests).values({
      username: username.trim(),
      passwordHash,
      displayName: displayName?.trim() || username.trim(),
      message: message?.trim() || null,
    }).returning();

    res.status(201).json({
      success: true,
      data: { id: result[0].id, username: result[0].username, status: result[0].status },
    });
  } catch (error) {
    console.error("auth:request", error);
    res.status(500).json({ success: false, error: "Request failed" });
  }
});

// GET /api/auth/requests — admin: list registration requests
router.get("/requests", authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const all = (await db.select().from(registrationRequests)).map((r) => ({
      id: r.id, username: r.username, displayName: r.displayName, message: r.message,
      status: r.status, createdAt: r.createdAt, reviewedAt: r.reviewedAt,
    }));

    res.json({ success: true, data: all });
  } catch (error) {
    console.error("auth:listRequests", error);
    res.status(500).json({ success: false, error: "Failed to fetch requests" });
  }
});

// PUT /api/auth/requests/:id — admin: approve or reject
router.put("/requests/:id", authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = safeParseId(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }
    const { action } = req.body;

    const rows = await db.select().from(registrationRequests).where(eq(registrationRequests.id, id));
    const request = rows[0];
    if (!request) {
      res.status(404).json({ success: false, error: "Request not found" });
      return;
    }
    if (request.status !== "pending") {
      res.status(400).json({ success: false, error: "Request already processed" });
      return;
    }

    if (action === "approve") {
      const existing = await db.select().from(users).where(eq(users.username, request.username));
      if (existing[0]) {
        res.status(409).json({ success: false, error: "Username already taken" });
        return;
      }

      await db.insert(users).values({
        username: request.username,
        passwordHash: request.passwordHash,
        displayName: request.displayName || request.username,
        role: "user",
      });

      await db.update(registrationRequests).set({
        status: "approved",
        reviewedBy: req.userId,
        reviewedAt: new Date().toISOString(),
      }).where(eq(registrationRequests.id, id));

      res.json({ success: true, data: { status: "approved" } });
    } else if (action === "reject") {
      await db.update(registrationRequests).set({
        status: "rejected",
        reviewedBy: req.userId,
        reviewedAt: new Date().toISOString(),
      }).where(eq(registrationRequests.id, id));

      res.json({ success: true, data: { status: "rejected" } });
    } else {
      res.status(400).json({ success: false, error: "Invalid action (use 'approve' or 'reject')" });
    }
  } catch (error) {
    console.error("auth:processRequest", error);
    res.status(500).json({ success: false, error: "Failed to process request" });
  }
});

// POST /api/auth/register (admin only)
router.post("/register", authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { username, password, displayName, role } = req.body;
    if (!username || !password) {
      res.status(400).json({ success: false, error: "Username and password are required" });
      return;
    }

    const existing = await db.select().from(users).where(eq(users.username, username));
    if (existing[0]) {
      res.status(409).json({ success: false, error: "Username already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.insert(users).values({
      username,
      passwordHash,
      displayName: displayName || username,
      role: role || "user",
    }).returning();

    res.status(201).json({
      success: true,
      data: { id: result[0].id, username: result[0].username, displayName: result[0].displayName, role: result[0].role },
    });
  } catch (error) {
    console.error("auth:register", error);
    res.status(500).json({ success: false, error: "Registration failed" });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(users).where(eq(users.id, req.userId!));
    const user = rows[0];
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }
    const [teamGroupsList, hasProjects, lastLoginAt] = await Promise.all([
      getUserTeamGroups(user.id),
      hasProjectMembership(user.id),
      getLastLoginAt(user.id),
    ]);
    res.json({
      success: true,
      data: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, aiModel: user.aiModel, allowedModels: JSON.parse(user.allowedModels || "[]"), teamGroups: teamGroupsList, hasProjectAccess: hasProjects || teamGroupsList.length > 0, lastLoginAt },
    });
  } catch (error) {
    console.error("auth:me", error);
    res.status(500).json({ success: false, error: "Failed to get user info" });
  }
});

// POST /api/auth/logout — log logout event
router.post("/logout", authMiddleware, async (req: AuthRequest, res) => {
  db.insert(userActivityLog).values({
    userId: req.userId!, action: "auth.logout", category: "general", targetType: "auth",
    ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "",
    userAgent: req.headers["user-agent"] || "",
    metadata: JSON.stringify({ method: "POST", path: "/api/auth/logout" }),
  }).catch(() => {});
  res.json({ success: true });
});

// PUT /api/auth/me — update own settings
router.put("/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const rows = await db.select().from(users).where(eq(users.id, userId));
    const user = rows[0];
    if (!user) { res.status(404).json({ success: false, error: "User not found" }); return; }

    const updates: Record<string, unknown> = {};

    if (req.body.aiModel !== undefined) {
      const allowed: string[] = JSON.parse(user.allowedModels || "[]");
      // Admin can use any model; others only allowed models
      if (user.role === "admin" || allowed.includes(req.body.aiModel)) {
        updates.aiModel = req.body.aiModel;
      } else {
        res.status(403).json({ success: false, error: "Model not allowed" });
        return;
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.update(users).set(updates).where(eq(users.id, userId));
    }

    const [updated] = await db.select().from(users).where(eq(users.id, userId));
    const [teamGroupsList, hasProjects] = await Promise.all([
      getUserTeamGroups(userId),
      hasProjectMembership(userId),
    ]);
    res.json({
      success: true,
      data: { id: updated.id, username: updated.username, displayName: updated.displayName, role: updated.role, aiModel: updated.aiModel, allowedModels: JSON.parse(updated.allowedModels || "[]"), teamGroups: teamGroupsList, hasProjectAccess: hasProjects || teamGroupsList.length > 0 },
    });
  } catch (error) {
    console.error("auth:updateMe", error);
    res.status(500).json({ success: false, error: "Failed to update" });
  }
});

// GET /api/auth/users (admin only)
router.get("/users", authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const allUsers = (await db.select().from(users)).map((u) => ({
      id: u.id, username: u.username, displayName: u.displayName, role: u.role, active: u.active, aiModel: u.aiModel, allowedModels: JSON.parse(u.allowedModels || "[]"), createdAt: u.createdAt,
    }));

    res.json({ success: true, data: allUsers });
  } catch (error) {
    console.error("auth:listUsers", error);
    res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
});

// PUT /api/auth/users/:id (admin only)
router.put("/users/:id", authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = safeParseId(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }
    const updates: Record<string, unknown> = {};

    if (req.body.displayName !== undefined) updates.displayName = req.body.displayName;
    if (req.body.role !== undefined) updates.role = req.body.role;
    if (req.body.active !== undefined) updates.active = req.body.active;
    if (req.body.aiModel !== undefined) updates.aiModel = req.body.aiModel;
    if (req.body.allowedModels !== undefined) updates.allowedModels = JSON.stringify(req.body.allowedModels);
    if (req.body.password) {
      updates.passwordHash = await bcrypt.hash(req.body.password, 10);
    }

    const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    if (!result[0]) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    res.json({
      success: true,
      data: { id: result[0].id, username: result[0].username, displayName: result[0].displayName, role: result[0].role, active: result[0].active, aiModel: result[0].aiModel, allowedModels: JSON.parse(result[0].allowedModels || "[]") },
    });
  } catch (error) {
    console.error("auth:updateUser", error);
    res.status(500).json({ success: false, error: "Failed to update user" });
  }
});

// DELETE /api/auth/users/:id (admin only)
router.delete("/users/:id", authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = safeParseId(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }
    if (id === req.userId) {
      res.status(400).json({ success: false, error: "Cannot delete yourself" });
      return;
    }

    await db.delete(users).where(eq(users.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("auth:deleteUser", error);
    res.status(500).json({ success: false, error: "Failed to delete user" });
  }
});

export default router;
