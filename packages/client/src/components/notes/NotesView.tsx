import { useEffect, useState, useCallback } from "react";
import { Plus, Pin, PinOff, Trash2, X, StickyNote, Mic, PenLine } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";
import { fmtDateTime } from "@/lib/dateUtils";
import { showToast } from "@/components/ui/Toast";

interface Note {
  id: number;
  type: string;
  title: string | null;
  content: string;
  fileName: string | null;
  color: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function NotesView() {
  const { t } = useI18n();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);

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

  const removeNote = async (id: number) => {
    const res = await api.delete(`/notes/${id}`);
    if (res.success) {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (editing?.id === id) setEditing(null);
      showToast("success", t("notes.deleted"));
    }
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
          <StickyNote className="w-4 h-4 text-amber-500" />
          <h2 className="font-semibold text-slate-900 dark:text-white">{t("notes.title")}</h2>
          <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full tabular-nums">{notes.length}</span>
        </div>
        {/* Future capture types (memo available now) */}
        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-300">
            <StickyNote className="w-3 h-3" /> {t("notes.typeText")}
          </span>
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md opacity-50" title={t("notes.comingSoon")}>
            <Mic className="w-3 h-3" /> {t("notes.typeVoice")}
          </span>
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md opacity-50" title={t("notes.comingSoon")}>
            <PenLine className="w-3 h-3" /> {t("notes.typeDraw")}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {/* Composer */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("notes.titlePlaceholder")}
            className="w-full text-sm font-medium bg-transparent text-slate-900 dark:text-white placeholder-slate-400 outline-none"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("notes.contentPlaceholder")}
            rows={3}
            className="w-full text-sm bg-slate-50 dark:bg-slate-900/40 rounded-lg px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
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
        </div>

        {/* List */}
        {loading ? (
          <p className="text-center text-xs text-slate-400 py-8">{t("common.loading")}</p>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <StickyNote className="w-10 h-10 mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm">{t("notes.empty")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {notes.map((note) => (
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
                      onClick={() => removeNote(note.id)}
                      className="p-1 rounded text-slate-300 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity"
                      title={t("common.delete")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap line-clamp-6 flex-1">{note.content}</p>
                <p className="text-[10px] text-slate-400 mt-2 tabular-nums">{fmtDateTime(note.updatedAt)}</p>
              </div>
            ))}
          </div>
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
              <textarea
                value={editing.content}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                rows={8}
                placeholder={t("notes.contentPlaceholder")}
                className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="flex gap-2 p-4 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => removeNote(editing.id)} className="px-3 py-2.5 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 text-sm flex items-center gap-1">
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
    </div>
  );
}
