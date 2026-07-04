import { Router } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { db } from "../db/index.js";
import { notes, users } from "../db/schema.js";
import { eq, and, desc, isNull, isNotNull } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError, NotFoundError, AppError } from "../lib/errors.js";
import { upload, UPLOAD_DIR, safeUnlink } from "../lib/upload.js";
import { getGeminiModel } from "../lib/gemini.js";
import { notifyForward } from "../lib/forwardNotify.js";
import { transcodeToWav } from "../lib/audio.js";

const router = Router();

const ALLOWED_TYPES = ["text", "voice", "drawing", "image"] as const;

/** Normalize a labels array to a trimmed, de-duplicated JSON string (or null). */
function normalizeLabels(v: unknown): string | null {
  if (!Array.isArray(v)) return null;
  const labels = Array.from(
    new Set(v.map((x) => String(x).trim()).filter((x) => x && x.length <= 40)),
  ).slice(0, 20);
  return labels.length ? JSON.stringify(labels) : null;
}

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
    .where(and(eq(notes.userId, userId), isNull(notes.trashedAt), isNull(notes.archivedAt)))
    .orderBy(desc(notes.pinned), desc(notes.updatedAt));
  res.json({ success: true, data: result });
}));

// GET /api/notes/archived — list archived notes (most recently updated first)
router.get("/archived", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const result = await db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), isNull(notes.trashedAt), isNotNull(notes.archivedAt)))
    .orderBy(desc(notes.updatedAt));
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

// POST /api/notes/reorder — persist manual drag order (ids in desired order)
router.post("/reorder", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const clean = ids.map((v: unknown) => Number(v)).filter((n: number) => Number.isInteger(n));
  if (clean.length === 0) throw new ValidationError("ids required");
  // Assign sortOrder by position; scoped to the user so foreign ids are ignored.
  await Promise.all(
    clean.map((id: number, index: number) =>
      db.update(notes).set({ sortOrder: index }).where(and(eq(notes.id, id), eq(notes.userId, userId))),
    ),
  );
  res.json({ success: true });
}));

// POST /api/notes — create a note
router.post("/", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { type, title, content, fileName, color, pinned, labels } = req.body;
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
      labels: normalizeLabels(labels),
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

// POST /api/notes/:id/forward — send a copy of a note to another user
router.post("/:id/forward", asyncHandler<AuthRequest>(async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (Number.isNaN(id)) throw new ValidationError("Invalid ID");
  const fromUserId = req.userId!;
  const targetId = Number(req.body.toUserId);
  if (!targetId || Number.isNaN(targetId)) throw new ValidationError("toUserId is required");
  if (targetId === fromUserId) throw new ValidationError("Cannot forward to yourself");

  const [note] = await db.select().from(notes).where(and(eq(notes.id, id), eq(notes.userId, fromUserId)));
  if (!note) throw new NotFoundError("Note");
  const [target] = await db.select().from(users).where(and(eq(users.id, targetId), eq(users.active, true)));
  if (!target) throw new NotFoundError("Recipient");

  // Copy the media file (voice/drawing) so the recipient owns an independent copy.
  let newFileName: string | null = null;
  if (note.fileName) {
    const ext = path.extname(note.fileName);
    newFileName = `${crypto.randomUUID()}${ext}`;
    try {
      await fs.promises.copyFile(path.join(UPLOAD_DIR, note.fileName), path.join(UPLOAD_DIR, newFileName));
    } catch {
      newFileName = null; // source missing — forward without media
    }
  }

  const [copy] = await db
    .insert(notes)
    .values({
      userId: targetId,
      type: note.type,
      title: note.title,
      content: note.content,
      fileName: newFileName,
      summary: note.summary,
      color: note.color,
      labels: note.labels,
      pinned: false,
    })
    .returning();

  // Notify the recipient via their inbox.
  const preview =
    note.title ||
    (note.content ? note.content.slice(0, 80) : note.type === "voice" ? "🎤 음성 메모" : "✏️ 손글씨 메모");
  await notifyForward({
    fromUserId,
    toUserId: targetId,
    subjectFor: (name) => `📝 ${name}님이 메모를 보냈습니다`,
    content: preview,
  });

  res.status(201).json({ success: true, data: copy });
}));

// POST /api/notes/:id/summarize — AI summary of a text note (stored on the note)
router.post("/:id/summarize", asyncHandler<AuthRequest>(async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (Number.isNaN(id)) throw new ValidationError("Invalid ID");
  const userId = req.userId!;
  const [note] = await db.select().from(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
  if (!note) throw new NotFoundError("Note");
  if (note.type !== "text" || !note.content.trim()) {
    throw new ValidationError("Nothing to summarize");
  }
  const model = await getGeminiModel(userId);

  let summary: string;
  try {
    const prompt =
      "다음 메모를 핵심만 담아 2~3문장으로 간결하게 요약해줘. 부연 설명 없이 요약문만 출력해.\n\n" +
      `제목: ${note.title || "(없음)"}\n내용:\n${note.content}`;
    const result = await model.generateContent(prompt);
    summary = result.response.text().trim();
  } catch {
    throw new AppError("Failed to generate summary", 502);
  }
  if (!summary) throw new AppError("Empty summary", 502);

  const [updated] = await db
    .update(notes)
    .set({ summary, updatedAt: new Date().toISOString() })
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .returning();
  res.json({ success: true, data: updated });
}));

/** Audio containers Gemini accepts for inline transcription. */
const GEMINI_AUDIO_MIME: Record<string, string> = {
  ".mp3": "audio/mp3",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".webm": "audio/webm",
};

// POST /api/notes/:id/transcribe — AI transcription of a voice note into its content
router.post("/:id/transcribe", asyncHandler<AuthRequest>(async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (Number.isNaN(id)) throw new ValidationError("Invalid ID");
  const userId = req.userId!;
  const [note] = await db.select().from(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
  if (!note) throw new NotFoundError("Note");
  if (note.type !== "voice" || !note.fileName) throw new ValidationError("Not a voice note");

  const ext = path.extname(note.fileName).toLowerCase();
  const mimeType = GEMINI_AUDIO_MIME[ext];
  if (!mimeType) throw new ValidationError(`Unsupported audio format: ${ext}`);

  const model = await getGeminiModel(userId);

  const filePath = path.join(UPLOAD_DIR, note.fileName);
  if (!fs.existsSync(filePath)) throw new NotFoundError("Note media");

  // Browsers record webm (Chrome) / mp4 (iOS) — containers Gemini's inline audio
  // often rejects. Transcode those to WAV first; fall back to the original if
  // ffmpeg is unavailable (strictly no worse than before).
  const NEEDS_TRANSCODE = new Set([".webm", ".mp4", ".m4a", ".aac"]);
  let sendMime = mimeType;
  let audioB64: string;
  if (NEEDS_TRANSCODE.has(ext)) {
    const wav = await transcodeToWav(filePath);
    if (wav) {
      sendMime = "audio/wav";
      audioB64 = wav.toString("base64");
    } else {
      audioB64 = (await fs.promises.readFile(filePath)).toString("base64");
    }
  } else {
    audioB64 = (await fs.promises.readFile(filePath)).toString("base64");
  }

  let transcript: string;
  try {
    const prompt =
      "이 오디오를 원문 그대로 받아써줘(전사). 화자의 말을 정확히 텍스트로 옮기고, 부연 설명·요약 없이 전사 내용만 출력해. 알아들을 수 없으면 빈 문자열을 반환해.";
    const result = await model.generateContent([
      { inlineData: { mimeType: sendMime, data: audioB64 } },
      { text: prompt },
    ]);
    transcript = result.response.text().trim();
  } catch {
    throw new AppError("Failed to transcribe audio", 502);
  }
  if (!transcript) throw new AppError("Empty transcript", 502);

  // Store the transcript as the note's content so it becomes searchable/summarizable.
  const [updated] = await db
    .update(notes)
    .set({ content: transcript, updatedAt: new Date().toISOString() })
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .returning();
  res.json({ success: true, data: updated });
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
  if (req.body.labels !== undefined) updates.labels = normalizeLabels(req.body.labels);
  if (req.body.pinned !== undefined) updates.pinned = Boolean(req.body.pinned);

  const result = await db
    .update(notes)
    .set(updates)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .returning();
  if (!result[0]) throw new NotFoundError("Note");
  res.json({ success: true, data: result[0] });
}));

// POST /api/notes/:id/archive — hide without deleting
router.post("/:id/archive", asyncHandler<AuthRequest>(async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (Number.isNaN(id)) throw new ValidationError("Invalid ID");
  const userId = req.userId!;
  const archive = req.body.archived !== false; // default: archive; pass {archived:false} to unarchive
  const result = await db
    .update(notes)
    .set({ archivedAt: archive ? new Date().toISOString() : null, updatedAt: new Date().toISOString() })
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
