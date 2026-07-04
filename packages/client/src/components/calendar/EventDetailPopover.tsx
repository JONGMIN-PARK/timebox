import { memo } from "react";
import { format, parseISO, isValid } from "date-fns";
import { X, Pencil, Trash2, Send, Repeat, Tag, AlignLeft, Clock } from "lucide-react";
import { useI18n } from "@/lib/useI18n";
import { eventTimeLabel } from "@/lib/eventFormat";
import type { CalendarEvent } from "./calendarTypes";

// Google-Calendar-style detail popover shown when an event is clicked.
// Presented as a centered modal (mobile-friendly) with quick actions.
const EventDetailPopover = memo(function EventDetailPopover({
  event,
  categoryName,
  projectName,
  onClose,
  onEdit,
  onDelete,
  onForward,
}: {
  event: CalendarEvent;
  categoryName?: string;
  projectName?: string;
  onClose: () => void;
  onEdit: (ev: CalendarEvent) => void;
  onDelete: (id: number) => void;
  onForward: (id: number) => void;
}) {
  const { t } = useI18n();
  const color = event.color || "#3b82f6";
  const start = parseISO(event.startTime);
  const dateLabel = isValid(start) ? format(start, "yyyy. M. d (EEE)") : "";
  const timeLabel = eventTimeLabel(event, t("calendar.allDay"));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm sm:mx-4 bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-xl shadow-xl overflow-hidden pb-[env(safe-area-inset-bottom,0px)] sm:pb-0"
      >
        {/* Accent bar + title */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <span className="mt-1.5 w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden />
          <h3 className="flex-1 min-w-0 font-semibold text-slate-900 dark:text-white break-words">
            {event.title}
          </h3>
          <button onClick={onClose} className="p-1 -mr-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" aria-label={t("common.close") || "Close"}>
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-5 pb-3 space-y-2.5 text-sm">
          <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{dateLabel}{timeLabel ? ` · ${timeLabel}` : ""}</span>
          </div>
          {event.recurrenceRule && (
            <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
              <Repeat className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{t("calendar.recurring") || "반복"}</span>
            </div>
          )}
          {categoryName && (
            <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
              <Tag className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{categoryName}</span>
            </div>
          )}
          {projectName && (
            <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
              <span className="w-4 h-4 shrink-0 text-center text-slate-400">#</span>
              <span>{projectName}</span>
            </div>
          )}
          {event.description && (
            <div className="flex items-start gap-2.5 text-slate-600 dark:text-slate-300">
              <AlignLeft className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap break-words">{event.description}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-700/50">
          <button
            onClick={() => { onEdit(event); onClose(); }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
          >
            <Pencil className="w-4 h-4" /> {t("common.edit") || "수정"}
          </button>
          <button
            onClick={() => { onForward(event.id); onClose(); }}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm"
            aria-label={t("calendar.forward") || "전달"}
          >
            <Send className="w-4 h-4" />
          </button>
          <button
            onClick={() => { onDelete(event.id); onClose(); }}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-sm"
            aria-label={t("common.delete") || "삭제"}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

export default EventDetailPopover;
