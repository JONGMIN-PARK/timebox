import { Router } from "express";
import path from "path";
import { db } from "../db/index.js";
import { notes } from "../db/schema.js";
import { eq, and, desc, isNull, isNotNull } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError, NotFoundError } from "../lib/errors.js";
import { upload, UPLOAD_DIR, safeUnlink } from "../lib/upload.js";

const router = Router();

const ALLOWED_TYPES = ["text", "voice", "drawing"] as const;

const MEDIA_MIME: Record<string, string> = {
  ".webm": "audio/webm",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

// GET /api/notes — list current user's active notes (pinned first, newest first)
router.get("/", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const result = await db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), isNull(notes.trashedAt)))
    .orderBy(desc(notes.pinned), desc(notes.updatedAt));
  res.json({ success: true, data: result });
}));

// GET /api/notes/trash — list trashed notes (most recently trashed first)
router.get("/trash", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const result = await db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), isNotNull(notes.trashedAt)))
    .orderBy(desc(notes.trashedAt));
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

// POST /api/notes/upload — create a voice/drawing note from an uploaded file
router.post("/upload", upload.single("file"), asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const file = req.file;
  if (!file) throw new ValidationError("No file uploaded");
  const type = ALLOWED_TYPES.includes(req.body.type) ? req.body.type : "voice";
  if (type === "text") {
    await safeUnlink(path.join(UPLOAD_DIR, file.filename));
    throw new ValidationError("Use POST /notes for text notes");
  }
  const result = await db
    .insert(notes)
    .values({
      userId,
      type,
      title: req.body.title ? String(req.body.title).trim() : null,
      content: "",
      fileName: file.filename,
    })
    .returning();
  res.status(201).json({ success: true, data: result[0] });
}));

// GET /api/notes/:id/media — stream the note's stored file (auth-scoped)
router.get("/:id/media", asyncHandler<AuthRequest>(async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (Number.isNaN(id)) throw new ValidationError("Invalid ID");
  const userId = req.userId!;
  const [note] = await db.select().from(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
  if (!note || !note.fileName) throw new NotFoundError("Note media");
  const ext = path.extname(note.fileName).toLowerCase();
  const mime = MEDIA_MIME[ext] || "application/octet-stream";
  res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
  res.sendFile(path.join(UPLOAD_DIR, note.fileName), (err) => {
    if (err && !res.headersSent) res.status(404).json({ success: false, error: "Media not found" });
  });
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

// DELETE /api/notes/:id — soft delete (move to trash)
router.delete("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (Number.isNaN(id)) throw new ValidationError("Invalid ID");
  const userId = req.userId!;
  const result = await db
    .update(notes)
    .set({ trashedAt: new Date().toISOString() })
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .returning();
  if (!result[0]) throw new NotFoundError("Note");
  res.json({ success: true, data: result[0] });
}));

// POST /api/notes/:id/restore — restore from trash
router.post("/:id/restore", asyncHandler<AuthRequest>(async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (Number.isNaN(id)) throw new ValidationError("Invalid ID");
  const userId = req.userId!;
  const result = await db
    .update(notes)
    .set({ trashedAt: null })
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .returning();
  if (!result[0]) throw new NotFoundError("Note");
  res.json({ success: true, data: result[0] });
}));

// DELETE /api/notes/:id/permanent — permanently delete (and remove any file)
router.delete("/:id/permanent", asyncHandler<AuthRequest>(async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (Number.isNaN(id)) throw new ValidationError("Invalid ID");
  const userId = req.userId!;
  const result = await db
    .delete(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .returning();
  if (!result[0]) throw new NotFoundError("Note");
  if (result[0].fileName) {
    await safeUnlink(path.join(UPLOAD_DIR, result[0].fileName));
  }
  res.json({ success: true, data: result[0] });
}));

export default router;
