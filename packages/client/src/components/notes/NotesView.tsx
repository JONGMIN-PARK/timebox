import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, Pin, PinOff, Trash2, X, StickyNote, Mic, PenLine, Trash, RotateCcw, AlertTriangle, Search, Sparkles, Send } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";
import { fmtDateTime } from "@/lib/dateUtils";
import { showToast } from "@/components/ui/Toast";
import VoiceRecorder from "./VoiceRecorder";
import DrawingPad from "./DrawingPad";
import NoteMedia from "./NoteMedia";
import AutoGrowTextarea from "./AutoGrowTextarea";

type Mode = "text" | "voice" | "drawing";

interface Note {
  id: number;
  type: string;
  title: string | null;
  content: string;
  fileName: string | null;
  summary: string | null;
  color: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  trashedAt?: string | null;
}

export default function NotesView() {
  const { t } = useI18n();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [mode, setMode] = useState<Mode>("text");
  const [showTrash, setShowTrash] = useState(false);
  const [trashed, setTrashed] = useState<Note[]>([]);
  const [confirm, setConfirm] = useState<{ id: number; permanent: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [forwarding, setForwarding] = useState<Note | null>(null);
  const [recipients, setRecipients] = useState<{ id: number; username: string; displayName: string | null }[]>([]);
  const [sendingTo, setSendingTo] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) =>
      [n.title, n.content, n.summary].some((f) => f && f.toLowerCase().includes(q)),
    );
  }, [notes, query]);

  useEffect(() => {
    if (!forwarding) return;
    api.get<{ id: number; username: string; displayName: string | null }[]>("/inbox/users").then((res) => {
      if (res.success && res.data) setRecipients(res.data);
    });
  }, [forwarding]);

  const forwardNote = useCallback(async (note: Note, toUserId: number) => {
    setSendingTo(toUserId);
    const res = await api.post(`/notes/${note.id}/forward`, { toUserId });
    setSendingTo(null);
    if (res.success) {
      setForwarding(null);
      showToast("success", t("notes.forwarded"));
    } else {
      showToast("error", res.error || t("notes.forwardFailed"));
    }
  }, [t]);

  const summarizeNote = useCallback(async (note: Note) => {
    setSummarizing(true);
    const res = await api.post<Note>(`/notes/${note.id}/summarize`, {});
    setSummarizing(false);
    if (res.success && res.data) {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? res.data! : n)));
      setEditing((cur) => (cur && cur.id === note.id ? res.data! : cur));
      showToast("success", t("notes.summaryDone"));
    } else {
      showToast("error", res.error || t("notes.summaryFailed"));
    }
  }, [t]);

  const uploadMedia = useCallback(async (type: "voice" | "drawing", blob: Blob, ext: string, title: string) => {
    const token = localStorage.getItem("timebox_token");
    const fd = new FormData();
    fd.append("type", type);
    if (title) fd.append("title", title);
    fd.append("file", blob, `note.${ext}`);
    try {
      const res = await fetch("/api/notes/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const j = await res.json();
      if (j.success && j.data) {
        setNotes((prev) => [j.data, ...prev]);
        showToast("success", t("notes.saved"));
      } else {
        showToast("error", j.error || t("notes.saveFailed"));
      }
    } catch {
      showToast("error", t("notes.saveFailed"));
    }
  }, [t]);

  const fetchNotes = useCallback(async () => {
    const res = await api.get<Note[]>("/notes");
    if (res.success && res.data) setNotes(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const addNote = async () => {
    if (!content.trim() && !title.trim()) return;
    setSaving(true);
    const res = await api.post<Note>("/notes", { type: "text", title: title.trim() || null, content });
    setSaving(false);
    if (res.success && res.data) {
      setNotes((prev) => [res.data!, ...prev]);
      setTitle("");
      setContent("");
    } else {
      showToast("error", res.error || t("notes.saveFailed"));
    }
  };

  const togglePin = async (note: Note) => {
    const res = await api.put<Note>(`/notes/${note.id}`, { pinned: !note.pinned });
    if (res.success && res.data) {
      setNotes((prev) =>
        [...prev.map((n) => (n.id === note.id ? res.data! : n))].sort(
          (a, b) => Number(b.pinned) - Number(a.pinned) || (a.updatedAt < b.updatedAt ? 1 : -1),
        ),
      );
    }
  };

  const fetchTrash = useCallback(async () => {
    const res = await api.get<Note[]>("/notes/trash");
    if (res.success && res.data) setTrashed(res.data);
  }, []);

  // Ask before deleting; active notes go to trash, trashed notes delete permanently.
  const requestDelete = (id: number, permanent: boolean) => setConfirm({ id, permanent });

  const doDelete = async () => {
    if (!confirm) return;
    const { id, permanent } = confirm;
    if (permanent) {
      const res = await api.delete(`/notes/${id}/permanent`);
      if (res.success) {
        setTrashed((prev) => prev.filter((n) => n.id !== id));
        showToast("success", t("notes.deletedPermanent"));
      }
    } else {
      const res = await api.delete(`/notes/${id}`);
      if (res.success) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
        if (editing?.id === id) setEditing(null);
        showToast("success", t("notes.movedToTrash"));
      }
    }
    setConfirm(null);
  };

  const restoreNote = async (id: number) => {
    const res = await api.post(`/notes/${id}/restore`, {});
    if (res.success) {
      setTrashed((prev) => prev.filter((n) => n.id !== id));
      fetchNotes();
      showToast("success", t("notes.restored"));
    }
  };

  const openTrash = () => {
    setShowTrash(true);
    fetchTrash();
  };

  const saveEdit = async () => {
    if (!editing) return;
    const res = await api.put<Note>(`/notes/${editing.id}`, { title: editing.title, content: editing.content });
    if (res.success && res.data) {
      setNotes((prev) => prev.map((n) => (n.id === editing.id ? res.data! : n)));
      setEditing(null);
      showToast("success", t("notes.saved"));
    } else {
      showToast("error", res.error || t("notes.saveFailed"));
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          {showTrash ? (
            <>
              <button onClick={() => setShowTrash(false)} className="p-1 -ml-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title={t("notes.back")}>
                <X className="w-4 h-4" />
              </button>
              <Trash className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-900 dark:text-white">{t("notes.trash")}</h2>
              <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full tabular-nums">{trashed.length}</span>
            </>
          ) : (
            <>
              <StickyNote className="w-4 h-4 text-amber-500" />
              <h2 className="font-semibold text-slate-900 dark:text-white">{t("notes.title")}</h2>
              <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full tabular-nums">{notes.length}</span>
            </>
          )}
        </div>
        {/* Capture type switcher + trash */}
        {!showTrash && (
          <div className="flex items-center gap-1 text-[10px]">
            {([
              { id: "text", icon: StickyNote, label: t("notes.typeText") },
              { id: "voice", icon: Mic, label: t("notes.typeVoice") },
              { id: "drawing", icon: PenLine, label: t("notes.typeDraw") },
            ] as const).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={cn(
                  "flex items-center gap-0.5 px-1.5 py-1 rounded-md transition-colors",
                  mode === m.id
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 font-medium"
                    : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50",
                )}
                aria-pressed={mode === m.id}
              >
                <m.icon className="w-3 h-3" /> {m.label}
              </button>
            ))}
            <button
              type="button"
              onClick={openTrash}
              className="flex items-center gap-0.5 px-1.5 py-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 ml-0.5 border-l border-slate-200 dark:border-slate-700 pl-1.5"
              title={t("notes.trash")}
            >
              <Trash className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      {!showTrash && (
        <div className="px-4 pt-3 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("notes.searchPlaceholder")}
              className="w-full text-sm pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={t("common.cancel")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {showTrash ? (
          trashed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Trash className="w-10 h-10 mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm">{t("notes.trashEmpty")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {trashed.map((note) => (
                <div key={note.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-800 flex flex-col opacity-90">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 line-clamp-1 flex-1">{note.title || t(`notes.type${note.type === "voice" ? "Voice" : note.type === "drawing" ? "Draw" : "Text"}`)}</p>
                  </div>
                  {note.type === "text" ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap line-clamp-4 flex-1">{note.content}</p>
                  ) : (
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      {note.type === "voice" ? <Mic className="w-3 h-3" /> : <PenLine className="w-3 h-3" />}
                      {t(`notes.type${note.type === "voice" ? "Voice" : "Draw"}`)}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-2 tabular-nums">{note.trashedAt ? fmtDateTime(note.trashedAt) : ""}</p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => restoreNote(note.id)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <RotateCcw className="w-3.5 h-3.5" /> {t("notes.restore")}
                    </button>
                    <button onClick={() => requestDelete(note.id, true)} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" title={t("notes.deleteForever")}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
        <>
        {/* Composer (varies by capture type) */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 space-y-2">
          {mode === "text" && (
            <>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("notes.titlePlaceholder")}
                className="w-full text-sm font-medium bg-transparent text-slate-900 dark:text-white placeholder-slate-400 outline-none"
              />
              <AutoGrowTextarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t("notes.contentPlaceholder")}
                minRows={3}
                maxHeight={400}
                className="w-full text-sm bg-slate-50 dark:bg-slate-900/40 rounded-lg px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              <div className="flex justify-end">
                <button
                  onClick={addNote}
                  disabled={saving || (!content.trim() && !title.trim())}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" /> {t("notes.add")}
                </button>
              </div>
            </>
          )}
          {mode === "voice" && <VoiceRecorder onSave={(blob, ext, ti) => uploadMedia("voice", blob, ext, ti)} />}
          {mode === "drawing" && <DrawingPad onSave={(blob, ext, ti) => uploadMedia("drawing", blob, ext, ti)} />}
        </div>

        {/* List */}
        {loading ? (
          <p className="text-center text-xs text-slate-400 py-8">{t("common.loading")}</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <StickyNote className="w-10 h-10 mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm">{query.trim() ? t("notes.noResults") : t("notes.empty")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((note) => (
              <div
                key={note.id}
                className={cn(
                  "group relative rounded-xl border p-3 bg-white dark:bg-slate-800 hover:shadow-md transition-shadow cursor-pointer flex flex-col",
                  note.pinned ? "border-amber-300 dark:border-amber-500/40" : "border-slate-200 dark:border-slate-700",
                )}
                onClick={() => setEditing(note)}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  {note.title ? (
                    <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1 flex-1">{note.title}</p>
                  ) : (
                    <span className="flex-1" />
                  )}
                  <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => togglePin(note)}
                      className={cn("p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700", note.pinned ? "text-amber-500" : "text-slate-300 dark:text-slate-500")}
                      title={note.pinned ? t("notes.unpin") : t("notes.pin")}
                    >
                      {note.pinned ? <Pin className="w-3.5 h-3.5 fill-current" /> : <PinOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => requestDelete(note.id, false)}
                      className="p-1 rounded text-slate-300 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity"
                      title={t("common.delete")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {note.type === "text" ? (
                  <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words flex-1">{note.content}</p>
                ) : (
                  <div className="flex-1" onClick={(e) => e.stopPropagation()}>
                    <NoteMedia noteId={note.id} type={note.type} />
                  </div>
                )}
                {note.summary && (
                  <p className="text-[10px] text-blue-600 dark:text-blue-300 bg-blue-50/60 dark:bg-blue-900/20 rounded-md px-2 py-1 mt-2 line-clamp-3 flex items-start gap-1">
                    <Sparkles className="w-3 h-3 shrink-0 mt-0.5" />
                    <span className="min-w-0">{note.summary}</span>
                  </p>
                )}
                <p className="text-[10px] text-slate-400 mt-2 tabular-nums flex items-center gap-1">
                  {note.type === "voice" && <Mic className="w-3 h-3" />}
                  {note.type === "drawing" && <PenLine className="w-3 h-3" />}
                  {fmtDateTime(note.updatedAt)}
                </p>
              </div>
            ))}
          </div>
        )}
        </>
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl flex flex-col max-h-[90dvh] pb-[calc(var(--mobile-nav-h,56px)+env(safe-area-inset-bottom,0px))] sm:pb-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("notes.edit")}</h3>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto">
              <input
                value={editing.title ?? ""}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder={t("notes.titlePlaceholder")}
                className="w-full text-sm font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
              {editing.type === "text" ? (
                <AutoGrowTextarea
                  value={editing.content}
                  onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                  minRows={8}
                  maxHeight={480}
                  placeholder={t("notes.contentPlaceholder")}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <div onClick={(e) => e.stopPropagation()}>
                  <NoteMedia noteId={editing.id} type={editing.type} />
                </div>
              )}
              {editing.type === "text" && (
                <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-900/10 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> {t("notes.aiSummary")}
                    </span>
                    <button
                      onClick={() => summarizeNote(editing)}
                      disabled={summarizing || !editing.content.trim()}
                      className="text-[11px] px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white"
                    >
                      {summarizing ? t("notes.summarizing") : editing.summary ? t("notes.resummarize") : t("notes.summarize")}
                    </button>
                  </div>
                  {editing.summary ? (
                    <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{editing.summary}</p>
                  ) : (
                    <p className="text-[11px] text-slate-400">{t("notes.summaryEmpty")}</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 p-4 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setForwarding(editing)} className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm flex items-center gap-1">
                <Send className="w-4 h-4" /> {t("notes.forward")}
              </button>
              <button onClick={() => requestDelete(editing.id, false)} className="px-3 py-2.5 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 text-sm flex items-center gap-1">
                <Trash2 className="w-4 h-4" /> {t("common.delete")}
              </button>
              <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300">
                {t("common.cancel")}
              </button>
              <button onClick={saveEdit} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium">
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirm && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirm(null)}
        >
          <div className="w-full max-w-xs bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center gap-2">
              <div className={cn("w-11 h-11 rounded-full flex items-center justify-center", confirm.permanent ? "bg-red-100 dark:bg-red-900/30 text-red-500" : "bg-amber-100 dark:bg-amber-900/30 text-amber-500")}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {confirm.permanent ? t("notes.confirmPermanentTitle") : t("notes.confirmTrashTitle")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {confirm.permanent ? t("notes.confirmPermanentMsg") : t("notes.confirmTrashMsg")}
              </p>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300">
                {t("common.cancel")}
              </button>
              <button onClick={doDelete} className={cn("flex-1 py-2.5 rounded-xl text-white text-sm font-medium", confirm.permanent ? "bg-red-600 hover:bg-red-500" : "bg-amber-600 hover:bg-amber-500")}>
                {confirm.permanent ? t("notes.deleteForever") : t("notes.moveToTrash")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forward modal */}
      {forwarding && (
        <div
          className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center sm:p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={() => setForwarding(null)}
        >
          <div
            className="w-full sm:max-w-sm bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl flex flex-col max-h-[80dvh] pb-[calc(var(--mobile-nav-h,56px)+env(safe-area-inset-bottom,0px))] sm:pb-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Send className="w-4 h-4 text-blue-500" /> {t("notes.forwardTitle")}
              </h3>
              <button onClick={() => setForwarding(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 overflow-y-auto">
              {recipients.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">{t("notes.noRecipients")}</p>
              ) : (
                recipients.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => forwardNote(forwarding, u.id)}
                    disabled={sendingTo != null}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 text-left"
                  >
                    <span className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                      {(u.displayName || u.username || "U")[0].toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-slate-900 dark:text-white truncate">{u.displayName || u.username}</span>
                      <span className="block text-[11px] text-slate-400 truncate">@{u.username}</span>
                    </span>
                    {sendingTo === u.id && <span className="text-[11px] text-blue-500">…</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
