import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { db } from "../db/index.js";
import { files } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { type AuthRequest, safeParseId } from "../middleware/auth.js";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "../../uploads");
const MAX_STORAGE = 500 * 1024 * 1024; // 500MB

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

const router = Router();

// GET /api/files
router.get("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { tag, search } = req.query;
    let result = await db.select().from(files).where(eq(files.userId, userId));

    if (tag) result = result.filter((f) => JSON.parse(f.tags).includes(tag));
    if (search) result = result.filter((f) => f.originalName.toLowerCase().includes((search as string).toLowerCase()));

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch files" });
  }
});

// GET /api/files/usage
router.get("/usage", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const result = await db.select().from(files).where(eq(files.userId, userId));
    const usedBytes = result.reduce((s, f) => s + f.size, 0);
    res.json({ success: true, data: { usedBytes, maxBytes: MAX_STORAGE, fileCount: result.length } });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get usage" });
  }
});

// POST /api/files/upload
router.post("/upload", upload.single("file"), async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const file = req.file;
    if (!file) { res.status(400).json({ success: false, error: "No file uploaded" }); return; }

    // Check storage limit
    const currentFiles = await db.select().from(files).where(eq(files.userId, userId));
    const currentUsage = currentFiles.reduce((s, f) => s + f.size, 0);
    if (currentUsage + file.size > MAX_STORAGE) {
      fs.unlinkSync(file.path);
      res.status(413).json({ success: false, error: "Storage limit exceeded (500MB)" });
      return;
    }

    const tags = req.body.tags ? JSON.parse(req.body.tags) : [];
    const result = await db.insert(files).values({
      userId,
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      tags: JSON.stringify(tags),
      uploadedVia: "web",
    }).returning();

    res.status(201).json({ success: true, data: result[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: "Upload failed" });
  }
});

// GET /api/files/:id/download
router.get("/:id/download", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const id = safeParseId(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }

    const rows = await db.select().from(files).where(and(eq(files.id, id), eq(files.userId, userId)));
    const file = rows[0];
    if (!file) { res.status(404).json({ success: false, error: "File not found" }); return; }

    const filePath = path.join(UPLOAD_DIR, file.storedName);
    if (!fs.existsSync(filePath)) { res.status(404).json({ success: false, error: "File missing from storage" }); return; }

    const encoded = encodeURIComponent(file.originalName);
    res.setHeader("Content-Disposition", `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`);
    res.setHeader("Content-Type", file.mimeType);
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ success: false, error: "Download failed" });
  }
});

// GET /api/files/:id/preview — inline preview for images/PDFs
router.get("/:id/preview", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const id = safeParseId(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }

    const rows = await db.select().from(files).where(and(eq(files.id, id), eq(files.userId, userId)));
    const file = rows[0];
    if (!file) { res.status(404).json({ success: false, error: "File not found" }); return; }

    const filePath = path.join(UPLOAD_DIR, file.storedName);
    if (!fs.existsSync(filePath)) { res.status(404).json({ success: false, error: "File missing" }); return; }

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", "inline");
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ success: false, error: "Preview failed" });
  }
});

// PUT /api/files/:id/tags
router.put("/:id/tags", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const id = safeParseId(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }

    const { tags } = req.body;
    const result = await db.update(files).set({ tags: JSON.stringify(tags || []), updatedAt: new Date().toISOString() })
      .where(and(eq(files.id, id), eq(files.userId, userId))).returning();
    if (!result[0]) { res.status(404).json({ success: false, error: "File not found" }); return; }

    res.json({ success: true, data: result[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update tags" });
  }
});

// DELETE /api/files/:id
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const id = safeParseId(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }

    const rows = await db.select().from(files).where(and(eq(files.id, id), eq(files.userId, userId)));
    const file = rows[0];
    if (!file) { res.status(404).json({ success: false, error: "File not found" }); return; }

    // Delete physical file
    const filePath = path.join(UPLOAD_DIR, file.storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await db.delete(files).where(eq(files.id, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: "Delete failed" });
  }
});

export default router;
