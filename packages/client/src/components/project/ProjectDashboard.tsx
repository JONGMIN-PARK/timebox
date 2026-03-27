import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BarChart3, CheckCircle2, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";

interface ProjectStats {
  total: number;
  completed: number;
  inProgress: number;
  dueSoon: number;
  progressPercent: number;
  weekCompleted: number;
  weekInProgress: number;
  weekDueSoon: number;
}

interface MemberStats {
  userId: number;
  username: string;
  totalTasks: number;
  completedTasks: number;
}

interface ActivityItem {
  id: number;
  userId: number;
  username: string;
  action: "completed" | "created" | "commented";
  targetTitle: string;
  createdAt: string;
}

function relativeTime(dateStr: string, t: (key: string) => string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t("dashboard.justNow");
  if (diffMin < 60) return t("dashboard.minutesAgo").replace("{n}", String(diffMin));
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return t("dashboard.hoursAgo").replace("{n}", String(diffHour));
  const diffDay = Math.floor(diffHour / 24);
  return t("dashboard.daysAgo").replace("{n}", String(diffDay));
}

function actionIcon(action: string) {
  switch (action) {
    case "completed":
      return <span className="text-green-500">●</span>;
    case "created":
      return <span className="text-blue-500">●</span>;
    case "commented":
      return <span className="text-yellow-500">●</span>;
    default:
      return <span className="text-slate-400">●</span>;
  }
}

function actionLabel(action: string, targetTitle: string, t: (key: string) => string): string {
  switch (action) {
    case "completed":
      return t("dashboard.actionCompleted").replace("{title}", targetTitle);
    case "created":
      return t("dashboard.actionCreated").replace("{title}", targetTitle);
    case "commented":
      return t("dashboard.actionCommented").replace("{title}", targetTitle);
    default:
      return targetTitle;
  }
}

export default function ProjectDashboard({ projectId }: { projectId: number }) {
  const { t } = useI18n();
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [members, setMembers] = useState<MemberStats[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [statsRes, membersRes, activityRes] = await Promise.all([
      api.get<ProjectStats>(`/projects/${projectId}/stats`),
      api.get<MemberStats[]>(`/projects/${projectId}/members`),
      api.get<ActivityItem[]>(`/projects/${projectId}/activity`),
    ]);
    if (statsRes.data) setStats(statsRes.data);
    if (membersRes.data) setMembers(membersRes.data);
    if (activityRes.data) setActivity(activityRes.data);
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maxTasks = Math.max(...members.map((m) => m.totalTasks), 1);

  return (
    <div className="space-y-4 p-4 overflow-y-auto">
      {/* Dashboard header with refresh */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t("project.dashboard")}
        </h3>
        <button
          onClick={() => fetchData()}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress & Weekly Stats */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Progress */}
          <div className="flex-1">
            <h4 className="text-[13px] font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              {t("dashboard.progress")}
            </h4>
            <div className="relative w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${stats?.progressPercent ?? 0}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-bold text-blue-600 dark:text-blue-400 text-lg">
                {stats?.progressPercent ?? 0}%
              </span>
              <span className="ml-2 text-xs text-slate-400">
                {t("dashboard.total")}: {stats?.total ?? 0} | {t("dashboard.completed")}: {stats?.completed ?? 0}
              </span>
            </p>
          </div>

          {/* Weekly Stats */}
          <div className="sm:border-l sm:border-slate-200 sm:dark:border-slate-700 sm:pl-6 min-w-[140px]">
            <h4 className="text-[13px] font-semibold text-slate-900 dark:text-white mb-3">
              {t("dashboard.weeklyStats")}
            </h4>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                <span className="text-slate-600 dark:text-slate-300">{t("dashboard.completed")}:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{stats?.weekCompleted ?? 0}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-slate-600 dark:text-slate-300">{t("dashboard.inProgress")}:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{stats?.weekInProgress ?? 0}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-slate-600 dark:text-slate-300">{t("dashboard.dueSoon")}:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{stats?.weekDueSoon ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Member Stats */}
      <div className="card p-4">
        <h4 className="text-[13px] font-semibold text-slate-900 dark:text-white mb-3">
          {t("dashboard.memberStats")}
        </h4>
        {members.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">{t("dashboard.noMembers")}</p>
        ) : (
          <div className="space-y-2.5">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                  {m.username.charAt(0)}
                </div>
                <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200 w-16 truncate shrink-0">
                  {m.username}
                </span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${(m.totalTasks / maxTasks) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                    {m.totalTasks}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">
                  ({m.completedTasks} {t("dashboard.completed")})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3">
          <h4 className="text-[13px] font-semibold text-slate-900 dark:text-white">
            {t("dashboard.recentActivity")}
          </h4>
        </div>
        {activity.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">{t("dashboard.noActivity")}</p>
        ) : (
          <div>
            {activity.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
              >
                <span className="text-sm shrink-0">{actionIcon(a.action)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-slate-700 dark:text-slate-200 truncate">
                    <span className="font-medium">{a.username}</span>{" "}
                    {actionLabel(a.action, a.targetTitle, t)}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0 whitespace-nowrap">
                  {relativeTime(a.createdAt, t)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
