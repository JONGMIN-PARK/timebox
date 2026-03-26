import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Sun, Moon, Monitor, UserPlus, Trash2, Shield, User } from "lucide-react";

interface UserInfo {
  id: number;
  username: string;
  displayName: string | null;
  role: string;
  active: boolean;
  createdAt: string;
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", displayName: "", role: "user" });
  const [message, setMessage] = useState("");

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    const res = await api.get<UserInfo[]>("/auth/users");
    if (res.success && res.data) setUsers(res.data);
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
      setMessage("User created successfully");
      setNewUser({ username: "", password: "", displayName: "", role: "user" });
      setShowAddUser(false);
      fetchUsers();
    } else {
      setMessage(res.error || "Failed to create user");
    }
    setTimeout(() => setMessage(""), 3000);
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
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h1>
      </div>

      <div className="flex-1 p-6 space-y-8 max-w-2xl">
        {/* Profile */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Profile</h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-lg font-bold text-blue-600">
                {(user?.displayName || user?.username || "U")[0].toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{user?.displayName || user?.username}</p>
                <p className="text-sm text-slate-500">@{user?.username} · {user?.role === "admin" ? "Admin" : "User"}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Theme */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Appearance</h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex gap-2">
              {([
                { value: "light", label: "Light", Icon: Sun },
                { value: "dark", label: "Dark", Icon: Moon },
                { value: "system", label: "System", Icon: Monitor },
              ] as const).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    theme === value
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500"
                      : "bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700",
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* User Management (Admin only) */}
        {isAdmin && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">User Management</h2>
              <button
                onClick={() => setShowAddUser(!showAddUser)}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add User
              </button>
            </div>

            {message && (
              <div className="mb-3 text-sm px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                {message}
              </div>
            )}

            {showAddUser && (
              <form onSubmit={handleAddUser} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Username</label>
                    <input
                      type="text"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Password</label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Display Name</label>
                    <input
                      type="text"
                      value={newUser.displayName}
                      onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                      placeholder="Optional"
                      className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Role</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg">Create</button>
                  <button type="button" onClick={() => setShowAddUser(false)} className="flex-1 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm rounded-lg">Cancel</button>
                </div>
              </form>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                    u.active ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" : "bg-slate-200 dark:bg-slate-700 text-slate-400",
                  )}>
                    {(u.displayName || u.username)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn("text-sm font-medium truncate", u.active ? "text-slate-900 dark:text-white" : "text-slate-400 line-through")}>
                        {u.displayName || u.username}
                      </p>
                      {u.role === "admin" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">@{u.username}</p>
                  </div>
                  {u.id !== user?.id && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleChangeRole(u.id, u.role)}
                        className="w-7 h-7 rounded flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700"
                        title="Toggle admin"
                      >
                        <Shield className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(u.id, u.active)}
                        className="w-7 h-7 rounded flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700"
                        title={u.active ? "Deactivate" : "Activate"}
                      >
                        <User className={cn("w-3.5 h-3.5", u.active ? "text-green-500" : "text-slate-400")} />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="w-7 h-7 rounded flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
