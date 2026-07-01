import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, Square, Trash2, Save } from "lucide-react";
import { useI18n } from "@/lib/useI18n";

type Props = {
  onSave: (blob: Blob, ext: string, title: string) => Promise<void> | void;
};

function pickMime(): string {
  const candidates = ["audio/webm", "audio/mp4", "audio/ogg"];
  const MR = (window as any).MediaRecorder;
  if (MR?.isTypeSupported) {
    for (const c of candidates) if (MR.isTypeSupported(c)) return c;
  }
  return "";
}

/** Extension that matches the actual recorded container so the server serves the right MIME. */
function extFromMime(mime: string): string {
  const m = (mime || "").toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("wav")) return "wav";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  return "webm";
}

/** iOS home-screen (standalone) PWAs often block microphone access. */
function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  return (navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true;
}

export default function VoiceRecorder({ onSave }: Props) {
  const { t } = useI18n();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [saving, setSaving] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeRef = useRef<string>("");
  // The container the recorder actually produced (may differ from the requested mime).
  const actualMimeRef = useRef<string>("audio/webm");

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopTracks();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [stopTracks, previewUrl]);

  const start = async () => {
    setError(null);
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError(t("notes.voiceInsecure"));
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof (window as any).MediaRecorder === "undefined") {
      setError(t("notes.voiceUnsupported"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Let each browser use its NATIVE default container (webm on Chrome, mp4 on
      // iOS Safari) — these are always playable in that same browser. Only pass an
      // explicit mimeType if the platform actually reports support for it.
      const preferred = pickMime();
      let mr: MediaRecorder;
      try {
        mr = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
      } catch {
        mr = new MediaRecorder(stream);
      }
      mimeRef.current = mr.mimeType || preferred;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        // Use the container the recorder actually produced.
        const type = (mr.mimeType || mimeRef.current || "audio/webm").split(";")[0].trim() || "audio/webm";
        actualMimeRef.current = type;
        const b = new Blob(chunksRef.current, { type });
        stopTracks();
        if (b.size === 0) {
          setError(t("notes.recordEmpty"));
          return;
        }
        setBlob(b);
        setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(b); });
      };
      // Surface the actual MediaRecorder failure (helps diagnose iOS issues)
      // instead of leaving the user with a silent/empty recording.
      mr.onerror = (ev: Event) => {
        const e = (ev as unknown as { error?: { name?: string; message?: string } }).error;
        const detail = e?.name || e?.message;
        setError(detail ? `${t("notes.voiceUnsupported")} (${detail})` : t("notes.voiceUnsupported"));
        setRecording(false);
        stopTracks();
      };
      recorderRef.current = mr;
      // Timeslice ensures dataavailable fires during capture (more reliable on iOS).
      // Some iOS Safari versions reject a timeslice argument — fall back to a plain start.
      try {
        mr.start(1000);
      } catch {
        mr.start();
      }
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (err) {
      const name = (err as { name?: string })?.name;
      setError(name === "NotAllowedError" || name === "SecurityError" ? t("notes.micDenied") : t("notes.voiceUnsupported"));
      stopTracks();
    }
  };

  const stop = () => {
    const mr = recorderRef.current;
    if (mr && mr.state !== "inactive") {
      // Flush the final buffered chunk before stopping — on iOS the last
      // segment is sometimes only emitted in response to an explicit request.
      try { mr.requestData(); } catch { /* not supported everywhere */ }
      mr.stop();
    }
    setRecording(false);
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);
    setElapsed(0);
    setTitle("");
    setPreviewError(false);
  };

  const save = async () => {
    if (!blob) return;
    setSaving(true);
    await onSave(blob, extFromMime(actualMimeRef.current), title.trim());
    setSaving(false);
    reset();
  };

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      {isStandalonePWA() && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-2.5 py-1.5">
          {t("notes.standaloneMicHint")}
        </p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {!blob ? (
        <div className="flex flex-col items-center justify-center py-4 gap-3">
          <button
            type="button"
            onClick={recording ? stop : start}
            className={cnBtn(recording)}
            aria-label={recording ? t("notes.stop") : t("notes.record")}
          >
            {recording ? <Square className="w-6 h-6 fill-current" /> : <Mic className="w-6 h-6" />}
          </button>
          <p className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
            {recording ? mmss : t("notes.recordHint")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {previewUrl && (
            <audio
              controls
              src={previewUrl}
              className="w-full h-10"
              onError={() => setPreviewError(true)}
            />
          )}
          {previewError && <p className="text-[11px] text-amber-600 dark:text-amber-400">{t("notes.previewHint")}</p>}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("notes.titlePlaceholder")}
            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button type="button" onClick={reset} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300">
              <Trash2 className="w-4 h-4" /> {t("notes.discard")}
            </button>
            <button type="button" onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-blue-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-sm font-medium">
              <Save className="w-4 h-4" /> {t("notes.add")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function cnBtn(recording: boolean): string {
  return [
    "w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-colors",
    recording ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-blue-600 hover:bg-blue-500",
  ].join(" ");
}
