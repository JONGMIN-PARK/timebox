import { Router } from "express";
import { db } from "../db/index.js";
import { notes } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError, NotFoundError } from "../lib/errors.js";

const router = Router();

const ALLOWED_TYPES = ["text", "voice", "drawing"] as const;

// GET /api/notes — list current user's notes (pinned first, newest first)
router.get("/", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const result = await db
    .select()
    .from(notes)
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.pinned), desc(notes.updatedAt));
  res.json({ success: true, data: result });
}));

// POST /api/notes — create a note
router.post("/", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { type, title, content, fileName, color, pinned } = req.body;
  const noteType = ALLOWED_TYPES.includes(type) ? type : "text";
  const body = typeof content === "string" ? content : "";
  if (noteType === "text" && !body.trim() && !(title && String(title).trim())) {
    throw new ValidationError("Note is empty");
  }
  const result = await db
    .insert(notes)
    .values({
      userId,
      type: noteType,
      title: title ? String(title).trim() : null,
      content: body,
      fileName: fileName ? String(fileName) : null,
      color: color ? String(color) : null,
      pinned: Boolean(pinned),
    })
    .returning();
  res.status(201).json({ success: true, data: result[0] });
}));

// PUT /api/notes/:id — update a note
router.put("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (Number.isNaN(id)) throw new ValidationError("Invalid ID");
  const userId = req.userId!;
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (req.body.title !== undefined) updates.title = req.body.title ? String(req.body.title).trim() : null;
  if (req.body.content !== undefined) updates.content = typeof req.body.content === "string" ? req.body.content : "";
  if (req.body.color !== undefined) updates.color = req.body.color ? String(req.body.color) : null;
  if (req.body.pinned !== undefined) updates.pinned = Boolean(req.body.pinned);

  const result = await db
    .update(notes)
    .set(updates)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .returning();
  if (!result[0]) throw new NotFoundError("Note");
  res.json({ success: true, data: result[0] });
}));

// DELETE /api/notes/:id
router.delete("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (Number.isNaN(id)) throw new ValidationError("Invalid ID");
  const userId = req.userId!;
  const result = await db
    .delete(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .returning();
  if (!result[0]) throw new NotFoundError("Note");
  res.json({ success: true, data: result[0] });
}));

export default router;
