import { Router } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../db/index.js";
import { notes, users, inboxMessages } from "../db/schema.js";
import { eq, and, desc, isNull, isNotNull } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError, NotFoundError, AppError } from "../lib/errors.js";
import { upload, UPLOAD_DIR, safeUnlink } from "../lib/upload.js";
import { emitToUser, emitInboxUpdate } from "../socket/index.js";

/** Deprecated preview model IDs → current stable ones (mirrors telegram bot). */
const DEPRECATED_MODELS: Record<string, string> = {
  "gemini-2.5-pro-preview-05-06": "gemini-2.5-pro",
  "gemini-2.5-flash-preview-05-20": "gemini-2.5-flash",
  "gemini-3-pro-preview": "gemini-3.1-pro-preview",
};

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
      pinned: false,
    })
    .returning();

  // Notify the recipient via their inbox.
  const [sender] = await db
    .select({ displayName: users.displayName, username: users.username })
    .from(users)
    .where(eq(users.id, fromUserId));
  const fromName = sender?.displayName || sender?.username || "Someone";
  const preview =
    note.title ||
    (note.content ? note.content.slice(0, 80) : note.type === "voice" ? "🎤 음성 메모" : "✏️ 손글씨 메모");
  const [msg] = await db
    .insert(inboxMessages)
    .values({
      fromUserId,
      toUserId: targetId,
      subject: `📝 ${fromName}님이 메모를 보냈습니다`,
      content: preview,
      type: "system",
    })
    .returning();
  emitToUser(targetId, "inbox:new-message", { message: msg, fromName });
  emitInboxUpdate(targetId);

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
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new AppError("AI is not configured", 503);

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const rawModel = user?.aiModel || "gemini-2.0-flash";
  const modelName = DEPRECATED_MODELS[rawModel] || rawModel;

  let summary: string;
  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
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

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new AppError("AI is not configured", 503);

  const ext = path.extname(note.fileName).toLowerCase();
  const mimeType = GEMINI_AUDIO_MIME[ext];
  if (!mimeType) throw new ValidationError(`Unsupported audio format: ${ext}`);

  let audioB64: string;
  try {
    audioB64 = (await fs.promises.readFile(path.join(UPLOAD_DIR, note.fileName))).toString("base64");
  } catch {
    throw new NotFoundError("Note media");
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const rawModel = user?.aiModel || "gemini-2.0-flash";
  const modelName = DEPRECATED_MODELS[rawModel] || rawModel;

  let transcript: string;
  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    const prompt =
      "이 오디오를 원문 그대로 받아써줘(전사). 화자의 말을 정확히 텍스트로 옮기고, 부연 설명·요약 없이 전사 내용만 출력해. 알아들을 수 없으면 빈 문자열을 반환해.";
    const result = await model.generateContent([
      { inlineData: { mimeType, data: audioB64 } },
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
