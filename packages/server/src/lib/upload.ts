import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "../../../uploads");
// Per-file cap for a single upload (chat file sharing supports up to 2GB).
export const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE) || 2 * 1024 * 1024 * 1024; // 2GB
// Total per-user storage cap (must comfortably hold at least one max-size file).
export const MAX_STORAGE = Number(process.env.MAX_STORAGE) || 5 * 1024 * 1024 * 1024; // 5GB

// Ensure upload dir
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".txt", ".csv", ".zip", ".mp3", ".mp4", ".mov",
  // Voice-memo audio formats (MediaRecorder output varies by browser)
  ".webm", ".m4a", ".wav", ".ogg", ".oga",
  // Common shared-file formats
  ".hwp", ".hwpx", ".7z", ".rar", ".tar", ".gz", ".mkv", ".avi", ".json", ".md",
]);

// Fix Korean/CJK filename encoding (multer decodes as latin1)
export function fixFilename(name: string): string {
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

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  const ext = path.extname(fixFilename(file.originalname)).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    cb(new Error(`File type '${ext}' is not allowed`));
    return;
  }
  cb(null, true);
}

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE }, // up to 2GB per file
  fileFilter,
});

// Safe async file deletion (non-blocking)
export async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // File may already be deleted
  }
}

// Safe JSON parse with fallback
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}
