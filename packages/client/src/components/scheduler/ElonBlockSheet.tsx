import { useEffect, useState } from "react";
import { X, Trash2, Copy, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";
import {
  CATEGORY_CONFIG,
  type TimeBlockCategory,
} from "@/stores/timeblockStore";
import type { TimeBlockMeta } from "./elonStorage";
import { stringifyBlockMeta, compactMeta, uid, parseTimeToMinutes, minutesToTime, snapToStep } from "./elonStorage";

export type BlockSheetInitial = {
  blockId?: number;
  title: string;
  notes: string;
  startTime: string;
  endTime: string;
  category: TimeBlockCategory;
  color: string;
  showArrow: boolean;
  variant: NonNullable<TimeBlockMeta["variant"]>;
  brainId?: string | null;
  prioritySlot?: 1 | 2 | 3 | null;
  caption?: string;
  linkToBlockId?: number | null;
};

type Props = {
  open: boolean;
  mode: "add" | "edit";
  initial: Partial<BlockSheetInitial>;
  /** Parsed existing meta; merged on save so timeline-only edits are kept. */
  metaBase?: TimeBlockMeta;
  /** Other blocks this day (for link target). Excludes current block when editing. */
  otherBlocks?: { id: number; title: string }[];
  /** Preserved on save into meta (add-from-brain). Undefined = keep metaBase. */
  linkBrainId?: string | null;
  /** Undefined = keep metaBase.prioritySlot. */
  linkPrioritySlot?: 1 | 2 | 3 | null;
  onClose: () => void;
  onSave: (payload: {
    blockId?: number;
    title: string;
    notes: string | null;
    startTime: string;
    endTime: string;
    category: TimeBlockCategory;
    color: string | null;
    meta: string | null;
  }) => void;
  onDelete?: (blockId: number) => void;
  onDuplicate?: () => void;
};

const VARIANTS: NonNullable<TimeBlockMeta["variant"]>[] = ["solid", "stripes", "outline"];

export default function ElonBlockSheet({
  open,
  mode,
  initial,
  metaBase = {},
  otherBlocks = [],
  linkBrainId,
  linkPrioritySlot,
  onClose,
  onSave,
  onDelete,
  onDuplicate,
}: Props) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:30");
  const [category, setCategory] = useState<TimeBlockCategory>("deep_work");
  const [color, setColor] = useState<string | null>(null);
  const [showArrow, setShowArrow] = useState(false);
  const [variant, setVariant] = useState<NonNullable<TimeBlockMeta["variant"]>>("solid");
  const [caption, setCaption] = useState("");
  const [linkBlockId, setLinkBlockId] = useState<string>("");
  const [annotationRows, setAnnotationRows] = useState<Array<{ id: string; atTime: string; text: string }>>([]);

  useEffect(() => {
    if (!open) return;
    setTitle(initial.title ?? "");
    setNotes(initial.notes ?? "");
    setStartTime(initial.startTime ?? "09:00");
    setEndTime(initial.endTime ?? "09:30");
    setCategory(initial.category ?? "deep_work");
    setColor(initial.color ?? CATEGORY_CONFIG[initial.category ?? "deep_work"]?.color ?? null);
    setShowArrow(initial.showArrow ?? metaBase.showArrow ?? false);
    setVariant(initial.variant ?? metaBase.variant ?? "solid");
    setCaption(initial.caption ?? metaBase.caption ?? "");
    const lid = initial.linkToBlockId ?? metaBase.linkToBlockId;
    setLinkBlockId(lid != null && lid > 0 ? String(lid) : "");
    const ann = metaBase.annotations;
    setAnnotationRows(
      ann?.length
        ? ann.map((a) => ({
            id: a.id || uid(),
            atTime: minutesToTime(Math.min(24 * 60, Math.max(0, a.atMinute))),
            text: a.text || "",
          }))
        : [],
    );
  }, [open, initial, metaBase]);

  if (!open) return null;

  const cat = CATEGORY_CONFIG[category];
  const effectiveColor = color || cat.color;

  const handleSave = () => {
    if (!title.trim()) return;
    const lid = parseInt(linkBlockId, 10);
    const merged: TimeBlockMeta = { ...metaBase, showArrow, variant };
    const cap = caption.trim();
    if (cap) merged.caption = cap;
    else delete merged.caption;
    if (!Number.isNaN(lid) && lid > 0) merged.linkToBlockId = lid;
    else delete merged.linkToBlockId;
    if (linkBrainId != null && linkBrainId !== "") merged.brainId = linkBrainId;
    else if (!metaBase.brainId) delete merged.brainId;
    if (linkPrioritySlot != null) merged.prioritySlot = linkPrioritySlot;
    else if (metaBase.prioritySlot) merged.prioritySlot = metaBase.prioritySlot;
    else delete merged.prioritySlot;

    const annSaved = annotationRows
      .filter((r) => r.text.trim())
      .map((r) => ({
        id: r.id,
        text: r.text.trim(),
        atMinute: snapToStep(parseTimeToMinutes(r.atTime), 5),
      }));
    if (annSaved.length) merged.annotations = annSaved;
    else delete merged.annotations;

    const metaObj = compactMeta(merged);
    onSave({
      blockId: initial.blockId,
      title: title.trim(),
      notes: notes.trim() || null,
      startTime,
      endTime,
      category,
      color: effectiveColor,
      meta: stringifyBlockMeta(metaObj),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-[90dvh] overflow-y-auto",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {mode === "add" ? t("elon.blockAdd") : t("elon.blockEdit")}
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">{t("elon.blockTitle")}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">{t("elon.blockNotes")}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t("elon.blockNotesPh")}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">{t("elon.start")}</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full text-sm px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">{t("elon.end")}</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full text-sm px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">{t("elon.category")}</label>
            <select
              value={category}
              onChange={(e) => {
                const c = e.target.value as TimeBlockCategory;
                setCategory(c);
                setColor(CATEGORY_CONFIG[c].color);
              }}
              className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800"
            >
              {(Object.keys(CATEGORY_CONFIG) as TimeBlockCategory[]).map((k) => (
                <option key={k} value={k}>
                  {CATEGORY_CONFIG[k].icon} {CATEGORY_CONFIG[k].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">{t("elon.blockStyle")}</label>
            <div className="flex flex-wrap gap-2">
              {VARIANTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVariant(v)}
                  className={cn(
                    "text-[10px] px-2 py-1 rounded-lg border",
                    variant === v
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200"
                      : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300",
                  )}
                >
                  {t(`elon.variant.${v}`)}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" checked={showArrow} onChange={(e) => setShowArrow(e.target.checked)} className="rounded border-slate-300" />
            {t("elon.showArrow")}
          </label>
          <div>
            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">{t("elon.caption")}</label>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t("elon.captionPh")}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{t("elon.annotations")}</label>
              <button
                type="button"
                onClick={() => {
                  const s = parseTimeToMinutes(startTime);
                  const e = parseTimeToMinutes(endTime);
                  const mid = snapToStep(Math.floor((s + e) / 2), 5);
                  setAnnotationRows((prev) => [...prev, { id: uid(), atTime: minutesToTime(mid), text: "" }]);
                }}
                className="text-[10px] flex items-center gap-0.5 text-blue-600 dark:text-blue-400"
              >
                <Plus className="w-3 h-3" />
                {t("elon.annotationAdd")}
              </button>
            </div>
            <div className="space-y-2">
              {annotationRows.length === 0 && (
                <p className="text-[9px] text-slate-400">{t("elon.annotationsEmpty")}</p>
              )}
              {annotationRows.map((row, idx) => (
                <div key={row.id} className="flex flex-col gap-1 rounded-lg border border-slate-100 dark:border-slate-700/80 p-2">
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={row.atTime}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAnnotationRows((p) => p.map((r, i) => (i === idx ? { ...r, atTime: v } : r)));
                      }}
                      className="w-[108px] text-[11px] px-1.5 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setAnnotationRows((p) => p.filter((_, i) => i !== idx))}
                      className="text-[10px] text-red-500 px-2"
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                  <input
                    value={row.text}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAnnotationRows((p) => p.map((r, i) => (i === idx ? { ...r, text: v } : r)));
                    }}
                    placeholder={t("elon.annotationTextPh")}
                    className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              ))}
            </div>
          </div>
          {otherBlocks.length > 0 && (
            <div>
              <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">{t("elon.linkToBlock")}</label>
              <select
                value={linkBlockId}
                onChange={(e) => setLinkBlockId(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800"
              >
                <option value="">{t("elon.linkNone")}</option>
                {otherBlocks.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    #{b.id} · {b.title.slice(0, 48)}{b.title.length > 48 ? "…" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-wrap gap-2 p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          {mode === "edit" && initial.blockId != null && onDuplicate && (
            <button
              type="button"
              onClick={() => {
                onDuplicate();
                onClose();
              }}
              className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm"
            >
              <Copy className="w-4 h-4" />
              {t("elon.duplicate")}
            </button>
          )}
          {mode === "edit" && initial.blockId != null && onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(initial.blockId!);
                onClose();
              }}
              className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 text-sm"
            >
              <Trash2 className="w-4 h-4" />
              {t("common.delete")}
            </button>
          )}
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300">
            {t("common.cancel")}
          </button>
          <button type="button" onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium">
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
