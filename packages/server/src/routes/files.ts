import { Router } from "express";
import path from "path";
import fs from "fs";
import { db } from "../db/index.js";
import { files } from "../db/schema.js";
import { eq, and, ilike } from "drizzle-orm";
import { type AuthRequest, safeParseId } from "../middleware/auth.js";
import { upload, UPLOAD_DIR, MAX_STORAGE, safeUnlink, safeJsonParse } from "../lib/upload.js";

const router = Router();

// GET /api/files
router.get("/", async (req: AuthRequest, res) => {
  try {
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
  } catch (error) {
    console.error("files:list", error);
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
    console.error("files:usage", error);
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
      await safeUnlink(file.path);
      res.status(413).json({ success: false, error: "Storage limit exceeded (500MB)" });
      return;
    }

    const tags = safeJsonParse<string[]>(req.body.tags || "[]", []);
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
    console.error("files:upload", error);
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
    console.error("files:download", error);
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
    console.error("files:preview", error);
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
    console.error("files:updateTags", error);
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

    // Delete physical file (async)
    const filePath = path.join(UPLOAD_DIR, file.storedName);
    await safeUnlink(filePath);

    await db.delete(files).where(eq(files.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("files:delete", error);
    res.status(500).json({ success: false, error: "Delete failed" });
  }
});

export default router;
