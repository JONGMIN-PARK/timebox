import { Router } from "express";
import bcrypt from "bcrypt";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { signToken } from "../middleware/auth.js";
import { eq } from "drizzle-orm";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || typeof pin !== "string") {
      res.status(400).json({ success: false, error: "PIN is required" });
      return;
    }

    // Get user (single user app, always id=1)
    const user = db.select().from(users).where(eq(users.id, 1)).get();

    if (!user) {
      // First login: create user with this PIN
      const pinHash = await bcrypt.hash(pin, 10);
      db.insert(users).values({ pinHash }).run();
      const token = signToken(1);
      res.json({ success: true, data: { token, firstLogin: true } });
      return;
    }

    const valid = await bcrypt.compare(pin, user.pinHash);
    if (!valid) {
      res.status(401).json({ success: false, error: "Invalid PIN" });
      return;
    }

    const token = signToken(user.id);
    res.json({ success: true, data: { token } });
  } catch (error) {
    res.status(500).json({ success: false, error: "Login failed" });
  }
});

// POST /api/auth/verify — check if token is valid
router.post("/verify", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.json({ success: true, data: { valid: false } });
    return;
  }
  try {
    const jwt = require("jsonwebtoken");
    const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
    jwt.verify(authHeader.slice(7), JWT_SECRET);
    res.json({ success: true, data: { valid: true } });
  } catch {
    res.json({ success: true, data: { valid: false } });
  }
});

export default router;
