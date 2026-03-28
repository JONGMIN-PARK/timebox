import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/useI18n";
import { useProjectStore } from "@/stores/projectStore";
import { cn } from "@/lib/utils";
import { BarChart3, Users, AlertTriangle, CheckCircle2, Clock, Target, Archive, ArchiveRestore } from "lucide-react";

interface ProjectSummaryItem {
  id: number;
  name: string;
  color: string;
  startDate: string | null;
  targetDate: string | null;
  dDay: number | null;
  total: number;
  completed: number;
  inProgress: number;
  myTasks: number;
  overdue: number;
  progress: number;
  memberCount: number;
  archived?: boolean;
}

export default function ProjectSummary() {
  const { t } = useI18n();
  const { setActiveProject } = useProjectStore();
  const [projects, setProjects] = useState<ProjectSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  const fetchSummary = (includeArchived = false) => {
    const query = includeArchived ? "?includeArchived=true" : "";
    api.get<ProjectSummaryItem[]>(`/projects/summary${query}`).then(res => {
      if (res.success && res.data) setProjects(res.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchSummary(showArchived);
  }, [showArchived]);

  // Refresh on task changes across any project
  useEffect(() => {
    const handler = () => fetchSummary(showArchived);
    window.addEventListener("project-tasks-updated", handler);
    return () => window.removeEventListener("project-tasks-updated", handler);
  }, [showArchived]);

  const handleArchiveToggle = async (e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    await api.put(`/projects/${projectId}/archive`, {});
    fetchSummary(showArchived);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <BarChart3 className="w-10 h-10 mb-3 text-slate-300" />
        <p className="text-sm">{t("project.noProjects")}</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 space-y-3 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-500" />
          {t("project.title")} ({projects.filter(p => !p.archived).length})
        </h2>
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={cn(
            "text-[11px] px-2 py-1 rounded-md flex items-center gap-1 transition-colors",
            showArchived
              ? "bg-amber-100 dark:bg-amber-500/15 text-amber-600"
              : "bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
          )}
        >
          <Archive className="w-3 h-3" />
          {showArchived ? "아카이브 숨기기" : "아카이브 보기"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {projects.map(p => (
          <button
            key={p.id}
            onClick={() => setActiveProject(p.id)}
            className="card p-4 text-left hover:border-blue-300 dark:hover:border-blue-600 transition-all group"
          >
            {/* Header: name + D-Day */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className={cn(
                  "text-sm font-semibold truncate transition-colors",
                  p.archived
                    ? "text-slate-400 dark:text-slate-500 line-through"
                    : "text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400",
                )}>
                  {p.name}
                </span>
                {p.archived && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/15 text-amber-600 shrink-0">
                    아카이브
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={(e) => handleArchiveToggle(e, p.id)}
                  className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors opacity-0 group-hover:opacity-100"
                  title={p.archived ? "아카이브 해제" : "아카이브"}
                >
                  {p.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                </button>
                {p.dDay !== null && !p.archived && (
                  <span className={cn(
                    "text-xs font-bold px-2 py-0.5 rounded-md",
                    p.dDay < 0 ? "bg-red-100 dark:bg-red-500/15 text-red-600"
                      : p.dDay <= 7 ? "bg-orange-100 dark:bg-orange-500/15 text-orange-600"
                      : "bg-blue-100 dark:bg-blue-500/15 text-blue-600"
                  )}>
                    {p.dDay === 0 ? "D-Day!" : p.dDay > 0 ? `D-${p.dDay}` : `D+${Math.abs(p.dDay)}`}
                  </span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
              <div
                className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${p.progress}%` }}
              />
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                {p.completed}/{p.total}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-500" />
                {p.inProgress}
              </span>
              {p.overdue > 0 && (
                <span className="flex items-center gap-1 text-red-500">
                  <AlertTriangle className="w-3 h-3" />
                  {p.overdue}
                </span>
              )}
              <span className="flex items-center gap-1 ml-auto">
                <Users className="w-3 h-3" />
                {p.memberCount}
              </span>
            </div>

            {/* My tasks indicator */}
            {p.myTasks > 0 && (
              <div className="mt-2 text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                ✓ 내 할일 {p.myTasks}개
              </div>
            )}

            {/* Date range */}
            {(p.startDate || p.targetDate) && (
              <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                <Target className="w-3 h-3" />
                {p.startDate && <span>{p.startDate}</span>}
                {p.startDate && p.targetDate && <span>~</span>}
                {p.targetDate && <span>{p.targetDate}</span>}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
