import React, { useEffect, useState, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useProjectTaskStore, type ProjectTask, type TaskStatus } from "@/stores/projectTaskStore";
import { useProjectStore } from "@/stores/projectStore";
import type { ProjectMember } from "@/stores/projectStore";

interface GanttViewProps {
  projectId: number;
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "#94a3b8",
  todo: "#3b82f6",
  in_progress: "#f59e0b",
  review: "#8b5cf6",
  done: "#22c55e",
};

const daysBetween = (a: Date, b: Date) =>
  Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}

function formatDate(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatMonthLabel(d: Date) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function GanttView({ projectId }: GanttViewProps) {
  const { tasks, fetchTasks } = useProjectTaskStore();
  const { fetchMembers } = useProjectStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [memberMap, setMemberMap] = useState<Map<number, ProjectMember>>(new Map());

  const dayWidth = 40;
  const rowHeight = 36;
  const headerHeight = 48;
  const labelWidth = 200;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const rangeStart = useMemo(() => startOfMonth(today), [today]);
  const rangeEnd = useMemo(() => endOfMonth(addMonths(today, 1)), [today]);
  const totalDays = useMemo(() => daysBetween(rangeStart, rangeEnd), [rangeStart, rangeEnd]);

  useEffect(() => {
    fetchTasks(projectId);
    fetchMembers(projectId).then((m) => {
      if (m) {
        const map = new Map<number, ProjectMember>();
        m.forEach((member) => map.set(member.userId, member));
        setMemberMap(map);
      }
    });
  }, [projectId]);

  // Listen for real-time task updates
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.projectId === projectId) fetchTasks(projectId);
    };
    window.addEventListener("project-tasks-updated", handler);
    return () => window.removeEventListener("project-tasks-updated", handler);
  }, [projectId, fetchTasks]);

  // Scroll to today on mount
  useEffect(() => {
    if (scrollRef.current) {
      const todayOffset = daysBetween(rangeStart, today) * dayWidth;
      scrollRef.current.scrollLeft = Math.max(0, todayOffset - 200);
    }
  }, [rangeStart, today]);

  // Generate date columns
  const dateColumns = useMemo(() => {
    const cols: { date: Date; label: string; isToday: boolean; monthStart: boolean; monthLabel: string }[] = [];
    for (let i = 0; i <= totalDays; i++) {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      cols.push({
        date: d,
        label: formatDate(d),
        isToday: d.getTime() === today.getTime(),
        monthStart: d.getDate() === 1,
        monthLabel: formatMonthLabel(d),
      });
    }
    return cols;
  }, [rangeStart, totalDays, today]);

  const getBarStyle = (task: ProjectTask) => {
    const taskStart = task.startDate ? new Date(task.startDate) : null;
    const taskEnd = task.dueDate ? new Date(task.dueDate) : null;

    if (!taskStart && !taskEnd) {
      // No dates - dot on today
      const offset = daysBetween(rangeStart, today);
      return {
        left: offset * dayWidth + dayWidth / 2 - 4,
        width: 8,
        isDot: true,
      };
    }

    const start = taskStart || taskEnd!;
    const end = taskEnd || taskStart!;
    const startOffset = daysBetween(rangeStart, start);
    const duration = Math.max(1, daysBetween(start, end) + 1);

    return {
      left: startOffset * dayWidth,
      width: duration * dayWidth,
      isDot: false,
    };
  };

  const getMemberInitial = (userId: number | null) => {
    if (!userId) return null;
    const member = memberMap.get(userId);
    if (!member) return null;
    const name = member.displayName || member.username || "?";
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Legend */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-200/60 dark:border-slate-700/40 flex-shrink-0">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Status:</span>
        {(Object.entries(STATUS_COLORS) as [TaskStatus, string][]).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
              {status.replace("_", " ")}
            </span>
          </span>
        ))}
      </div>

      {/* Chart */}
      <div className="flex-1 overflow-hidden flex">
        {/* Task labels (fixed left column) */}
        <div
          className="flex-shrink-0 border-r border-slate-200/60 dark:border-slate-700/40 overflow-hidden"
          style={{ width: labelWidth }}
        >
          {/* Header spacer */}
          <div
            className="border-b border-slate-200/60 dark:border-slate-700/40 px-3 flex items-center"
            style={{ height: headerHeight }}
          >
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Task</span>
          </div>
          {/* Task rows */}
          <div className="overflow-y-auto" style={{ maxHeight: `calc(100% - ${headerHeight}px)` }}>
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-1.5 px-3 border-b border-slate-100 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                style={{ height: rowHeight }}
              >
                {/* Assignee avatar */}
                {task.assigneeId ? (
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[task.status] }}
                  >
                    {getMemberInitial(task.assigneeId)}
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
                )}
                <span
                  className="text-[11px] text-slate-700 dark:text-slate-300 truncate cursor-pointer hover:text-blue-500"
                  title={task.title}
                >
                  {task.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline area (scrollable) */}
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <div style={{ width: (totalDays + 1) * dayWidth, minHeight: "100%" }}>
            {/* Date header */}
            <div
              className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200/60 dark:border-slate-700/40 flex"
              style={{ height: headerHeight }}
            >
              {dateColumns.map((col, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-shrink-0 flex flex-col items-center justify-center border-r border-slate-100 dark:border-slate-800/40",
                    col.isToday && "bg-red-50 dark:bg-red-500/5",
                    col.date.getDay() === 0 && "bg-slate-50/50 dark:bg-slate-800/20",
                    col.date.getDay() === 6 && "bg-slate-50/50 dark:bg-slate-800/20"
                  )}
                  style={{ width: dayWidth }}
                >
                  {col.monthStart && (
                    <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">
                      {col.monthLabel}
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-[9px]",
                      col.isToday
                        ? "font-bold text-red-500"
                        : "text-slate-400 dark:text-slate-500"
                    )}
                  >
                    {col.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Task bars */}
            <div className="relative">
              {/* Grid lines */}
              {dateColumns.map((col, i) => (
                <div
                  key={i}
                  className={cn(
                    "absolute top-0 bottom-0 border-r border-slate-100 dark:border-slate-800/30",
                    col.date.getDay() === 0 && "bg-slate-50/30 dark:bg-slate-800/10",
                    col.date.getDay() === 6 && "bg-slate-50/30 dark:bg-slate-800/10"
                  )}
                  style={{
                    left: i * dayWidth,
                    width: dayWidth,
                    height: tasks.length * rowHeight,
                  }}
                />
              ))}

              {/* Today marker */}
              {(() => {
                const todayOffset = daysBetween(rangeStart, today);
                if (todayOffset >= 0 && todayOffset <= totalDays) {
                  return (
                    <div
                      className="absolute top-0 z-20 pointer-events-none"
                      style={{
                        left: todayOffset * dayWidth + dayWidth / 2,
                        height: tasks.length * rowHeight,
                        width: 2,
                        backgroundColor: "#ef4444",
                      }}
                    />
                  );
                }
                return null;
              })()}

              {/* Bars */}
              {tasks.map((task, idx) => {
                const bar = getBarStyle(task);
                const color = STATUS_COLORS[task.status];

                return (
                  <div
                    key={task.id}
                    className="absolute flex items-center"
                    style={{
                      top: idx * rowHeight,
                      height: rowHeight,
                      left: 0,
                      right: 0,
                    }}
                  >
                    {bar.isDot ? (
                      <div
                        className="absolute rounded-full"
                        style={{
                          left: bar.left,
                          width: bar.width,
                          height: 8,
                          backgroundColor: color,
                          top: (rowHeight - 8) / 2,
                        }}
                        title={`${task.title} (no dates)`}
                      />
                    ) : (
                      <div
                        className="absolute rounded-sm cursor-pointer hover:opacity-80 transition-opacity flex items-center px-1.5 overflow-hidden"
                        style={{
                          left: bar.left,
                          width: bar.width,
                          height: 20,
                          backgroundColor: color,
                          top: (rowHeight - 20) / 2,
                          opacity: 0.85,
                        }}
                        title={`${task.title}\n${task.startDate || "?"} ~ ${task.dueDate || "?"}`}
                      >
                        {bar.width > 60 && (
                          <span className="text-[9px] text-white font-medium truncate">
                            {task.title}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {tasks.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-400">No tasks to display</p>
        </div>
      )}
    </div>
  );
}
