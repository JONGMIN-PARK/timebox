import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { UserPlus, X, Shield, Eye, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";

interface Member {
  userId: number;
  username: string;
  role: "owner" | "admin" | "member" | "viewer";
}

const ROLE_CONFIG: Record<string, { color: string; icon: typeof Shield }> = {
  owner: { color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", icon: Shield },
  admin: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", icon: Shield },
  member: { color: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300", icon: Users },
  viewer: { color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", icon: Eye },
};

const ROLE_I18N: Record<string, string> = {
  owner: "member.owner",
  admin: "member.admin",
  member: "member.member",
  viewer: "member.viewer",
};

const ASSIGNABLE_ROLES = ["admin", "member", "viewer"] as const;

export default function MemberManager({ projectId, myRole }: { projectId: number; myRole: string }) {
  const { t } = useI18n();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("member");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");

  const canManage = myRole === "owner" || myRole === "admin";

  const fetchMembers = async () => {
    const res = await api.get<Member[]>(`/projects/${projectId}/members`);
    if (res.data) setMembers(res.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
  }, [projectId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUsername.trim()) return;
    setInviting(true);
    setError("");

    const res = await api.post(`/projects/${projectId}/members`, {
      username: inviteUsername.trim(),
      role: inviteRole,
    });

    if (res.success) {
      setInviteUsername("");
      setInviteRole("member");
      setShowInvite(false);
      fetchMembers();
    } else {
      setError(res.error || t("member.inviteFailed"));
    }
    setInviting(false);
  };

  const handleRemove = async (userId: number) => {
    if (!confirm(t("member.removeConfirm"))) return;
    const res = await api.delete(`/projects/${projectId}/members/${userId}`);
    if (res.success) {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            <h3 className="font-semibold text-[13px] text-slate-900 dark:text-white tracking-tight">
              {t("member.title")} ({members.length})
            </h3>
          </div>
          {canManage && (
            <button
              onClick={() => setShowInvite(!showInvite)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 btn-primary rounded-lg"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {t("member.invite")}
            </button>
          )}
        </div>

        {/* Invite Form */}
        {showInvite && (
          <form onSubmit={handleInvite} className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-2 animate-in">
            <input
              type="text"
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              placeholder={t("member.usernamePlaceholder")}
              className="input-base w-full"
              autoFocus
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="input-base w-full"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(ROLE_I18N[r])}
                </option>
              ))}
            </select>
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={inviting}
                className="flex-1 text-xs py-2 btn-primary rounded-lg disabled:opacity-50"
              >
                {inviting ? t("member.inviting") : t("member.inviteAction")}
              </button>
              <button
                type="button"
                onClick={() => { setShowInvite(false); setError(""); }}
                className="flex-1 text-xs py-2 btn-ghost rounded-lg bg-slate-100 dark:bg-slate-700"
              >
                {t("member.cancel")}
              </button>
            </div>
          </form>
        )}

        {/* Member List */}
        <div className="space-y-1">
          {members.map((m) => {
            const config = ROLE_CONFIG[m.role] || ROLE_CONFIG.member;
            const RoleIcon = config.icon;
            return (
              <div
                key={m.userId}
                className="group flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300 shrink-0">
                    {m.username.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-900 dark:text-white truncate">
                      {m.username}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full",
                      config.color,
                    )}
                  >
                    <RoleIcon className="w-3 h-3" />
                    {t(ROLE_I18N[m.role])}
                  </span>
                  {canManage && m.role !== "owner" && (
                    <button
                      onClick={() => handleRemove(m.userId)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <X className="w-3.5 h-3.5 text-slate-400 hover:text-red-500 transition-colors" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
