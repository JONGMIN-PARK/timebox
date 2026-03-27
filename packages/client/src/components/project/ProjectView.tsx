import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";
import { usePageVisible } from "@/lib/useVisibility";
import { CalendarDays, Users, Target } from "lucide-react";
import KanbanBoard from "./KanbanBoard";
import ProjectDashboard from "./ProjectDashboard";
import MemberManager from "./MemberManager";
import TransferPanel from "./TransferPanel";
import PostBoard from "./PostBoard";
import ProjectFileManager from "./ProjectFileManager";
import ProjectChat from "./ProjectChat";
import ProjectDocs from "./ProjectDocs";

type Tab = "dashboard" | "tasks" | "members" | "board" | "files" | "chat" | "docs";

interface ProjectInfo {
  id: number;
  name: string;
  color: string;
  myRole: string;
  startDate?: string | null;
  targetDate?: string | null;
  memberCount?: number;
}

interface ProjectViewProps {
  projectId: number;
  initialTab?: Tab;
}

const TAB_KEYS: { key: Tab; labelKey: string }[] = [
  { key: "dashboard", labelKey: "project.dashboard" },
  { key: "tasks", labelKey: "project.tasks" },
  { key: "board", labelKey: "post.title" },
  { key: "files", labelKey: "files.shared" },
  { key: "chat", labelKey: "chat.title" },
  { key: "docs", labelKey: "project.docs" },
  { key: "members", labelKey: "project.members" },
];

export default function ProjectView({ projectId, initialTab = "dashboard" }: ProjectViewProps) {
  const { t } = useI18n();
  const pageVisible = usePageVisible();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [transferCount, setTransferCount] = useState(0);
  const [editingDates, setEditingDates] = useState(false);
  const [editStartDate, setEditStartDate] = useState("");
  const [editTargetDate, setEditTargetDate] = useState("");

  const handleSaveDates = async () => {
    await api.put(`/projects/${projectId}`, {
      startDate: editStartDate || null,
      targetDate: editTargetDate || null,
    });
    setProject(prev => prev ? { ...prev, startDate: editStartDate || null, targetDate: editTargetDate || null } : prev);
    setEditingDates(false);
  };

  useEffect(() => {
    if (!pageVisible) return;
    const fetchTransferCount = async () => {
      const res = await api.get<{ id: number }[]>(`/projects/${projectId}/transfers`);
      if (res.success && res.data) setTransferCount(res.data.length);
    };
    fetchTransferCount();
    const interval = setInterval(fetchTransferCount, 30000);
    return () => clearInterval(interval);
  }, [projectId, pageVisible]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get<ProjectInfo>(`/projects/${projectId}`).then((res) => {
      if (cancelled) return;
      if (res.data) setProject(res.data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-slate-400">{t("project.notFound")}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 gap-2 border-b border-slate-200/60 dark:border-slate-700/40">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          {/* Project name */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: project.color || "#3b82f6" }}
            />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {project.name}
            </h2>
          </div>

          {/* Info badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* D-Day */}
            {project.targetDate && (() => {
              const target = new Date(project.targetDate);
              const today = new Date(); today.setHours(0,0,0,0); target.setHours(0,0,0,0);
              const dDay = Math.ceil((target.getTime() - today.getTime()) / (1000*60*60*24));
              return (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                  dDay < 0 ? "bg-red-100 dark:bg-red-500/15 text-red-600"
                    : dDay <= 7 ? "bg-orange-100 dark:bg-orange-500/15 text-orange-600"
                    : "bg-blue-100 dark:bg-blue-500/15 text-blue-600"
                )}>
                  {dDay === 0 ? "D-Day!" : dDay > 0 ? `D-${dDay}` : `D+${Math.abs(dDay)}`}
                </span>
              );
            })()}

            {/* Date range — clickable for admin */}
            {editingDates ? (
              <span className="flex items-center gap-1">
                <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)}
                  className="text-[10px] bg-slate-100 dark:bg-slate-700 rounded px-1.5 py-0.5 text-slate-700 dark:text-white outline-none w-[110px]" />
                <span className="text-[10px] text-slate-400">~</span>
                <input type="date" value={editTargetDate} onChange={(e) => setEditTargetDate(e.target.value)}
                  className="text-[10px] bg-slate-100 dark:bg-slate-700 rounded px-1.5 py-0.5 text-slate-700 dark:text-white outline-none w-[110px]" />
                <button onClick={handleSaveDates} className="text-[10px] text-blue-500 hover:text-blue-600 font-medium px-1">✓</button>
                <button onClick={() => setEditingDates(false)} className="text-[10px] text-slate-400 hover:text-slate-600 px-1">✕</button>
              </span>
            ) : (
              <button
                onClick={() => {
                  if (project.myRole === "owner" || project.myRole === "admin") {
                    setEditStartDate(project.startDate || "");
                    setEditTargetDate(project.targetDate || "");
                    setEditingDates(true);
                  }
                }}
                className={cn(
                  "flex items-center gap-0.5 text-[10px] text-slate-400",
                  (project.myRole === "owner" || project.myRole === "admin") && "hover:text-blue-500 cursor-pointer"
                )}
                title={project.myRole === "owner" || project.myRole === "admin" ? "Click to edit dates" : undefined}
              >
                <CalendarDays className="w-3 h-3" />
                {project.startDate || project.targetDate
                  ? `${project.startDate?.slice(5) || "?"} ~ ${project.targetDate?.slice(5) || "?"}`
                  : (project.myRole === "owner" || project.myRole === "admin") ? "날짜 설정" : ""}
              </button>
            )}

            {/* Member count */}
            {project.memberCount != null && (
              <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                <Users className="w-3 h-3" />
                {project.memberCount}
              </span>
            )}

            {/* Transfer badge */}
            {transferCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                {transferCount}
              </span>
            )}
          </div>
        </div>

        {/* Tab Bar — scrollable on small screens */}
        <div className="flex overflow-x-auto bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 -mx-1 sm:mx-0">
          {TAB_KEYS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-md transition-colors whitespace-nowrap flex-shrink-0",
                activeTab === tab.key
                  ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
              )}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Transfer requests panel */}
      <TransferPanel projectId={projectId} />

      {/* Content - all tabs stay mounted, only active is visible */}
      <div className="flex-1 overflow-hidden relative">
        <div className={cn("absolute inset-0 overflow-y-auto", activeTab === "dashboard" ? "block" : "hidden")}>
          <ProjectDashboard projectId={projectId} />
        </div>
        <div className={cn("absolute inset-0 overflow-hidden", activeTab === "tasks" ? "block" : "hidden")}>
          <KanbanBoard projectId={projectId} />
        </div>
        <div className={cn("absolute inset-0 overflow-y-auto", activeTab === "board" ? "block" : "hidden")}>
          <PostBoard projectId={projectId} />
        </div>
        <div className={cn("absolute inset-0 overflow-y-auto", activeTab === "files" ? "block" : "hidden")}>
          <ProjectFileManager projectId={projectId} />
        </div>
        <div className={cn("absolute inset-0 overflow-hidden", activeTab === "chat" ? "flex" : "hidden")}>
          <div className="flex-1 flex flex-col h-full">
            <ProjectChat projectId={projectId} />
          </div>
        </div>
        <div className={cn("absolute inset-0 overflow-y-auto", activeTab === "docs" ? "block" : "hidden")}>
          <ProjectDocs projectId={projectId} myRole={project.myRole} />
        </div>
        <div className={cn("absolute inset-0 overflow-y-auto", activeTab === "members" ? "block" : "hidden")}>
          <MemberManager projectId={projectId} myRole={project.myRole} />
        </div>
      </div>
    </div>
  );
}
