import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BarChart3, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

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

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}일 전`;
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

function actionLabel(action: string, targetTitle: string): string {
  switch (action) {
    case "completed":
      return `"${targetTitle}" 완료`;
    case "created":
      return `"${targetTitle}" 생성`;
    case "commented":
      return `"${targetTitle}"에 댓글`;
    default:
      return targetTitle;
  }
}

export default function ProjectDashboard({ projectId }: { projectId: number }) {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [members, setMembers] = useState<MemberStats[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      api.get<ProjectStats>(`/projects/${projectId}/stats`),
      api.get<MemberStats[]>(`/projects/${projectId}/members`),
      api.get<ActivityItem[]>(`/projects/${projectId}/activity`),
    ]).then(([statsRes, membersRes, activityRes]) => {
      if (cancelled) return;
      if (statsRes.data) setStats(statsRes.data);
      if (membersRes.data) setMembers(membersRes.data);
      if (activityRes.data) setActivity(activityRes.data);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [projectId]);

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
      {/* Progress & Weekly Stats */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Progress */}
          <div className="flex-1">
            <h4 className="text-[13px] font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              진행률
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
                전체: {stats?.total ?? 0} | 완료: {stats?.completed ?? 0}
              </span>
            </p>
          </div>

          {/* Weekly Stats */}
          <div className="sm:border-l sm:border-slate-200 sm:dark:border-slate-700 sm:pl-6 min-w-[140px]">
            <h4 className="text-[13px] font-semibold text-slate-900 dark:text-white mb-3">
              이번주 통계
            </h4>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                <span className="text-slate-600 dark:text-slate-300">완료:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{stats?.weekCompleted ?? 0}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-slate-600 dark:text-slate-300">진행:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{stats?.weekInProgress ?? 0}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-slate-600 dark:text-slate-300">마감임박:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{stats?.weekDueSoon ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Member Stats */}
      <div className="card p-4">
        <h4 className="text-[13px] font-semibold text-slate-900 dark:text-white mb-3">
          멤버별 현황
        </h4>
        {members.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">멤버 정보가 없습니다</p>
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
                  ({m.completedTasks} 완료)
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
            최근 활동
          </h4>
        </div>
        {activity.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">아직 활동이 없습니다</p>
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
                    {actionLabel(a.action, a.targetTitle)}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0 whitespace-nowrap">
                  {relativeTime(a.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
