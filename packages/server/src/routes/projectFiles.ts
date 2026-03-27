import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { db } from "../db/index.js";
import { projectFiles, users } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { projectMemberMiddleware, type ProjectRequest } from "../middleware/projectAuth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "../../uploads");

// Ensure upload dir
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Fix Korean/CJK filename encoding (multer decodes as latin1)
function fixFilename(name: string): string {
  try {
    return Buffer.from(name, "latin1").toString("utf8");
  } catch {
    return name;
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    file.originalname = fixFilename(file.originalname);
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB per file

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".txt", ".csv", ".zip", ".mp3", ".mp4", ".mov",
]);

const router = Router();

// All routes require project membership
router.use("/:projectId/files", projectMemberMiddleware);

// GET /api/projects/:projectId/files
router.get("/:projectId/files", async (req: ProjectRequest, res) => {
  try {
    const { folder, tag } = req.query;

    let result = await db.select().from(projectFiles)
      .where(eq(projectFiles.projectId, req.projectId!));

    if (folder) {
      result = result.filter(f => f.folder === folder);
    }

    if (tag) {
      result = result.filter(f => JSON.parse(f.tags).includes(tag));
    }

    // Attach uploader names
    const allUsers = await db.select({ id: users.id, displayName: users.displayName, username: users.username }).from(users);
    const userMap = new Map(allUsers.map(u => [u.id, u.displayName || u.username]));

    const data = result.map(f => ({
      ...f,
      uploaderName: userMap.get(f.uploaderId) || "Unknown",
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error("projectFiles:list", error);
    res.status(500).json({ success: false, error: "Failed to fetch project files" });
  }
});

// POST /api/projects/:projectId/files/upload
router.post("/:projectId/files/upload", upload.single("file"), async (req: ProjectRequest, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: "No file uploaded" });
      return;
    }

    // Validate file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      fs.unlinkSync(file.path);
      res.status(400).json({ success: false, error: `File type '${ext}' is not allowed` });
      return;
    }

    const tags = req.body.tags ? JSON.parse(req.body.tags) : [];
    const folder = req.body.folder || "/";

    const result = await db.insert(projectFiles).values({
      projectId: req.projectId!,
      uploaderId: req.userId!,
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      folder,
      tags: JSON.stringify(tags),
    }).returning();

    res.status(201).json({ success: true, data: result[0] });
  } catch (error) {
    console.error("projectFiles:upload", error);
    res.status(500).json({ success: false, error: "Upload failed" });
  }
});

// DELETE /api/projects/:projectId/files/:fileId
router.delete("/:projectId/files/:fileId", async (req: ProjectRequest, res) => {
  try {
    const fileId = parseInt(req.params.fileId as string);
    if (isNaN(fileId)) {
      res.status(400).json({ success: false, error: "Invalid file ID" });
      return;
    }

    const existing = await db.select().from(projectFiles)
      .where(and(eq(projectFiles.id, fileId), eq(projectFiles.projectId, req.projectId!)));
    if (!existing[0]) {
      res.status(404).json({ success: false, error: "File not found" });
      return;
    }

    if (existing[0].uploaderId !== req.userId! && req.projectRole !== "owner" && req.projectRole !== "admin") {
      res.status(403).json({ success: false, error: "Only uploader or admin can delete this file" });
      return;
    }

    // Delete physical file
    const filePath = path.join(UPLOAD_DIR, existing[0].storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await db.delete(projectFiles).where(eq(projectFiles.id, fileId));
    res.json({ success: true });
  } catch (error) {
    console.error("projectFiles:delete", error);
    res.status(500).json({ success: false, error: "Delete failed" });
  }
});

// GET /api/projects/:projectId/files/:fileId/download
router.get("/:projectId/files/:fileId/download", async (req: ProjectRequest, res) => {
  try {
    const fileId = parseInt(req.params.fileId as string);
    if (isNaN(fileId)) {
      res.status(400).json({ success: false, error: "Invalid file ID" });
      return;
    }

    const rows = await db.select().from(projectFiles)
      .where(and(eq(projectFiles.id, fileId), eq(projectFiles.projectId, req.projectId!)));
    const file = rows[0];
    if (!file) {
      res.status(404).json({ success: false, error: "File not found" });
      return;
    }

    const filePath = path.join(UPLOAD_DIR, file.storedName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: "File missing from storage" });
      return;
    }

    const encoded = encodeURIComponent(file.originalName);
    res.setHeader("Content-Disposition", `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`);
    res.setHeader("Content-Type", file.mimeType);
    res.sendFile(filePath);
  } catch (error) {
    console.error("projectFiles:download", error);
    res.status(500).json({ success: false, error: "Download failed" });
  }
});

export default router;
