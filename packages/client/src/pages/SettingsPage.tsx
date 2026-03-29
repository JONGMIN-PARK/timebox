import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { api } from "@/lib/api";
import { authApi } from "@/lib/apiService";
import { cn } from "@/lib/utils";
import { Sun, Moon, Monitor, UserPlus, Trash2, Shield, User, CheckCircle, XCircle, Clock, Download, Upload, AlertTriangle, Globe, LogOut, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/useI18n";
import TeamGroupManager from "@/components/admin/TeamGroupManager";
import TelegramSection from "@/components/settings/TelegramSection";
import type { Locale } from "@/lib/i18n";

const AI_MODELS = [
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", tier: "free" },
  { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite", tier: "free" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", tier: "standard" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", tier: "standard" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", tier: "pro" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (Preview)", tier: "pro" },
] as const;

interface UserInfo {
  id: number;
  username: string;
  displayName: string | null;
  role: string;
  active: boolean;
  aiModel?: string;
  allowedModels?: string[];
  createdAt: string;
}

interface RegRequest {
  id: number;
  username: string;
  displayName: string | null;
  message: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
}

interface TeamGroup {
  id: number;
  name: string;
  color: string;
  memberCount: number;
  members?: TeamGroupMember[];
}

interface TeamGroupMember {
  userId: number;
}

export default function SettingsPage() {
  const { user, logout, fetchMe } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { t, setLocale, locale } = useI18n();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [requests, setRequests] = useState<RegRequest[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", displayName: "", role: "user" });
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [teamGroups, setTeamGroups] = useState<TeamGroup[]>([]);
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [calendarFeedToken, setCalendarFeedToken] = useState<string | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem("timebox_notification_prefs");
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return { reminders: true, chat: true, tasks: true, inbox: true };
  });

  const requestNotificationPermission = async () => {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  };

  const toggleNotifPref = (key: string) => {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    localStorage.setItem("timebox_notification_prefs", JSON.stringify(updated));
  };

  const isAdmin = user?.role === "admin";
  const pendingRequests = requests.filter((r) => r.status === "pending");

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchRequests();
      fetchTeamGroupsWithMembers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    const res = await api.get<UserInfo[]>("/auth/users");
    if (res.success && res.data) setUsers(res.data);
  };

  const fetchRequests = async () => {
    const res = await api.get<RegRequest[]>("/auth/requests");
    if (res.success && res.data) setRequests(res.data);
  };

  const fetchTeamGroupsWithMembers = async () => {
    const res = await api.get<TeamGroup[]>("/admin/groups");
    if (res.success && res.data) {
      // Fetch members for each group
      const groupsWithMembers = await Promise.all(
        res.data.map(async (g: TeamGroup) => {
          const membersRes = await api.get<TeamGroupMember[]>(`/admin/groups/${g.id}/members`);
          return { ...g, members: membersRes.data || [] };
        })
      );
      setTeamGroups(groupsWithMembers);
    }
  };

  const showMsg = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 3000);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username.trim() || !newUser.password) return;
    const res = await api.post<UserInfo>("/auth/register", {
      username: newUser.username.trim(),
      password: newUser.password,
      displayName: newUser.displayName.trim() || newUser.username.trim(),
      role: newUser.role,
    });
    if (res.success) {
      showMsg("User created successfully");
      setNewUser({ username: "", password: "", displayName: "", role: "user" });
      setShowAddUser(false);
      fetchUsers();
    } else {
      showMsg(res.error || "Failed to create user");
    }
  };

  const handleRequestAction = async (id: number, action: "approve" | "reject") => {
    const res = await api.put(`/auth/requests/${id}`, { action });
    if (res.success) {
      showMsg(action === "approve" ? "User approved" : "Request rejected");
      fetchRequests();
      if (action === "approve") fetchUsers();
    } else {
      showMsg("Action failed");
    }
  };

  const handleToggleActive = async (id: number, active: boolean) => {
    await api.put(`/auth/users/${id}`, { active: !active });
    fetchUsers();
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm(t("settings.deleteUserConfirm"))) return;
    await api.delete(`/auth/users/${id}`);
    fetchUsers();
  };

  const handleChangeRole = async (id: number, role: string) => {
    await api.put(`/auth/users/${id}`, { role: role === "admin" ? "user" : "admin" });
    fetchUsers();
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-4 border-b border-slate-200/60 dark:border-slate-700/40">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">{t("settings.title")}</h1>
      </div>

      <div className="flex-1 p-4 sm:p-6 space-y-6 max-w-2xl">
        {/* Profile */}
        <section>
          <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{t("settings.profile")}</h2>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-lg font-semibold text-white shadow-sm">
                {(user?.displayName || user?.username || "U")[0].toUpperCase()}
              </div>
              <div>
                <p className="text-[13px] font-medium text-slate-900 dark:text-white">{user?.displayName || user?.username}</p>
                <p className="text-xs text-slate-400">@{user?.username} · {user?.role === "admin" ? t("settings.admin") : t("settings.user")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Theme */}
        <section>
          <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{t("settings.appearance")}</h2>
          <div className="card p-4">
            <div className="flex gap-2">
              {([
                { value: "light", labelKey: "settings.light", Icon: Sun },
                { value: "dark", labelKey: "settings.dark", Icon: Moon },
                { value: "system", labelKey: "settings.system", Icon: Monitor },
              ] as const).map(({ value, labelKey, Icon }) => (
                <button key={value} onClick={() => setTheme(value)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all",
                    theme === value
                      ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/50"
                      : "bg-slate-50 dark:bg-slate-700/40 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60",
                  )}>
                  <Icon className="w-4 h-4" />
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Language */}
        <section>
          <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{t("settings.language")}</h2>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-slate-400" />
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                className="flex-1 text-sm bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="en">English</option>
                <option value="ko">한국어</option>
              </select>
            </div>
          </div>
        </section>

        {/* Telegram Integration */}
        <TelegramSection />

        {/* AI Model */}
        <section>
          <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">AI 모델</h2>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-purple-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 dark:text-slate-300">텔레그램 AI 비서 모델</p>
                <p className="text-[10px] text-slate-400">
                  {isAdmin ? "관리자는 모든 모델 사용 가능" : user?.allowedModels?.length ? "관리자가 허용한 모델만 선택 가능" : "허용된 모델이 없습니다. 관리자에게 요청하세요."}
                </p>
              </div>
              <select
                value={user?.aiModel || "gemini-2.0-flash"}
                onChange={async (e) => {
                  await api.put("/auth/me", { aiModel: e.target.value });
                  fetchMe();
                }}
                disabled={!isAdmin && (!user?.allowedModels || user.allowedModels.length === 0)}
                className="text-xs bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none disabled:opacity-40"
              >
                {AI_MODELS.filter((m) => isAdmin || user?.allowedModels?.includes(m.id)).map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{t("settings.notifications")}</h2>
          <div className="card p-4 space-y-3">
            {/* Browser notification permission */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-300">브라우저 알림</p>
                <p className="text-[10px] text-slate-400">리마인더, 채팅 알림을 브라우저로 받습니다</p>
              </div>
              <button onClick={requestNotificationPermission} className={cn(
                "px-3 py-1.5 text-xs rounded-lg font-medium transition-colors",
                notifPermission === "granted"
                  ? "bg-green-50 dark:bg-green-900/20 text-green-600"
                  : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100"
              )}>
                {notifPermission === "granted" ? "✓ 허용됨" : notifPermission === "denied" ? "차단됨" : "허용하기"}
              </button>
            </div>

            {/* Toggle switches for each notification type */}
            {[
              { key: "reminders", label: "리마인더 알림", desc: "리마인더 시간에 알림" },
              { key: "chat", label: "채팅 메시지 알림", desc: "새 채팅 메시지 수신 시" },
              { key: "tasks", label: "태스크 할당 알림", desc: "태스크가 나에게 할당될 때" },
              { key: "inbox", label: "인박스 메시지 알림", desc: "새 인박스 메시지 수신 시" },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{item.label}</p>
                  <p className="text-[10px] text-slate-400">{item.desc}</p>
                </div>
                <button onClick={() => toggleNotifPref(item.key)}
                  className={cn("w-10 h-5 rounded-full transition-colors relative",
                    notifPrefs[item.key] ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-600"
                  )}>
                  <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                    notifPrefs[item.key] ? "translate-x-5" : "translate-x-0.5"
                  )} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Calendar feed (iCal) */}
        <section>
          <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{t("settings.calendarFeed")}</h2>
          <div className="card p-4 space-y-3">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{t("settings.calendarFeedHelp")}</p>
            {user?.hasCalendarFeed && !calendarFeedToken && (
              <p className="text-[11px] text-amber-700/90 dark:text-amber-300/90">{t("settings.calendarFeedActive")}</p>
            )}
            {calendarFeedToken && (
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{t("settings.calendarFeedUrl")}</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/api/calendar/feed.ics?token=${encodeURIComponent(calendarFeedToken)}`}
                    className="flex-1 min-w-0 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}/api/calendar/feed.ics?token=${encodeURIComponent(calendarFeedToken)}`;
                      void navigator.clipboard.writeText(url);
                      showMsg(t("settings.calendarFeedCopied"));
                    }}
                    className="shrink-0 px-3 py-2 text-xs rounded-lg btn-primary"
                  >
                    {t("project.inviteLinkCopy")}
                  </button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  const r = await authApi.regenerateCalendarFeed();
                  if (r.success && r.data?.token) {
                    setCalendarFeedToken(r.data.token);
                    await fetchMe();
                    showMsg("Calendar feed URL updated");
                  } else showMsg(r.error || "Failed");
                }}
                className="px-3 py-2 text-xs rounded-lg btn-primary font-medium"
              >
                {t("settings.calendarFeedGenerate")}
              </button>
              <button
                type="button"
                disabled={!user?.hasCalendarFeed}
                onClick={async () => {
                  const r = await authApi.revokeCalendarFeed();
                  if (r.success) {
                    setCalendarFeedToken(null);
                    await fetchMe();
                    showMsg("Calendar feed disabled");
                  } else showMsg(r.error || "Failed");
                }}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 disabled:opacity-40"
              >
                {t("settings.calendarFeedRevoke")}
              </button>
            </div>
          </div>
        </section>

        {/* Data Management */}
        <section className="animate-in">
          <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{t("settings.data")}</h2>
          <div className="card p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={async () => {
                  setExporting(true);
                  try {
                    const res = await api.get<Record<string, unknown>>("/backup/export");
                    if (res.success && res.data) {
                      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `timebox-backup-${new Date().toISOString().slice(0, 10)}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                      showMsg("Data exported successfully");
                    }
                  } catch { showMsg("Export failed"); }
                  setExporting(false);
                }}
                disabled={exporting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl btn-ghost bg-slate-50 dark:bg-slate-700/40 text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                {exporting ? t("settings.exporting") : t("settings.export")}
              </button>
              <label className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl btn-ghost bg-slate-50 dark:bg-slate-700/40 text-sm font-medium cursor-pointer">
                <Upload className="w-4 h-4" />
                {importing ? t("settings.importing") : t("settings.import")}
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setImporting(true);
                    try {
                      const text = await file.text();
                      const parsed = JSON.parse(text);
                      const backupData = parsed.data || parsed;
                      const mode = confirm("Replace all existing data?\n\nOK = Replace\nCancel = Merge (add to existing)") ? "replace" : "merge";
                      const res = await api.post<{ imported: Record<string, number> }>("/backup/import", { data: backupData, mode });
                      if (res.success && res.data) {
                        const imp = res.data.imported;
                        showMsg(`Imported: ${imp.todos} todos, ${imp.events} events, ${imp.ddays} D-Days, ${imp.timeBlocks} blocks`);
                      } else {
                        showMsg("Import failed");
                      }
                    } catch { showMsg("Invalid file"); }
                    setImporting(false);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50/80 dark:bg-amber-500/5 border border-amber-200/50 dark:border-amber-500/10">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                {t("settings.dataNote")}
              </p>
            </div>
          </div>
        </section>

        {message && (
          <div className="text-xs px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/20 animate-in">
            {message}
          </div>
        )}

        {/* Registration Requests (Admin) */}
        {isAdmin && pendingRequests.length > 0 && (
          <section>
            <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              {t("settings.accessRequests")}
              <span className="bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingRequests.length}
              </span>
            </h2>
            <div className="card overflow-hidden">
              {pendingRequests.map((req) => (
                <div key={req.id} className="flex items-start gap-3 px-4 py-3 border-b border-slate-100/80 dark:border-slate-700/40 last:border-0 animate-in">
                  <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-900 dark:text-white">{req.displayName || req.username}</p>
                    <p className="text-xs text-slate-400">@{req.username} · {req.createdAt.slice(0, 10)}</p>
                    {req.message && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 bg-slate-50 dark:bg-slate-700/40 rounded-lg px-2.5 py-1.5 italic">
                        "{req.message}"
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleRequestAction(req.id, "approve")}
                      className="h-8 px-3 rounded-lg bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium hover:bg-green-100 dark:hover:bg-green-500/20 transition-all flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{t("settings.approve")}</span>
                    </button>
                    <button onClick={() => handleRequestAction(req.id, "reject")}
                      className="h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-700/50 text-slate-500 text-xs font-medium hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 transition-all flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{t("settings.reject")}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* User Management (Admin) */}
        {isAdmin && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t("settings.userManagement")}</h2>
              <button onClick={() => setShowAddUser(!showAddUser)}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg btn-primary">
                <UserPlus className="w-3.5 h-3.5" />
                {t("settings.addUser")}
              </button>
            </div>

            {showAddUser && (
              <form onSubmit={handleAddUser} className="card p-4 mb-3 space-y-3 animate-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1 block">{t("auth.username")}</label>
                    <input type="text" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      className="input-base w-full" autoFocus />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1 block">{t("auth.password")}</label>
                    <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="input-base w-full" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1 block">{t("auth.displayName")}</label>
                    <input type="text" value={newUser.displayName} onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                      placeholder={t("settings.optional")} className="input-base w-full" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1 block">{t("settings.role")}</label>
                    <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      className="input-base w-full">
                      <option value="user">{t("settings.user")}</option>
                      <option value="admin">{t("settings.admin")}</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 py-2.5 text-xs btn-primary rounded-xl">{t("settings.create")}</button>
                  <button type="button" onClick={() => setShowAddUser(false)} className="flex-1 py-2.5 text-xs btn-ghost rounded-xl bg-slate-100 dark:bg-slate-700">{t("common.cancel")}</button>
                </div>
              </form>
            )}

            <div className="card overflow-hidden">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-100/80 dark:border-slate-700/40 last:border-0">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0",
                    u.active ? "bg-gradient-to-br from-blue-400 to-blue-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-400",
                  )}>
                    {(u.displayName || u.username)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn("text-[13px] font-medium truncate", u.active ? "text-slate-900 dark:text-white" : "text-slate-400 line-through")}>
                        {u.displayName || u.username}
                      </p>
                      {u.role === "admin" && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wide">Admin</span>
                      )}
                      {teamGroups.filter(g => g.members?.some((m) => m.userId === u.id)).map(g => (
                        <span key={g.id} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: g.color + '20', color: g.color }}>
                          {g.name}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400">@{u.username}</p>
                    {/* AI Model assignment */}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Sparkles className="w-3 h-3 text-purple-400 flex-shrink-0" />
                      {AI_MODELS.map((m) => {
                        const allowed = u.allowedModels || [];
                        const isAllowed = allowed.includes(m.id);
                        return (
                          <button key={m.id} onClick={async () => {
                            const newAllowed = isAllowed ? allowed.filter((a: string) => a !== m.id) : [...allowed, m.id];
                            await api.put(`/auth/users/${u.id}`, { allowedModels: newAllowed });
                            fetchUsers();
                          }}
                            className={cn("text-[9px] px-1.5 py-0.5 rounded-full border transition-colors",
                              isAllowed
                                ? "bg-purple-100 dark:bg-purple-500/15 border-purple-300 dark:border-purple-600 text-purple-600 dark:text-purple-400"
                                : "border-slate-200 dark:border-slate-600 text-slate-400 hover:border-purple-300")}>
                            {m.label.replace("Gemini ", "")}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {u.id !== user?.id && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => handleChangeRole(u.id, u.role)} title="Toggle admin"
                        className="w-7 h-7 rounded-lg btn-ghost flex items-center justify-center">
                        <Shield className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                      <button onClick={() => handleToggleActive(u.id, u.active)} title={u.active ? "Deactivate" : "Activate"}
                        className="w-7 h-7 rounded-lg btn-ghost flex items-center justify-center">
                        <User className={cn("w-3.5 h-3.5", u.active ? "text-green-500" : "text-slate-400")} />
                      </button>
                      <button onClick={() => handleDeleteUser(u.id)} title="Delete"
                        className="w-7 h-7 rounded-lg btn-ghost flex items-center justify-center hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Past requests */}
            {requests.filter((r) => r.status !== "pending").length > 0 && (
              <div className="mt-4">
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{t("settings.requestHistory")}</h3>
                <div className="card overflow-hidden">
                  {requests.filter((r) => r.status !== "pending").map((req) => (
                    <div key={req.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100/80 dark:border-slate-700/40 last:border-0">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                        req.status === "approved" ? "bg-green-100 dark:bg-green-500/15" : "bg-red-100 dark:bg-red-500/15",
                      )}>
                        {req.status === "approved"
                          ? <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                          : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                          <span className="font-medium text-slate-900 dark:text-white">{req.username}</span>
                          {" — "}{req.status}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 tabular-nums flex-shrink-0">{(req.reviewedAt || req.createdAt).slice(0, 10)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {isAdmin && (
          <section className="card p-4">
            <h2 className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
              {t("group.title")}
            </h2>
            <TeamGroupManager />
          </section>
        )}

        {/* Logout */}
        <section className="pb-6">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-red-500 bg-red-50/80 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-all"
          >
            <LogOut className="w-4 h-4" />
            {t("auth.signOut")}
          </button>
        </section>
      </div>
    </div>
  );
}
