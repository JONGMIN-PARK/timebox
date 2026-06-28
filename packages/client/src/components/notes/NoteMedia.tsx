import { useState } from "react";
import { useI18n } from "@/lib/useI18n";

/**
 * Renders a note's stored media. Uses a DIRECT server URL (with a query token)
 * rather than a blob URL so the browser's native media pipeline handles HTTP
 * range requests — this is far more reliable for audio playback on iOS Safari
 * than playing a blob: URL of MediaRecorder output.
 */
export default function NoteMedia({ noteId, type }: { noteId: number; type: string }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const token = localStorage.getItem("timebox_token") || "";
  const src = `/api/notes/${noteId}/media?token=${encodeURIComponent(token)}`;

  if (failed) return <div className="text-[10px] text-red-400">{t("notes.mediaUnavailable")}</div>;

  return type === "voice" ? (
    <audio controls src={src} preload="metadata" className="w-full h-9" onError={() => setFailed(true)} />
  ) : (
    <img
      src={src}
      alt=""
      className="w-full rounded-lg max-h-56 object-contain bg-slate-50 dark:bg-slate-900/40"
      onError={() => setFailed(true)}
    />
  );
}
