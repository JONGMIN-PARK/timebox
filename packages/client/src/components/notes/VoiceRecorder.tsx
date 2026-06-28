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

function extFromMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

export default function VoiceRecorder({ onSave }: Props) {
  const { t } = useI18n();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeRef = useRef<string>("");

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
    if (!navigator.mediaDevices?.getUserMedia || typeof (window as any).MediaRecorder === "undefined") {
      setError(t("notes.voiceUnsupported"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      mimeRef.current = mime;
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const type = mimeRef.current || "audio/webm";
        const b = new Blob(chunksRef.current, { type });
        setBlob(b);
        setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(b); });
        stopTracks();
      };
      recorderRef.current = mr;
      mr.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setError(t("notes.micDenied"));
      stopTracks();
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);
    setElapsed(0);
    setTitle("");
  };

  const save = async () => {
    if (!blob) return;
    setSaving(true);
    await onSave(blob, extFromMime(mimeRef.current), title.trim());
    setSaving(false);
    reset();
  };

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-3">
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
          {previewUrl && <audio controls src={previewUrl} className="w-full h-10" />}
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
