import React, { useState, useRef } from "react";
import { GripVertical, CalendarDays, Clock, Pencil, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuthStore } from "@/stores/authStore";
import type { ProjectTask } from "@/stores/projectTaskStore";
import type { ProjectMember } from "@/stores/projectStore";

const priorityColor = (p: string) =>
  p === "high" ? "#ef4444" : p === "medium" ? "#f59e0b" : "#94a3b8";

/** Format datetime as MM-DD HH:mm:ss in KST */
function fmtDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mi = String(kst.getUTCMinutes()).padStart(2, "0");
  const ss = String(kst.getUTCSeconds()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${mi}:${ss}`;
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgent", high: "High", medium: "Medium", low: "Low",
};

interface KanbanCardProps {
  task: ProjectTask;
  members: ProjectMember[];
  onClick: () => void;
  readOnly?: boolean;
}

const KanbanCard = React.memo(function KanbanCard({
  task,
  members,
  onClick,
  readOnly,
}: KanbanCardProps) {
  const currentUserId = useAuthStore(s => s.user?.id);
  const isMyTask = task.assigneeId === currentUserId;
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout>>();
  const cardRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task, status: task.status },
    disabled: readOnly,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : undefined,
    position: "relative",
    opacity: isDragging ? 0.85 : undefined,
  };

  const assignee = task.assigneeId
    ? members.find((m) => m.userId === task.assigneeId)
    : null;

  const isOverdue =
    task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";

  const handleMouseEnter = () => {
    tooltipTimer.current = setTimeout(() => setShowTooltip(true), 400);
  };
  const handleMouseLeave = () => {
    clearTimeout(tooltipTimer.current);
    setShowTooltip(false);
  };
  const handleTouchStart = () => {
    tooltipTimer.current = setTimeout(() => setShowTooltip(true), 500);
  };
  const handleTouchEnd = () => {
    clearTimeout(tooltipTimer.current);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  return (
    <div
      ref={(node) => { setNodeRef(node); (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = node; }}
      style={style}
      {...attributes}
      {...(readOnly ? {} : listeners)}
      className={cn(
        "group bg-white dark:bg-slate-800 rounded-lg border p-2.5 touch-none hover:shadow-sm transition-colors",
        readOnly ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
        isDragging
          ? "border-blue-400 dark:border-blue-500 shadow-xl"
          : isMyTask
          ? "border-l-[3px] border-l-blue-500 border-t-slate-200 border-r-slate-200 border-b-slate-200 dark:border-l-blue-400 dark:border-t-slate-700 dark:border-r-slate-700 dark:border-b-slate-700 hover:border-l-blue-600"
          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600",
      )}
      onClick={isDragging ? undefined : onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-start gap-1">
        {!readOnly && (
          <GripVertical className="w-3 h-3 text-slate-300 dark:text-slate-600 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}

        <div className="flex-1 min-w-0">
          {/* Row 1: Title + Edit button */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: priorityColor(task.priority) }}
            />
            <span className="text-[13px] text-slate-900 dark:text-white font-medium truncate flex-1">
              {task.title}
            </span>
            <button
              onClick={handleEditClick}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-opacity flex-shrink-0"
              title="Edit"
            >
              <Pencil className="w-3 h-3 text-slate-400 hover:text-blue-500" />
            </button>
          </div>

          {/* Row 2: Due date + Tags + Reactions */}
          <div className="flex items-center gap-1.5 mt-1.5">
            {task.dueDate && (
              <span
                className={cn(
                  "text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-md",
                  isOverdue
                    ? "bg-red-50 dark:bg-red-500/10 text-red-500"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
                )}
              >
                <CalendarDays className="w-2.5 h-2.5" />
                {task.dueDate.slice(5)}
              </span>
            )}

            {task.tags &&
              task.tags.split(",").filter(Boolean).slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 truncate max-w-[60px]"
                >
                  {tag.trim()}
                </span>
              ))}

            <div className="flex-1" />

            {task.reactions && Object.keys(task.reactions).length > 0 && (
              <span className="flex items-center gap-0.5 text-[10px]">
                {Object.entries(task.reactions).slice(0, 3).map(([emoji, count]) => (
                  <span key={emoji} title={`${emoji} ${count}`}>{emoji}{(count as number) > 1 ? count : ""}</span>
                ))}
              </span>
            )}
          </div>

          {/* Row 3: Updated time + Assignee */}
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5 tabular-nums">
              <Clock className="w-2.5 h-2.5" />
              {fmtDateTime(task.updatedAt)}
            </span>

            <div className="flex-1" />

            {assignee && (
              <span className={cn(
                "text-[10px] font-medium truncate max-w-[80px] flex items-center gap-0.5",
                isMyTask ? "text-blue-600 dark:text-blue-400" : "text-indigo-500 dark:text-indigo-400"
              )}>
                {isMyTask ? "\u2713" : <User className="w-2.5 h-2.5" />}
                {assignee.displayName || assignee.username || "?"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Hover tooltip with details */}
      {showTooltip && !isDragging && (
        <div
          className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl p-3 space-y-1.5 pointer-events-none"
          style={{ minWidth: 200 }}
        >
          <p className="text-[13px] font-semibold text-slate-900 dark:text-white">{task.title}</p>
          {task.description && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-pre-wrap line-clamp-4">
              {task.description}
            </p>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700">
            <span>Priority: <strong className="text-slate-700 dark:text-slate-300">{PRIORITY_LABEL[task.priority] || task.priority}</strong></span>
            {task.dueDate && <span>Due: <strong className="text-slate-700 dark:text-slate-300">{task.dueDate}</strong></span>}
            {task.startDate && <span>Start: <strong className="text-slate-700 dark:text-slate-300">{task.startDate}</strong></span>}
            {assignee && <span>Assignee: <strong className="text-slate-700 dark:text-slate-300">{assignee.displayName || assignee.username}</strong></span>}
            <span>Updated: <strong className="text-slate-700 dark:text-slate-300">{fmtDateTime(task.updatedAt)}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
});

export default KanbanCard;
