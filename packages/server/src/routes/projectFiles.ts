import { Router } from "express";
import path from "path";
import fs from "fs";
import { db } from "../db/index.js";
import { projectFiles, users } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { projectMemberMiddleware, type ProjectRequest } from "../middleware/projectAuth.js";
import { upload, UPLOAD_DIR, safeUnlink, safeJsonParse } from "../lib/upload.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError, NotFoundError, ForbiddenError } from "../lib/errors.js";

const router = Router();

// All routes require project membership
router.use("/:projectId/files", projectMemberMiddleware);

// GET /api/projects/:projectId/files
router.get("/:projectId/files", asyncHandler<ProjectRequest>(async (req, res) => {
  const { folder, tag } = req.query;

  let result = await db.select().from(projectFiles)
    .where(eq(projectFiles.projectId, req.projectId!));

  if (folder) {
    result = result.filter(f => f.folder === folder);
  }

  if (tag) {
    result = result.filter(f => safeJsonParse<string[]>(f.tags, []).includes(tag as string));
  }

  // Attach uploader names
  const allUsers = await db.select({ id: users.id, displayName: users.displayName, username: users.username }).from(users);
  const userMap = new Map(allUsers.map(u => [u.id, u.displayName || u.username]));

  const data = result.map(f => ({
    ...f,
    uploaderName: userMap.get(f.uploaderId) || "Unknown",
  }));

  res.json({ success: true, data });
}));

// POST /api/projects/:projectId/files/upload
router.post("/:projectId/files/upload", upload.single("file"), asyncHandler<ProjectRequest>(async (req, res) => {
  const file = req.file;
  if (!file) {
    throw new ValidationError("No file uploaded");
  }

  const tags = safeJsonParse<string[]>(req.body.tags || "[]", []);
  const folder = req.body.folder || "/";

  // Check for existing file with same name to determine version
  const existing = await db.select().from(projectFiles)
    .where(and(eq(projectFiles.projectId, req.projectId!), eq(projectFiles.originalName, file.originalname)));
  const version = existing.length > 0 ? Math.max(...existing.map(f => f.version || 1)) + 1 : 1;

  const result = await db.insert(projectFiles).values({
    projectId: req.projectId!,
    uploaderId: req.userId!,
    originalName: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    folder,
    tags: JSON.stringify(tags),
    version,
  }).returning();

  res.status(201).json({ success: true, data: result[0] });
}));

// DELETE /api/projects/:projectId/files/:fileId
router.delete("/:projectId/files/:fileId", asyncHandler<ProjectRequest>(async (req, res) => {
  const fileId = parseInt(req.params.fileId as string);
  if (isNaN(fileId)) {
    throw new ValidationError("Invalid file ID");
  }

  const existing = await db.select().from(projectFiles)
    .where(and(eq(projectFiles.id, fileId), eq(projectFiles.projectId, req.projectId!)));
  if (!existing[0]) {
    throw new NotFoundError("File");
  }

  if (existing[0].uploaderId !== req.userId! && req.projectRole !== "owner" && req.projectRole !== "admin") {
    throw new ForbiddenError("Only uploader or admin can delete this file");
  }

  // Delete physical file (async)
  const filePath = path.join(UPLOAD_DIR, existing[0].storedName);
  await safeUnlink(filePath);

  await db.delete(projectFiles).where(eq(projectFiles.id, fileId));
  res.json({ success: true });
}));

// GET /api/projects/:projectId/files/:fileId/download
router.get("/:projectId/files/:fileId/download", asyncHandler<ProjectRequest>(async (req, res) => {
  const fileId = parseInt(req.params.fileId as string);
  if (isNaN(fileId)) {
    throw new ValidationError("Invalid file ID");
  }

  const rows = await db.select().from(projectFiles)
    .where(and(eq(projectFiles.id, fileId), eq(projectFiles.projectId, req.projectId!)));
  const file = rows[0];
  if (!file) {
    throw new NotFoundError("File");
  }

  const filePath = path.join(UPLOAD_DIR, file.storedName);
  if (!fs.existsSync(filePath)) {
    throw new NotFoundError("File missing from storage");
  }

  const encoded = encodeURIComponent(file.originalName);
  res.setHeader("Content-Disposition", `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`);
  res.setHeader("Content-Type", file.mimeType);
  res.sendFile(filePath);
}));

export default router;
