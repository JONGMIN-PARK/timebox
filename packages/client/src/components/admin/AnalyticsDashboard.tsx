import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";
import { BarChart3, Users, Activity, TrendingUp, Clock } from "lucide-react";

interface Summary {
  today: number;
  thisWeek: number;
  thisMonth: number;
  activeUsersToday: number;
  mostUsedFeature: string;
}

interface CategoryStat {
  category: string;
  count: number;
  percentage: number;
}

interface FeatureStat {
  feature: string;
  count: number;
}

interface UserActivity {
  userId: number;
  username: string;
  displayName: string | null;
  today: number;
  thisWeek: number;
  lastActive: string | null;
}

interface TimelineEntry {
  id: number;
  userId: number;
  username: string;
  displayName: string | null;
  action: string;
  category: string;
  feature: string;
  createdAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  personal: "bg-blue-500",
  project: "bg-emerald-500",
  general: "bg-amber-500",
};

const CATEGORY_BG: Record<string, string> = {
  personal: "bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
  project: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  general: "bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function AnalyticsDashboard() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [features, setFeatures] = useState<FeatureStat[]>([]);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [sortField, setSortField] = useState<"today" | "thisWeek">("today");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [summaryRes, catRes, featRes, usersRes, timelineRes] = await Promise.all([
      api.get<Summary>("/analytics/summary"),
      api.get<CategoryStat[]>("/analytics/by-category"),
      api.get<FeatureStat[]>("/analytics/by-feature"),
      api.get<UserActivity[]>("/analytics/users"),
      api.get<TimelineEntry[]>("/analytics/timeline"),
    ]);

    if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data);
    if (catRes.success && catRes.data) setCategories(catRes.data);
    if (featRes.success && featRes.data) setFeatures(featRes.data);
    if (usersRes.success && usersRes.data) setUserActivity(usersRes.data);
    if (timelineRes.success && timelineRes.data) setTimeline(timelineRes.data);
    setLoading(false);
  };

  const sortedUsers = [...userActivity].sort((a, b) => {
    const diff = sortAsc ? a[sortField] - b[sortField] : b[sortField] - a[sortField];
    return diff;
  });

  const handleSort = (field: "today" | "thisWeek") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const maxFeatureCount = features.length > 0 ? Math.max(...features.map((f) => f.count)) : 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Today</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {summary?.today ?? 0}
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">This Week</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {summary?.thisWeek ?? 0}
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-violet-500" />
            </div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">This Month</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {summary?.thisMonth ?? 0}
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Active Users</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {summary?.activeUsersToday ?? 0}
          </p>
        </div>

        <div className="card p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-500/15 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Top Feature</span>
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white capitalize truncate">
            {summary?.mostUsedFeature ?? "-"}
          </p>
        </div>
      </div>

      {/* Activity by Category */}
      <section>
        <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Activity by Category
        </h2>
        <div className="card p-4 space-y-3">
          {categories.length === 0 && (
            <p className="text-xs text-slate-400">No data available</p>
          )}
          {categories.map((cat) => (
            <div key={cat.category}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full", CATEGORY_BG[cat.category] || "bg-slate-100 dark:bg-slate-700 text-slate-500")}>
                    {cat.category}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 tabular-nums">
                    {cat.count}
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums w-10 text-right">
                    {cat.percentage}%
                  </span>
                </div>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", CATEGORY_COLORS[cat.category] || "bg-slate-400")}
                  style={{ width: `${cat.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Activity by Feature */}
      <section>
        <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Activity by Feature
        </h2>
        <div className="card p-4 space-y-2.5">
          {features.length === 0 && (
            <p className="text-xs text-slate-400">No data available</p>
          )}
          {features.map((feat) => (
            <div key={feat.feature} className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300 w-20 capitalize truncate">
                {feat.feature}
              </span>
              <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700/50 rounded overflow-hidden">
                <div
                  className="h-full bg-blue-500/80 dark:bg-blue-500/60 rounded transition-all duration-500 flex items-center justify-end pr-1.5"
                  style={{ width: `${Math.max((feat.count / maxFeatureCount) * 100, 4)}%` }}
                >
                  <span className="text-[9px] font-bold text-white tabular-nums">
                    {feat.count}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* User Activity Table */}
      <section>
        <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          User Activity
        </h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200/60 dark:border-slate-700/40">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    User
                  </th>
                  <th
                    className="text-right px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 select-none"
                    onClick={() => handleSort("today")}
                  >
                    Today {sortField === "today" && (sortAsc ? "\u2191" : "\u2193")}
                  </th>
                  <th
                    className="text-right px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 select-none"
                    onClick={() => handleSort("thisWeek")}
                  >
                    This Week {sortField === "thisWeek" && (sortAsc ? "\u2191" : "\u2193")}
                  </th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Last Active
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-400">
                      No user data available
                    </td>
                  </tr>
                )}
                {sortedUsers.map((u) => (
                  <tr
                    key={u.userId}
                    className="border-b border-slate-100/80 dark:border-slate-700/40 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0">
                          {(u.displayName || u.username)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-slate-900 dark:text-white leading-tight">
                            {u.displayName || u.username}
                          </p>
                          <p className="text-[10px] text-slate-400">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={cn(
                        "text-[13px] font-medium tabular-nums",
                        u.today > 0 ? "text-slate-900 dark:text-white" : "text-slate-300 dark:text-slate-600",
                      )}>
                        {u.today}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-[13px] font-medium text-slate-900 dark:text-white tabular-nums">
                        {u.thisWeek}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {u.lastActive ? timeAgo(u.lastActive) : "-"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Recent Activity Feed */}
      <section>
        <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Recent Activity
        </h2>
        <div className="card overflow-hidden">
          {timeline.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-slate-400">
              No recent activity
            </div>
          )}
          {timeline.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 px-4 py-3 border-b border-slate-100/80 dark:border-slate-700/40 last:border-0"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0 mt-0.5">
                {(entry.displayName || entry.username)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-snug">
                  <span className="font-medium text-slate-900 dark:text-white">
                    {entry.displayName || entry.username}
                  </span>{" "}
                  {entry.action}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn(
                    "text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full",
                    CATEGORY_BG[entry.category] || "bg-slate-100 dark:bg-slate-700 text-slate-500",
                  )}>
                    {entry.feature}
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeAgo(entry.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
