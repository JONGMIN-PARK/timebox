import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Sun, Moon, Monitor, UserPlus, Trash2, Shield, User, CheckCircle, XCircle, Clock, UserCheck } from "lucide-react";

interface UserInfo {
  id: number;
  username: string;
  displayName: string | null;
  role: string;
  active: boolean;
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

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [requests, setRequests] = useState<RegRequest[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", displayName: "", role: "user" });
  const [message, setMessage] = useState("");

  const isAdmin = user?.role === "admin";
  const pendingRequests = requests.filter((r) => r.status === "pending");

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchRequests();
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
    if (!confirm("Are you sure you want to delete this user?")) return;
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
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">Settings</h1>
      </div>

      <div className="flex-1 p-4 sm:p-6 space-y-6 max-w-2xl">
        {/* Profile */}
        <section>
          <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Profile</h2>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-lg font-semibold text-white shadow-sm">
                {(user?.displayName || user?.username || "U")[0].toUpperCase()}
              </div>
              <div>
                <p className="text-[13px] font-medium text-slate-900 dark:text-white">{user?.displayName || user?.username}</p>
                <p className="text-xs text-slate-400">@{user?.username} · {user?.role === "admin" ? "Admin" : "User"}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Theme */}
        <section>
          <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Appearance</h2>
          <div className="card p-4">
            <div className="flex gap-2">
              {([
                { value: "light", label: "Light", Icon: Sun },
                { value: "dark", label: "Dark", Icon: Moon },
                { value: "system", label: "System", Icon: Monitor },
              ] as const).map(({ value, label, Icon }) => (
                <button key={value} onClick={() => setTheme(value)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all",
                    theme === value
                      ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/50"
                      : "bg-slate-50 dark:bg-slate-700/40 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60",
                  )}>
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
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
              Access Requests
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
                      <span className="hidden sm:inline">Approve</span>
                    </button>
                    <button onClick={() => handleRequestAction(req.id, "reject")}
                      className="h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-700/50 text-slate-500 text-xs font-medium hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 transition-all flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Reject</span>
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
              <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">User Management</h2>
              <button onClick={() => setShowAddUser(!showAddUser)}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg btn-primary">
                <UserPlus className="w-3.5 h-3.5" />
                Add User
              </button>
            </div>

            {showAddUser && (
              <form onSubmit={handleAddUser} className="card p-4 mb-3 space-y-3 animate-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1 block">Username</label>
                    <input type="text" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      className="input-base w-full" autoFocus />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1 block">Password</label>
                    <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="input-base w-full" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1 block">Display Name</label>
                    <input type="text" value={newUser.displayName} onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                      placeholder="Optional" className="input-base w-full" />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1 block">Role</label>
                    <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      className="input-base w-full">
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 py-2.5 text-xs btn-primary rounded-xl">Create</button>
                  <button type="button" onClick={() => setShowAddUser(false)} className="flex-1 py-2.5 text-xs btn-ghost rounded-xl bg-slate-100 dark:bg-slate-700">Cancel</button>
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
                    </div>
                    <p className="text-[11px] text-slate-400">@{u.username}</p>
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
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Request History</h3>
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
      </div>
    </div>
  );
}
