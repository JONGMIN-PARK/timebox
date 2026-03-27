import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { UserPlus, X, Shield, Eye, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Member {
  userId: number;
  username: string;
  role: "owner" | "admin" | "member" | "viewer";
}

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  owner: { label: "소유자", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", icon: Shield },
  admin: { label: "관리자", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", icon: Shield },
  member: { label: "멤버", color: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300", icon: Users },
  viewer: { label: "뷰어", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", icon: Eye },
};

const ASSIGNABLE_ROLES = ["admin", "member", "viewer"] as const;

export default function MemberManager({ projectId, myRole }: { projectId: number; myRole: string }) {
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
      setError(res.error || "초대에 실패했습니다");
    }
    setInviting(false);
  };

  const handleRemove = async (userId: number) => {
    if (!confirm("이 멤버를 프로젝트에서 제거하시겠습니까?")) return;
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
              프로젝트 멤버 ({members.length})
            </h3>
          </div>
          {canManage && (
            <button
              onClick={() => setShowInvite(!showInvite)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 btn-primary rounded-lg"
            >
              <UserPlus className="w-3.5 h-3.5" />
              초대
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
              placeholder="사용자 이름 입력"
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
                  {ROLE_CONFIG[r].label}
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
                {inviting ? "초대 중..." : "초대하기"}
              </button>
              <button
                type="button"
                onClick={() => { setShowInvite(false); setError(""); }}
                className="flex-1 text-xs py-2 btn-ghost rounded-lg bg-slate-100 dark:bg-slate-700"
              >
                취소
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
                    {config.label}
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
