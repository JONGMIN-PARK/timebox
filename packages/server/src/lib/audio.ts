import fs from "fs";
import { spawn } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import { logger } from "./logger.js";

/** Resolve a usable ffmpeg binary: the bundled ffmpeg-static if present,
 *  else a system `ffmpeg` on PATH, else null (transcode unavailable). */
function resolveFfmpeg(): string | null {
  if (ffmpegStatic && fs.existsSync(ffmpegStatic)) return ffmpegStatic;
  // ffmpeg-static's binary may not have been downloaded; fall back to PATH.
  return "ffmpeg";
}

/**
 * Transcode an audio file to 16kHz mono WAV (a format Gemini reliably accepts
 * for inline transcription — unlike the webm/mp4 containers browsers record).
 * Returns null on any failure so callers can fall back to the original file.
 */
export function transcodeToWav(inputPath: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const bin = resolveFfmpeg();
    if (!bin) return resolve(null);
    let proc;
    try {
      proc = spawn(bin, ["-i", inputPath, "-ac", "1", "-ar", "16000", "-f", "wav", "pipe:1"], {
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch (e) {
      logger.warn("ffmpeg spawn failed", { error: (e as Error).message });
      return resolve(null);
    }
    const chunks: Buffer[] = [];
    proc.stdout?.on("data", (c: Buffer) => chunks.push(c));
    proc.on("error", (e) => {
      logger.warn("ffmpeg transcode error", { error: e.message });
      resolve(null);
    });
    proc.on("close", (code) => {
      if (code === 0 && chunks.length) resolve(Buffer.concat(chunks));
      else {
        if (code !== 0) logger.warn("ffmpeg exited non-zero", { code });
        resolve(null);
      }
    });
  });
}
