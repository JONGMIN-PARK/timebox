import { Router } from "express";
import bcrypt from "bcrypt";
import { db } from "../db/index.js";
import { users, registrationRequests } from "../db/schema.js";
import { signToken, authMiddleware, type AuthRequest } from "../middleware/auth.js";
import { eq } from "drizzle-orm";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ success: false, error: "Username and password are required" });
      return;
    }

    const user = db.select().from(users).where(eq(users.username, username)).get();
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

    const token = signToken(user.id);
    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
      },
    });
  } catch (error) {
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

    // Check if username already exists
    const existingUser = db.select().from(users).where(eq(users.username, username.trim())).get();
    if (existingUser) {
      res.status(409).json({ success: false, error: "Username already taken" });
      return;
    }

    // Check if there's already a pending request
    const existingReq = db.select().from(registrationRequests)
      .where(eq(registrationRequests.username, username.trim()))
      .all()
      .filter((r) => r.status === "pending");
    if (existingReq.length > 0) {
      res.status(409).json({ success: false, error: "A request for this username is already pending" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = db.insert(registrationRequests).values({
      username: username.trim(),
      passwordHash,
      displayName: displayName?.trim() || username.trim(),
      message: message?.trim() || null,
    }).returning().get();

    res.status(201).json({
      success: true,
      data: { id: result.id, username: result.username, status: result.status },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Request failed" });
  }
});

// GET /api/auth/requests — admin: list registration requests
router.get("/requests", authMiddleware, (req: AuthRequest, res) => {
  try {
    const requester = db.select().from(users).where(eq(users.id, req.userId!)).get();
    if (!requester || requester.role !== "admin") {
      res.status(403).json({ success: false, error: "Admin access required" });
      return;
    }

    const all = db.select().from(registrationRequests).all().map((r) => ({
      id: r.id, username: r.username, displayName: r.displayName, message: r.message,
      status: r.status, createdAt: r.createdAt, reviewedAt: r.reviewedAt,
    }));

    res.json({ success: true, data: all });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch requests" });
  }
});

// PUT /api/auth/requests/:id — admin: approve or reject
router.put("/requests/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const requester = db.select().from(users).where(eq(users.id, req.userId!)).get();
    if (!requester || requester.role !== "admin") {
      res.status(403).json({ success: false, error: "Admin access required" });
      return;
    }

    const id = parseInt(req.params.id as string);
    const { action } = req.body; // "approve" | "reject"

    const request = db.select().from(registrationRequests).where(eq(registrationRequests.id, id)).get();
    if (!request) {
      res.status(404).json({ success: false, error: "Request not found" });
      return;
    }
    if (request.status !== "pending") {
      res.status(400).json({ success: false, error: "Request already processed" });
      return;
    }

    if (action === "approve") {
      // Check username not taken
      const existing = db.select().from(users).where(eq(users.username, request.username)).get();
      if (existing) {
        res.status(409).json({ success: false, error: "Username already taken" });
        return;
      }

      // Create user
      db.insert(users).values({
        username: request.username,
        passwordHash: request.passwordHash,
        displayName: request.displayName || request.username,
        role: "user",
      }).run();

      // Update request
      db.update(registrationRequests).set({
        status: "approved",
        reviewedBy: req.userId,
        reviewedAt: new Date().toISOString(),
      }).where(eq(registrationRequests.id, id)).run();

      res.json({ success: true, data: { status: "approved" } });
    } else if (action === "reject") {
      db.update(registrationRequests).set({
        status: "rejected",
        reviewedBy: req.userId,
        reviewedAt: new Date().toISOString(),
      }).where(eq(registrationRequests.id, id)).run();

      res.json({ success: true, data: { status: "rejected" } });
    } else {
      res.status(400).json({ success: false, error: "Invalid action (use 'approve' or 'reject')" });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to process request" });
  }
});

// POST /api/auth/register (admin only)
router.post("/register", authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if requester is admin
    const requester = db.select().from(users).where(eq(users.id, req.userId!)).get();
    if (!requester || requester.role !== "admin") {
      res.status(403).json({ success: false, error: "Admin access required" });
      return;
    }

    const { username, password, displayName, role } = req.body;
    if (!username || !password) {
      res.status(400).json({ success: false, error: "Username and password are required" });
      return;
    }

    // Check if username exists
    const existing = db.select().from(users).where(eq(users.username, username)).get();
    if (existing) {
      res.status(409).json({ success: false, error: "Username already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = db.insert(users).values({
      username,
      passwordHash,
      displayName: displayName || username,
      role: role || "user",
    }).returning().get();

    res.status(201).json({
      success: true,
      data: { id: result.id, username: result.username, displayName: result.displayName, role: result.role },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Registration failed" });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, (req: AuthRequest, res) => {
  try {
    const user = db.select().from(users).where(eq(users.id, req.userId!)).get();
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }
    res.json({
      success: true,
      data: { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get user info" });
  }
});

// GET /api/auth/users (admin only)
router.get("/users", authMiddleware, (req: AuthRequest, res) => {
  try {
    const requester = db.select().from(users).where(eq(users.id, req.userId!)).get();
    if (!requester || requester.role !== "admin") {
      res.status(403).json({ success: false, error: "Admin access required" });
      return;
    }

    const allUsers = db.select().from(users).all().map((u) => ({
      id: u.id, username: u.username, displayName: u.displayName, role: u.role, active: u.active, createdAt: u.createdAt,
    }));

    res.json({ success: true, data: allUsers });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch users" });
  }
});

// PUT /api/auth/users/:id (admin only)
router.put("/users/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const requester = db.select().from(users).where(eq(users.id, req.userId!)).get();
    if (!requester || requester.role !== "admin") {
      res.status(403).json({ success: false, error: "Admin access required" });
      return;
    }

    const id = parseInt(req.params.id as string);
    const updates: Record<string, unknown> = {};

    if (req.body.displayName !== undefined) updates.displayName = req.body.displayName;
    if (req.body.role !== undefined) updates.role = req.body.role;
    if (req.body.active !== undefined) updates.active = req.body.active;
    if (req.body.password) {
      updates.passwordHash = await bcrypt.hash(req.body.password, 10);
    }

    const result = db.update(users).set(updates).where(eq(users.id, id)).returning().get();
    if (!result) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    res.json({
      success: true,
      data: { id: result.id, username: result.username, displayName: result.displayName, role: result.role, active: result.active },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update user" });
  }
});

// DELETE /api/auth/users/:id (admin only)
router.delete("/users/:id", authMiddleware, (req: AuthRequest, res) => {
  try {
    const requester = db.select().from(users).where(eq(users.id, req.userId!)).get();
    if (!requester || requester.role !== "admin") {
      res.status(403).json({ success: false, error: "Admin access required" });
      return;
    }

    const id = parseInt(req.params.id as string);
    if (id === req.userId) {
      res.status(400).json({ success: false, error: "Cannot delete yourself" });
      return;
    }

    db.delete(users).where(eq(users.id, id)).run();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete user" });
  }
});

export default router;
