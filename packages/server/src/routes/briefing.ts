import { Router } from "express";
import { type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { buildBriefing } from "../lib/briefing.js";

const router = Router();

// GET /api/briefing/today — aggregated snapshot of the user's day.
router.get("/today", asyncHandler<AuthRequest>(async (req, res) => {
  const briefing = await buildBriefing(req.userId!);
  res.json({ success: true, data: briefing });
}));

export default router;
