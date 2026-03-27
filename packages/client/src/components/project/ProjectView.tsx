import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import ProjectDashboard from "./ProjectDashboard";
import MemberManager from "./MemberManager";
import TransferPanel from "./TransferPanel";

type Tab = "dashboard" | "tasks" | "members";

interface ProjectInfo {
  id: number;
  name: string;
  color: string;
  myRole: string;
}

interface ProjectViewProps {
  projectId: number;
  initialTab?: Tab;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "현황판" },
  { key: "tasks", label: "태스크" },
  { key: "members", label: "멤버" },
];

export default function ProjectView({ projectId, initialTab = "dashboard" }: ProjectViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState(true);

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
        <p className="text-sm text-slate-400">프로젝트를 찾을 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/40">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: project.color || "#3b82f6" }}
          />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white truncate">
            {project.name}
          </h2>
        </div>

        {/* Tab Bar */}
        <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-md transition-colors",
                activeTab === tab.key
                  ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transfer requests panel */}
      <TransferPanel projectId={projectId} />

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "dashboard" && (
          <div className="h-full overflow-y-auto">
            <ProjectDashboard projectId={projectId} />
          </div>
        )}
        {activeTab === "tasks" && (
          <div className="h-full overflow-y-auto flex items-center justify-center">
            <p className="text-sm text-slate-400">태스크 보드 (KanbanBoard 연결 예정)</p>
          </div>
        )}
        {activeTab === "members" && (
          <div className="h-full overflow-y-auto">
            <MemberManager projectId={projectId} myRole={project.myRole} />
          </div>
        )}
      </div>
    </div>
  );
}
