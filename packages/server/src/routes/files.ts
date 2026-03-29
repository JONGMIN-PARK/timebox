import { Router } from "express";
import path from "path";
import fs from "fs";
import { db } from "../db/index.js";
import { files } from "../db/schema.js";
import { eq, and, ilike } from "drizzle-orm";
import { type AuthRequest, safeParseId } from "../middleware/auth.js";
import { upload, UPLOAD_DIR, MAX_STORAGE, safeUnlink, safeJsonParse } from "../lib/upload.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError, NotFoundError } from "../lib/errors.js";
import { AppError } from "../lib/errors.js";

const router = Router();

// GET /api/files
router.get("/", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { tag, search } = req.query;

  const conditions = [eq(files.userId, userId)];
  if (search) conditions.push(ilike(files.originalName, `%${search as string}%`));

  let result = await db.select().from(files).where(and(...conditions));

  // Tags are stored as JSON text, so filter in JS
  if (tag) {
    result = result.filter((f) => safeJsonParse<string[]>(f.tags, []).includes(tag as string));
  }

  res.json({ success: true, data: result });
}));

// GET /api/files/usage
router.get("/usage", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const result = await db.select().from(files).where(eq(files.userId, userId));
  const usedBytes = result.reduce((s, f) => s + f.size, 0);
  res.json({ success: true, data: { usedBytes, maxBytes: MAX_STORAGE, fileCount: result.length } });
}));

// POST /api/files/upload
router.post("/upload", upload.single("file"), asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const file = req.file;
  if (!file) { throw new ValidationError("No file uploaded"); }

  // Check storage limit
  const currentFiles = await db.select().from(files).where(eq(files.userId, userId));
  const currentUsage = currentFiles.reduce((s, f) => s + f.size, 0);
  if (currentUsage + file.size > MAX_STORAGE) {
    await safeUnlink(file.path);
    throw new AppError("Storage limit exceeded (1GB)", 413);
  }

  const tags = safeJsonParse<string[]>(req.body.tags || "[]", []);

  // Check for existing file with same name to determine version
  const existing = await db.select().from(files)
    .where(and(eq(files.userId, userId), eq(files.originalName, file.originalname)));
  const version = existing.length > 0 ? Math.max(...existing.map(f => f.version || 1)) + 1 : 1;

  const result = await db.insert(files).values({
    userId,
    originalName: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    tags: JSON.stringify(tags),
    uploadedVia: "web",
    version,
  }).returning();

  res.status(201).json({ success: true, data: result[0] });
}));

// GET /api/files/:id/download
router.get("/:id/download", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const id = safeParseId(req.params.id);
  if (!id) { throw new ValidationError("Invalid ID"); }

  const rows = await db.select().from(files).where(and(eq(files.id, id), eq(files.userId, userId)));
  const file = rows[0];
  if (!file) { throw new NotFoundError("File"); }

  const filePath = path.join(UPLOAD_DIR, file.storedName);
  if (!fs.existsSync(filePath)) { throw new NotFoundError("File missing from storage"); }

  const encoded = encodeURIComponent(file.originalName);
  res.setHeader("Content-Disposition", `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`);
  res.setHeader("Content-Type", file.mimeType);
  res.sendFile(filePath);
}));

// GET /api/files/:id/preview — inline preview for images/PDFs
router.get("/:id/preview", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const id = safeParseId(req.params.id);
  if (!id) { throw new ValidationError("Invalid ID"); }

  const rows = await db.select().from(files).where(and(eq(files.id, id), eq(files.userId, userId)));
  const file = rows[0];
  if (!file) { throw new NotFoundError("File"); }

  const filePath = path.join(UPLOAD_DIR, file.storedName);
  if (!fs.existsSync(filePath)) { throw new NotFoundError("File missing from storage"); }

  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", "inline");
  res.sendFile(filePath);
}));

// PUT /api/files/:id/tags
router.put("/:id/tags", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const id = safeParseId(req.params.id);
  if (!id) { throw new ValidationError("Invalid ID"); }

  const { tags } = req.body;
  const result = await db.update(files).set({ tags: JSON.stringify(tags || []), updatedAt: new Date().toISOString() })
    .where(and(eq(files.id, id), eq(files.userId, userId))).returning();
  if (!result[0]) { throw new NotFoundError("File"); }

  res.json({ success: true, data: result[0] });
}));

// DELETE /api/files/:id
router.delete("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const id = safeParseId(req.params.id);
  if (!id) { throw new ValidationError("Invalid ID"); }

  const rows = await db.select().from(files).where(and(eq(files.id, id), eq(files.userId, userId)));
  const file = rows[0];
  if (!file) { throw new NotFoundError("File"); }

  // Delete physical file (async)
  const filePath = path.join(UPLOAD_DIR, file.storedName);
  await safeUnlink(filePath);

  await db.delete(files).where(eq(files.id, id));
  res.json({ success: true });
}));

export default router;
