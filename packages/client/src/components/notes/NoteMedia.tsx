import { useEffect, useState } from "react";

/** Fetches a note's stored media (auth-scoped) and renders an audio player or image. */
export default function NoteMedia({ noteId, type }: { noteId: number; type: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objUrl: string | null = null;
    const token = localStorage.getItem("timebox_token");
    fetch(`/api/notes/${noteId}/media`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("media"))))
      .then((b) => {
        if (cancelled) return;
        objUrl = URL.createObjectURL(b);
        setUrl(objUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [noteId]);

  if (failed) return <div className="text-[10px] text-red-400">media unavailable</div>;
  if (!url) return <div className="text-[10px] text-slate-400 py-2">…</div>;

  return type === "voice" ? (
    <audio controls src={url} className="w-full h-9" preload="metadata" />
  ) : (
    <img src={url} alt="" className="w-full rounded-lg max-h-56 object-contain bg-slate-50 dark:bg-slate-900/40" />
  );
}
