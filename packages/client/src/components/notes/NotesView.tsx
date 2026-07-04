import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Plus, Pin, PinOff, Trash2, X, StickyNote, Mic, PenLine, Trash, RotateCcw, AlertTriangle, Search, Sparkles, Send, ArrowDownUp, Maximize2, Minimize2, ArrowRightLeft, CheckSquare, Bell, CalendarPlus, Archive, ArchiveRestore, Tag, LayoutGrid, List, GripVertical, EyeOff, Eraser, Image as ImageIcon, ScanText } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSocketEvent } from "@/lib/SocketProvider";
import { useI18n } from "@/lib/useI18n";
import { fmtDateTime } from "@/lib/dateUtils";
import { showToast } from "@/components/ui/Toast";
import VoiceRecorder from "./VoiceRecorder";
import DrawingPad from "./DrawingPad";
import NoteMedia from "./NoteMedia";
import AutoGrowTextarea from "./AutoGrowTextarea";
import NoteContent, { highlight, CHECK_RE, hasChecklist } from "./NoteContent";

type Mode = "text" | "voice" | "drawing" | "image";
type TypeFilter = "all" | "text" | "voice" | "drawing" | "image";
type SortBy = "updated" | "created" | "title" | "manual";
type ViewLayout = "grid" | "list";

/** Sortable wrapper: exposes drag handle props to a render-prop child. */
function SortableCard({
  id,
  disabled,
  children,
}: {
  id: number;
  disabled: boolean;
  children: (p: {
    setNodeRef: (el: HTMLElement | null) => void;
    style: React.CSSProperties;
    handleProps: Record<string, unknown>;
    isDragging: boolean;
  }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 30 : undefined,
  };
  return <>{children({ setNodeRef, style, handleProps: { ...attributes, ...listeners }, isDragging })}</>;
}

/** Preset color labels for notes (stored as hex in note.color). */
const NOTE_COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444"];

interface Note {
  id: number;
  type: string;
  title: string | null;
  content: string;
  fileName: string | null;
  summary: string | null;
  color: string | null;
  labels?: string | string[] | null;
  pinned: boolean;
  sortOrder?: number;
  remindAt?: string | null;
  createdAt: string;
  updatedAt: string;
  trashedAt?: string | null;
  archivedAt?: string | null;
}

/** ISO timestamp → "YYYY-MM-DDTHH:mm" in local time for a datetime-local input. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Labels are stored as a JSON string on the server; read them as an array. */
function labelsOf(note: Note): string[] {
  const v = note.labels;
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim()) {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
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
  const [transcribing, setTranscribing] = useState(false);
  const [forwarding, setForwarding] = useState<Note | null>(null);
  const [recipients, setRecipients] = useState<{ id: number; username: string; displayName: string | null }[]>([]);
  const [sendingTo, setSendingTo] = useState<number | null>(null);
  const [noteColor, setNoteColor] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("updated");
  const [viewLayout, setViewLayout] = useState<ViewLayout>("grid");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [archived, setArchived] = useState<Note[]>([]);
  const [labelDraft, setLabelDraft] = useState("");
  const [converting, setConverting] = useState<Note | null>(null);
  const [convRemindAt, setConvRemindAt] = useState("");
  const [convDate, setConvDate] = useState("");
  const [convStart, setConvStart] = useState("09:00");
  const [convEnd, setConvEnd] = useState("10:00");
  const [convBusy, setConvBusy] = useState(false);

  useEffect(() => {
    if (!converting) return;
    const pad = (n: number) => String(n).padStart(2, "0");
    const soon = new Date(Date.now() + 60 * 60 * 1000);
    setConvRemindAt(`${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}T${pad(soon.getHours())}:${pad(soon.getMinutes())}`);
    const today = new Date();
    setConvDate(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`);
    setConvStart("09:00");
    setConvEnd("10:00");
  }, [converting]);

  const noteTitleOf = useCallback((n: Note) => (n.title?.trim() || n.content.split("\n")[0].slice(0, 80) || t("notes.title")), [t]);

  const convertToTodo = useCallback(async () => {
    if (!converting) return;
    setConvBusy(true);
    const res = await api.post("/todos", { title: noteTitleOf(converting), category: "personal", priority: "medium", memo: converting.content.slice(0, 1000) || null });
    setConvBusy(false);
    if (res.success) { setConverting(null); showToast("success", t("notes.convertedTodo")); } else showToast("error", res.error || t("notes.convertFailed"));
  }, [converting, noteTitleOf, t]);

  const convertToReminder = useCallback(async () => {
    if (!converting || !convRemindAt) return;
    setConvBusy(true);
    const res = await api.post("/reminders", { title: noteTitleOf(converting), remindAt: new Date(convRemindAt).toISOString(), message: converting.content.slice(0, 500) || null, channel: "web_push" });
    setConvBusy(false);
    if (res.success) { setConverting(null); window.dispatchEvent(new Event("reminders-updated")); showToast("success", t("notes.convertedReminder")); } else showToast("error", res.error || t("notes.convertFailed"));
  }, [converting, convRemindAt, noteTitleOf, t]);

  const convertToEvent = useCallback(async () => {
    if (!converting || !convDate) return;
    setConvBusy(true);
    const res = await api.post("/events", { title: noteTitleOf(converting), startTime: `${convDate}T${convStart}:00`, endTime: `${convDate}T${convEnd}:00`, allDay: false, description: converting.content.slice(0, 500) || undefined });
    setConvBusy(false);
    if (res.success) { setConverting(null); showToast("success", t("notes.convertedEvent")); } else showToast("error", res.error || t("notes.convertFailed"));
  }, [converting, convDate, convStart, convEnd, noteTitleOf, t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = notes.filter((n) => {
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      if (labelFilter && !labelsOf(n).includes(labelFilter)) return false;
      if (q && ![n.title, n.content, n.summary].some((f) => f && f.toLowerCase().includes(q))) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
      if (sortBy === "manual") {
        const ao = a.sortOrder ?? 0;
        const bo = b.sortOrder ?? 0;
        if (ao !== bo) return ao - bo;
        return a.updatedAt < b.updatedAt ? 1 : -1;
      }
      if (sortBy === "title") return (a.title || "").localeCompare(b.title || "");
      const key = sortBy === "created" ? "createdAt" : "updatedAt";
      return a[key] < b[key] ? 1 : a[key] > b[key] ? -1 : 0;
    });
    return list;
  }, [notes, query, typeFilter, sortBy, labelFilter]);

  // Drag-reorder is only meaningful on the full, unfiltered list.
  const reorderEnabled = sortBy === "manual" && !query.trim() && typeFilter === "all" && !labelFilter;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setNotes((prev) => {
      // Reorder within the same pinned group the two items share.
      const activeNote = prev.find((n) => n.id === Number(active.id));
      const ids = prev
        .filter((n) => !n.trashedAt && !n.archivedAt && n.pinned === activeNote?.pinned)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.updatedAt < b.updatedAt ? 1 : -1))
        .map((n) => n.id);
      const oldI = ids.indexOf(Number(active.id));
      const newI = ids.indexOf(Number(over.id));
      if (oldI < 0 || newI < 0) return prev;
      const newIds = arrayMove(ids, oldI, newI);
      const orderMap = new Map(newIds.map((id, idx) => [id, idx]));
      api.post("/notes/reorder", { ids: newIds });
      return prev.map((n) => (orderMap.has(n.id) ? { ...n, sortOrder: orderMap.get(n.id)! } : n));
    });
  }, []);

  /** Rewrite a note's content by transforming its checklist lines. */
  const transformChecklist = useCallback((note: Note, fn: (lines: string[]) => string[]) => {
    const newContent = fn(note.content.split("\n")).join("\n");
    if (newContent === note.content) return;
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, content: newContent } : n)));
    setEditing((cur) => (cur && cur.id === note.id ? { ...cur, content: newContent } : cur));
    api.put<Note>(`/notes/${note.id}`, { content: newContent });
  }, []);

  const uncheckAll = useCallback((note: Note) => {
    transformChecklist(note, (lines) => lines.map((l) => {
      const m = l.match(CHECK_RE);
      return m ? `${m[1]}- [ ] ${m[3]}` : l;
    }));
  }, [transformChecklist]);

  const clearCompleted = useCallback((note: Note) => {
    transformChecklist(note, (lines) => lines.filter((l) => {
      const m = l.match(CHECK_RE);
      return !(m && m[2].toLowerCase() === "x");
    }));
  }, [transformChecklist]);

  /** Union of all labels across active notes (for the filter row). */
  const allLabels = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => labelsOf(n).forEach((l) => set.add(l)));
    return Array.from(set).sort();
  }, [notes]);

  const archiveNote = useCallback(async (note: Note, archive: boolean) => {
    const res = await api.post<Note>(`/notes/${note.id}/archive`, { archived: archive });
    if (res.success && res.data) {
      if (archive) {
        setNotes((prev) => prev.filter((n) => n.id !== note.id));
        setEditing((cur) => (cur?.id === note.id ? null : cur));
        showToast("success", t("notes.archived"));
      } else {
        setArchived((prev) => prev.filter((n) => n.id !== note.id));
        setNotes((prev) => [res.data!, ...prev]);
        showToast("success", t("notes.unarchived"));
      }
    }
  }, [t]);

  const updateLabels = useCallback(async (note: Note, labels: string[]) => {
    const res = await api.put<Note>(`/notes/${note.id}`, { labels });
    if (res.success && res.data) {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? res.data! : n)));
      setEditing((cur) => (cur && cur.id === note.id ? res.data! : cur));
    }
  }, []);

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
      showToast("error", res.status === 503 ? t("ai.unavailable") : t("notes.summaryFailed"));
    }
  }, [t]);

  const transcribeNote = useCallback(async (note: Note) => {
    setTranscribing(true);
    const res = await api.post<Note>(`/notes/${note.id}/transcribe`, {});
    setTranscribing(false);
    if (res.success && res.data) {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? res.data! : n)));
      setEditing((cur) => (cur && cur.id === note.id ? res.data! : cur));
      showToast("success", t("notes.transcribeDone"));
    } else {
      showToast("error", res.status === 503 ? t("ai.unavailable") : t("notes.transcribeFailed"));
    }
  }, [t]);

  const ocrNote = useCallback(async (note: Note) => {
    setTranscribing(true);
    const res = await api.post<Note>(`/notes/${note.id}/ocr`, {});
    setTranscribing(false);
    if (res.success && res.data) {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? res.data! : n)));
      setEditing((cur) => (cur && cur.id === note.id ? res.data! : cur));
      showToast("success", t("notes.ocrDone"));
    } else {
      showToast("error", res.status === 503 ? t("ai.unavailable") : t("notes.ocrFailed"));
    }
  }, [t]);

  const updateColor = useCallback(async (note: Note, color: string | null) => {
    const next = note.color === color ? null : color; // tap same color to clear
    const res = await api.put<Note>(`/notes/${note.id}`, { color: next });
    if (res.success && res.data) {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? res.data! : n)));
      setEditing((cur) => (cur && cur.id === note.id ? res.data! : cur));
    }
  }, []);

  const toggleChecklistItem = useCallback(async (note: Note, lineIndex: number) => {
    const lines = note.content.split("\n");
    const m = lines[lineIndex]?.match(CHECK_RE);
    if (!m) return;
    const checked = m[2].toLowerCase() === "x";
    lines[lineIndex] = `${m[1]}- [${checked ? " " : "x"}] ${m[3]}`;
    const newContent = lines.join("\n");
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, content: newContent } : n))); // optimistic
    const res = await api.put<Note>(`/notes/${note.id}`, { content: newContent });
    if (res.success && res.data) {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? res.data! : n)));
    }
  }, []);

  const uploadMedia = useCallback(async (type: "voice" | "drawing" | "image", blob: Blob, ext: string, title: string) => {
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

  // Set or clear a note's reminder. `value` is a datetime-local string or null.
  const setNoteReminder = useCallback(async (note: Note, value: string | null) => {
    const res = await api.put<Note>(`/notes/${note.id}`, { remindAt: value ? new Date(value).toISOString() : null });
    if (res.success && res.data) {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? res.data! : n)));
      setEditing((cur) => (cur && cur.id === note.id ? res.data! : cur));
      showToast("success", value ? t("notes.reminderSet") : t("notes.reminderCleared"));
    }
  }, [t]);

  // Realtime: a note shared to me appears live in my list.
  useSocketEvent<{ note: Note }>("note:shared", useCallback((data) => {
    if (!data?.note) return;
    setNotes((prev) => (prev.some((n) => n.id === data.note.id) ? prev : [data.note, ...prev]));
    showToast("info", t("notes.sharedIncoming"));
  }, [t]));

  // Realtime: a due note reminder fired.
  useSocketEvent<{ id: number; title: string }>("note:reminder", useCallback((data) => {
    if (!data) return;
    setNotes((prev) => prev.map((n) => (n.id === data.id ? { ...n, remindAt: null } : n)));
    showToast("info", `🔔 ${data.title}`);
  }, []));

  const addNote = async () => {
    if (!content.trim() && !title.trim()) return;
    setSaving(true);
    const res = await api.post<Note>("/notes", { type: "text", title: title.trim() || null, content, color: noteColor });
    setSaving(false);
    if (res.success && res.data) {
      setNotes((prev) => [res.data!, ...prev]);
      setTitle("");
      setContent("");
      setNoteColor(null);
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

  const openArchive = () => {
    setShowArchive(true);
    api.get<Note[]>("/notes/archived").then((res) => {
      if (res.success && res.data) setArchived(res.data);
    });
  };

  // ── Autosave (edit modal) ──
  const savedRef = useRef<{ id: number; title: string | null; content: string } | null>(null);
  const [autoSaved, setAutoSaved] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Seed the last-saved snapshot whenever a different note opens.
  useEffect(() => {
    if (editing) savedRef.current = { id: editing.id, title: editing.title, content: editing.content };
    setAutoSaved(true);
    setExpanded(false);
  }, [editing?.id]);

  // Debounced autosave on title/content edits.
  useEffect(() => {
    if (!editing) return;
    const s = savedRef.current;
    if (s && s.id === editing.id && s.title === editing.title && s.content === editing.content) return;
    setAutoSaved(false);
    const snap = { id: editing.id, title: editing.title, content: editing.content };
    const timer = setTimeout(async () => {
      const res = await api.put<Note>(`/notes/${snap.id}`, { title: snap.title, content: snap.content });
      if (res.success && res.data) {
        savedRef.current = snap;
        setNotes((prev) => prev.map((n) => (n.id === snap.id ? res.data! : n)));
        setAutoSaved(true);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [editing?.id, editing?.title, editing?.content]);

  // Flush any pending edit, then close the modal.
  const closeEditor = useCallback(async () => {
    const e = editing;
    setEditing(null);
    if (!e) return;
    const s = savedRef.current;
    if (s && s.id === e.id && s.title === e.title && s.content === e.content) return; // nothing to flush
    const res = await api.put<Note>(`/notes/${e.id}`, { title: e.title, content: e.content });
    if (res.success && res.data) setNotes((prev) => prev.map((n) => (n.id === e.id ? res.data! : n)));
  }, [editing]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          {showArchive ? (
            <>
              <button onClick={() => setShowArchive(false)} className="p-1 -ml-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title={t("notes.back")}>
                <X className="w-4 h-4" />
              </button>
              <Archive className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-900 dark:text-white">{t("notes.archiveTitle")}</h2>
              <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full tabular-nums">{archived.length}</span>
            </>
          ) : showTrash ? (
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
        {!showTrash && !showArchive && (
          <div className="flex items-center gap-1 text-[10px]">
            {([
              { id: "text", icon: StickyNote, label: t("notes.typeText") },
              { id: "voice", icon: Mic, label: t("notes.typeVoice") },
              { id: "drawing", icon: PenLine, label: t("notes.typeDraw") },
              { id: "image", icon: ImageIcon, label: t("notes.typeImage") },
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
              onClick={openArchive}
              className="flex items-center gap-0.5 px-1.5 py-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 ml-0.5 border-l border-slate-200 dark:border-slate-700 pl-1.5"
              title={t("notes.archiveTitle")}
            >
              <Archive className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={openTrash}
              className="flex items-center gap-0.5 px-1.5 py-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50"
              title={t("notes.trash")}
            >
              <Trash className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      {!showTrash && !showArchive && (
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

      {/* Type filter + sort */}
      {!showTrash && !showArchive && (
        <div className="px-4 pt-2 flex items-center gap-1.5 flex-shrink-0 overflow-x-auto scrollbar-hide">
          {([
            { id: "all", label: t("notes.filterAll") },
            { id: "text", label: t("notes.typeText") },
            { id: "voice", label: t("notes.typeVoice") },
            { id: "drawing", label: t("notes.typeDraw") },
            { id: "image", label: t("notes.typeImage") },
          ] as const).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setTypeFilter(f.id)}
              className={cn(
                "text-[11px] px-2 py-1 rounded-full border whitespace-nowrap transition-colors",
                typeFilter === f.id
                  ? "border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300"
                  : "border-slate-200 dark:border-slate-700 text-slate-500",
              )}
            >
              {f.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {/* Hide-completed checklist toggle */}
            <button
              type="button"
              onClick={() => setHideCompleted((v) => !v)}
              className={cn(
                "p-1 rounded-md transition-colors",
                hideCompleted ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50",
              )}
              title={t("notes.hideCompleted")}
              aria-pressed={hideCompleted}
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
            {/* Grid / list layout toggle */}
            <button
              type="button"
              onClick={() => setViewLayout((v) => (v === "grid" ? "list" : "grid"))}
              className="p-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
              title={viewLayout === "grid" ? t("notes.viewList") : t("notes.viewGrid")}
            >
              {viewLayout === "grid" ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
            </button>
            <div className="flex items-center gap-1 text-slate-400">
              <ArrowDownUp className="w-3.5 h-3.5" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="text-[11px] bg-transparent outline-none text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                <option value="updated">{t("notes.sortUpdated")}</option>
                <option value="created">{t("notes.sortCreated")}</option>
                <option value="title">{t("notes.sortTitle")}</option>
                <option value="manual">{t("notes.sortManual")}</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Label filter chips */}
      {!showTrash && !showArchive && allLabels.length > 0 && (
        <div className="px-4 pt-2 flex items-center gap-1.5 flex-shrink-0 overflow-x-auto scrollbar-hide">
          <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {allLabels.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLabelFilter((cur) => (cur === l ? null : l))}
              className={cn(
                "text-[11px] px-2 py-1 rounded-full border whitespace-nowrap transition-colors",
                labelFilter === l
                  ? "border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300"
                  : "border-slate-200 dark:border-slate-700 text-slate-500",
              )}
            >
              #{l}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {showArchive ? (
          archived.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Archive className="w-10 h-10 mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm">{t("notes.archiveEmpty")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {archived.map((note) => (
                <div key={note.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-800 flex flex-col">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 line-clamp-1">{note.title || t(`notes.type${note.type === "voice" ? "Voice" : note.type === "drawing" ? "Draw" : "Text"}`)}</p>
                  {note.type === "text" && <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap line-clamp-4 flex-1 mt-1">{note.content}</p>}
                  {labelsOf(note).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {labelsOf(note).map((l) => (
                        <span key={l} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">#{l}</span>
                      ))}
                    </div>
                  )}
                  <button onClick={() => archiveNote(note, false)} className="mt-2 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <ArchiveRestore className="w-3.5 h-3.5" /> {t("notes.unarchive")}
                  </button>
                </div>
              ))}
            </div>
          )
        ) : showTrash ? (
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
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNoteColor((cur) => (cur === c ? null : c))}
                      className={cn(
                        "w-5 h-5 rounded-full border-2 transition-transform",
                        noteColor === c ? "border-slate-900 dark:border-white scale-110" : "border-transparent",
                      )}
                      style={{ backgroundColor: c }}
                      aria-label={t("notes.colorLabel")}
                    />
                  ))}
                </div>
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
          {mode === "image" && (
            <label className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:border-blue-400 hover:text-blue-500 cursor-pointer transition-colors">
              <ImageIcon className="w-8 h-8" />
              <span className="text-xs font-medium">{t("notes.imagePick")}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const ext = (file.name.split(".").pop() || "png").toLowerCase();
                  uploadMedia("image", file, ext, file.name.replace(/\.[^.]+$/, ""));
                  e.target.value = "";
                }}
              />
            </label>
          )}
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filtered.map((n) => n.id)} strategy={viewLayout === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
              <div className={viewLayout === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" : "flex flex-col gap-2"}>
                {filtered.map((note) => (
                  <SortableCard key={note.id} id={note.id} disabled={!reorderEnabled}>
                    {({ setNodeRef, style, handleProps, isDragging }) => (
              <div
                ref={setNodeRef}
                className={cn(
                  "group relative rounded-xl border p-3 bg-white dark:bg-slate-800 hover:shadow-md transition-shadow cursor-pointer flex flex-col",
                  note.pinned ? "border-amber-300 dark:border-amber-500/40" : "border-slate-200 dark:border-slate-700",
                  isDragging && "shadow-lg",
                )}
                style={{ ...(note.color ? { borderLeftColor: note.color, borderLeftWidth: "4px" } : {}), ...style }}
                onClick={() => setEditing(note)}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  {reorderEnabled && (
                    <button
                      {...handleProps}
                      onClick={(e) => e.stopPropagation()}
                      className="p-0.5 -ml-1 rounded text-slate-300 dark:text-slate-600 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none shrink-0"
                      title={t("notes.dragReorder")}
                      aria-label={t("notes.dragReorder")}
                    >
                      <GripVertical className="w-4 h-4" />
                    </button>
                  )}
                  {note.title ? (
                    <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1 flex-1">{highlight(note.title, query)}</p>
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
                      onClick={() => archiveNote(note, true)}
                      className="p-1 rounded text-slate-300 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity"
                      title={t("notes.archive")}
                    >
                      <Archive className="w-3.5 h-3.5" />
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
                  <NoteContent
                    content={note.content}
                    query={query}
                    hideCompleted={hideCompleted}
                    onToggle={(i) => toggleChecklistItem(note, i)}
                    className="text-xs text-slate-600 dark:text-slate-300 flex-1"
                  />
                ) : (
                  <div className="flex-1" onClick={note.type === "voice" ? (e) => e.stopPropagation() : undefined}>
                    <NoteMedia noteId={note.id} type={note.type} />
                  </div>
                )}
                {note.summary && (
                  <p className="text-[10px] text-blue-600 dark:text-blue-300 bg-blue-50/60 dark:bg-blue-900/20 rounded-md px-2 py-1 mt-2 line-clamp-3 flex items-start gap-1">
                    <Sparkles className="w-3 h-3 shrink-0 mt-0.5" />
                    <span className="min-w-0">{highlight(note.summary, query)}</span>
                  </p>
                )}
                {labelsOf(note).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                    {labelsOf(note).map((l) => (
                      <button key={l} onClick={() => setLabelFilter(l)} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600">#{l}</button>
                    ))}
                  </div>
                )}
                {note.remindAt && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 mt-2 self-start text-[10px] px-1.5 py-0.5 rounded-full",
                      new Date(note.remindAt) <= new Date()
                        ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                        : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
                    )}
                  >
                    <Bell className="w-2.5 h-2.5" /> {fmtDateTime(note.remindAt)}
                  </span>
                )}
                <p className="text-[10px] text-slate-400 mt-2 tabular-nums flex items-center gap-1">
                  {note.type === "voice" && <Mic className="w-3 h-3" />}
                  {note.type === "drawing" && <PenLine className="w-3 h-3" />}
                  {note.type === "image" && <ImageIcon className="w-3 h-3" />}
                  {fmtDateTime(note.updatedAt)}
                </p>
              </div>
                    )}
                  </SortableCard>
                ))}
              </div>
            </SortableContext>
          </DndContext>
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
          onClick={closeEditor}
        >
          <div
            className={cn(
              "w-full bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl flex flex-col max-h-[90dvh] pb-[calc(var(--mobile-nav-h,56px)+env(safe-area-inset-bottom,0px))] sm:pb-0",
              expanded ? "sm:max-w-3xl sm:h-[85vh]" : "sm:max-w-md",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                {t("notes.edit")}
                <span className="text-[10px] font-normal text-slate-400">{autoSaved ? t("notes.autoSaved") : t("notes.saving")}</span>
              </h3>
              <div className="flex items-center gap-0.5">
                <button onClick={() => setExpanded((v) => !v)} className="hidden sm:inline-flex p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" title={t("notes.fullscreen")}>
                  {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button onClick={closeEditor} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto">
              <input
                value={editing.title ?? ""}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder={t("notes.titlePlaceholder")}
                className="w-full text-sm font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-1.5 px-1">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateColor(editing, c)}
                    className={cn(
                      "w-5 h-5 rounded-full border-2 transition-transform",
                      editing.color === c ? "border-slate-900 dark:border-white scale-110" : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={t("notes.colorLabel")}
                  />
                ))}
                {editing.color && (
                  <button type="button" onClick={() => updateColor(editing, null)} className="text-[10px] text-slate-400 hover:text-slate-600 ml-1">
                    {t("notes.colorClear")}
                  </button>
                )}
              </div>
              {/* Label editor */}
              <div className="flex flex-wrap items-center gap-1.5 px-1">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                {labelsOf(editing).map((l) => (
                  <span key={l} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    #{l}
                    <button type="button" onClick={() => updateLabels(editing, labelsOf(editing).filter((x) => x !== l))} className="text-slate-400 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const v = labelDraft.trim();
                      if (v && !labelsOf(editing).includes(v)) updateLabels(editing, [...labelsOf(editing), v]);
                      setLabelDraft("");
                    }
                  }}
                  placeholder={t("notes.addLabel")}
                  className="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-slate-300 dark:border-slate-600 bg-transparent text-slate-600 dark:text-slate-300 outline-none focus:border-blue-400 w-24"
                />
              </div>
              {/* Reminder */}
              <div className="flex flex-wrap items-center gap-2 px-1">
                <Bell className={cn("w-3.5 h-3.5", editing.remindAt ? "text-amber-500" : "text-slate-400")} />
                <input
                  type="datetime-local"
                  value={editing.remindAt ? toLocalInput(editing.remindAt) : ""}
                  onChange={(e) => setNoteReminder(editing, e.target.value || null)}
                  className="text-[11px] px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                {editing.remindAt && (
                  <button type="button" onClick={() => setNoteReminder(editing, null)} className="text-[10px] text-slate-400 hover:text-red-500">
                    {t("notes.reminderClear")}
                  </button>
                )}
              </div>
              {editing.type === "text" ? (
                <>
                  {hasChecklist(editing.content) && (
                    <div className="flex items-center gap-2 px-1 text-[11px]">
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-slate-400">{t("notes.checklist")}</span>
                      <button
                        type="button"
                        onClick={() => uncheckAll(editing)}
                        className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      >
                        <RotateCcw className="w-3 h-3" /> {t("notes.uncheckAll")}
                      </button>
                      <button
                        type="button"
                        onClick={() => clearCompleted(editing)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      >
                        <Eraser className="w-3 h-3" /> {t("notes.clearCompleted")}
                      </button>
                    </div>
                  )}
                  <AutoGrowTextarea
                    value={editing.content}
                    onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                    minRows={expanded ? 16 : 8}
                    maxHeight={expanded ? 2000 : 480}
                    placeholder={t("notes.contentPlaceholder")}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </>
              ) : (
                <div onClick={(e) => e.stopPropagation()} className="space-y-2">
                  <NoteMedia noteId={editing.id} type={editing.type} />
                  {editing.type === "voice" && (
                    <div className="rounded-xl border border-purple-100 dark:border-purple-900/40 bg-purple-50/40 dark:bg-purple-900/10 p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-purple-700 dark:text-purple-300 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" /> {t("notes.transcript")}
                        </span>
                        <button
                          onClick={() => transcribeNote(editing)}
                          disabled={transcribing}
                          className="text-[11px] px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white"
                        >
                          {transcribing ? t("notes.transcribing") : editing.content.trim() ? t("notes.retranscribe") : t("notes.transcribe")}
                        </button>
                      </div>
                      {editing.content.trim() ? (
                        <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{editing.content}</p>
                      ) : (
                        <p className="text-[11px] text-slate-400">{t("notes.transcribeEmpty")}</p>
                      )}
                    </div>
                  )}
                  {editing.type === "image" && (
                    <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-900/10 p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                          <ScanText className="w-3.5 h-3.5" /> {t("notes.ocrTitle")}
                        </span>
                        <button
                          onClick={() => ocrNote(editing)}
                          disabled={transcribing}
                          className="text-[11px] px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white"
                        >
                          {transcribing ? t("notes.ocrRunning") : editing.content.trim() ? t("notes.ocrAgain") : t("notes.ocrRun")}
                        </button>
                      </div>
                      {editing.content.trim() ? (
                        <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{editing.content}</p>
                      ) : (
                        <p className="text-[11px] text-slate-400">{t("notes.ocrEmpty")}</p>
                      )}
                    </div>
                  )}
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
              <button onClick={() => setConverting(editing)} className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm flex items-center gap-1">
                <ArrowRightLeft className="w-4 h-4" /> {t("notes.convert")}
              </button>
              <button onClick={() => setForwarding(editing)} className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm flex items-center gap-1">
                <Send className="w-4 h-4" /> {t("notes.forward")}
              </button>
              <button onClick={() => requestDelete(editing.id, false)} className="px-3 py-2.5 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 text-sm flex items-center gap-1">
                <Trash2 className="w-4 h-4" /> {t("common.delete")}
              </button>
              <button onClick={closeEditor} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium">
                {t("notes.done")}
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

      {/* Convert modal — turn a note into a todo / reminder / event */}
      {converting && (
        <div
          className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center sm:p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={() => !convBusy && setConverting(null)}
        >
          <div
            className="w-full sm:max-w-sm bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl flex flex-col max-h-[85dvh] pb-[calc(var(--mobile-nav-h,56px)+env(safe-area-inset-bottom,0px))] sm:pb-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4 text-blue-500" /> {t("notes.convertTitle")}
              </h3>
              <button onClick={() => setConverting(null)} disabled={convBusy} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-50">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{noteTitleOf(converting)}</p>

              {/* Todo */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{t("notes.convertTodo")}</span>
                </div>
                <button onClick={convertToTodo} disabled={convBusy} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white shrink-0">
                  {t("notes.convertDo")}
                </button>
              </div>

              {/* Reminder */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-slate-200">{t("notes.convertReminder")}</span>
                </div>
                <input
                  type="datetime-local"
                  value={convRemindAt}
                  onChange={(e) => setConvRemindAt(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={convertToReminder} disabled={convBusy || !convRemindAt} className="w-full text-xs px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
                  {t("notes.convertDo")}
                </button>
              </div>

              {/* Event */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <CalendarPlus className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-slate-200">{t("notes.convertEvent")}</span>
                </div>
                <input
                  type="date"
                  value={convDate}
                  onChange={(e) => setConvDate(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={convStart}
                    onChange={(e) => setConvStart(e.target.value)}
                    className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-slate-400 text-sm">–</span>
                  <input
                    type="time"
                    value={convEnd}
                    onChange={(e) => setConvEnd(e.target.value)}
                    className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button onClick={convertToEvent} disabled={convBusy || !convDate} className="w-full text-xs px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white">
                  {t("notes.convertDo")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
