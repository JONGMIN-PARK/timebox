import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { UserPlus, X, Shield, Eye, Users, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";

interface Member {
  userId: number;
  username: string;
  role: "owner" | "admin" | "member" | "viewer";
}

interface SearchUser {
  id: number;
  username: string;
  displayName: string | null;
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

  // Search state
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canManage = myRole === "owner" || myRole === "admin";

  const fetchMembers = async () => {
    const res = await api.get<Member[]>(`/projects/${projectId}/members`);
    if (res.data) setMembers(res.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
  }, [projectId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    const res = await api.get<SearchUser[]>(`/projects/${projectId}/members/search?q=${encodeURIComponent(query)}`);
    if (res.data) {
      setSearchResults(res.data);
      setShowDropdown(res.data.length > 0);
    }
    setSearching(false);
  }, [projectId]);

  const handleInputChange = (value: string) => {
    setInviteUsername(value);
    setSelectedUser(null);
    setError("");

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchUsers(value), 300);
  };

  const handleSelectUser = (user: SearchUser) => {
    setSelectedUser(user);
    setInviteUsername(user.displayName || user.username);
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = selectedUser ? selectedUser.username : inviteUsername.trim();
    if (!username) return;
    setInviting(true);
    setError("");

    const res = await api.post(`/projects/${projectId}/members`, {
      username,
      role: inviteRole,
    });

    if (res.success) {
      setInviteUsername("");
      setInviteRole("member");
      setSelectedUser(null);
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
            {/* Search input with dropdown */}
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={inviteUsername}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                  placeholder={t("member.usernamePlaceholder")}
                  className="input-base w-full pl-9"
                  autoFocus
                  autoComplete="off"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Search results dropdown */}
              {showDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-300 shrink-0">
                        {(user.displayName || user.username).charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-slate-900 dark:text-white truncate">
                          {user.displayName || user.username}
                        </p>
                        {user.displayName && (
                          <p className="text-[11px] text-slate-400 truncate">@{user.username}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected user indicator */}
            {selectedUser && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-300">
                  {(selectedUser.displayName || selectedUser.username).charAt(0)}
                </div>
                <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                  {selectedUser.displayName || selectedUser.username}
                </span>
                <span className="text-[10px] text-blue-400">@{selectedUser.username}</span>
                <button
                  type="button"
                  onClick={() => { setSelectedUser(null); setInviteUsername(""); inputRef.current?.focus(); }}
                  className="ml-auto p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-800/40"
                >
                  <X className="w-3 h-3 text-blue-400" />
                </button>
              </div>
            )}

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
                disabled={inviting || (!selectedUser && !inviteUsername.trim())}
                className="flex-1 text-xs py-2 btn-primary rounded-lg disabled:opacity-50"
              >
                {inviting ? t("member.inviting") : t("member.inviteAction")}
              </button>
              <button
                type="button"
                onClick={() => { setShowInvite(false); setError(""); setSelectedUser(null); setInviteUsername(""); }}
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
