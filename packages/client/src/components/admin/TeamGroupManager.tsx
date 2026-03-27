import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/useI18n";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Users, ChevronDown, ChevronRight, X, UserPlus } from "lucide-react";

interface TeamGroup {
  id: number;
  name: string;
  description: string | null;
  color: string;
  memberCount: number;
}

interface GroupMember {
  id: number;
  groupId: number;
  userId: number;
  joinedAt: string;
  user: {
    id: number;
    username: string;
    displayName: string | null;
    role: string;
    active: boolean;
  } | null;
}

interface AvailableUser {
  id: number;
  username: string;
  displayName: string | null;
  role: string;
  active: boolean;
}

export default function TeamGroupManager() {
  const { t } = useI18n();
  const [groups, setGroups] = useState<TeamGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [allUsers, setAllUsers] = useState<AvailableUser[]>([]);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");

  // Add member
  const [addingMemberGroupId, setAddingMemberGroupId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");

  const fetchGroups = async () => {
    const res = await api.get<TeamGroup[]>("/admin/groups");
    if (res.success && res.data) setGroups(res.data);
    setLoading(false);
  };

  const fetchMembers = async (groupId: number) => {
    const res = await api.get<GroupMember[]>(`/admin/groups/${groupId}/members`);
    if (res.success && res.data) setMembers(res.data);
  };

  const fetchAllUsers = async () => {
    const res = await api.get<AvailableUser[]>("/auth/users");
    if (res.success && res.data) setAllUsers(res.data);
  };

  useEffect(() => {
    fetchGroups();
    fetchAllUsers();
  }, []);

  const handleCreateGroup = async () => {
    if (!newName.trim()) return;
    const res = await api.post<TeamGroup>("/admin/groups", {
      name: newName.trim(),
      description: newDesc.trim() || null,
      color: newColor,
    });
    if (res.success) {
      setNewName("");
      setNewDesc("");
      setNewColor("#3b82f6");
      setShowCreate(false);
      fetchGroups();
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm(t("group.deleteConfirm"))) return;
    const res = await api.delete(`/admin/groups/${groupId}`);
    if (res.success) {
      if (expandedGroup === groupId) setExpandedGroup(null);
      fetchGroups();
    }
  };

  const handleToggleGroup = async (groupId: number) => {
    if (expandedGroup === groupId) {
      setExpandedGroup(null);
      return;
    }
    setExpandedGroup(groupId);
    await fetchMembers(groupId);
  };

  const handleAddMember = async (groupId: number) => {
    if (!selectedUserId) return;
    const res = await api.post(`/admin/groups/${groupId}/members`, { userId: selectedUserId });
    if (res.success) {
      setSelectedUserId("");
      setAddingMemberGroupId(null);
      await fetchMembers(groupId);
      fetchGroups();
    }
  };

  const handleRemoveMember = async (groupId: number, userId: number) => {
    if (!confirm(t("group.removeConfirm"))) return;
    const res = await api.delete(`/admin/groups/${groupId}/members/${userId}`);
    if (res.success) {
      await fetchMembers(groupId);
      fetchGroups();
    }
  };

  const getAvailableUsers = (groupId: number) => {
    const memberUserIds = new Set(members.filter(m => m.groupId === groupId).map(m => m.userId));
    return allUsers.filter(u => !memberUserIds.has(u.id) && u.active);
  };

  if (loading) {
    return <div className="py-8 text-center text-slate-400 text-sm">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-3">
      {/* Create Group Button/Form */}
      {!showCreate ? (
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {t("group.create")}
        </button>
      ) : (
        <div className="card p-4 space-y-3 animate-in">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("group.name")}
            className="input-base w-full"
            autoFocus
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder={t("group.description")}
            className="input-base w-full"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">{t("group.color")}:</label>
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateGroup}
              disabled={!newName.trim()}
              className="flex-1 text-xs py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {t("common.save")}
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(""); setNewDesc(""); }}
              className="flex-1 text-xs py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Group List */}
      {groups.length === 0 && !showCreate && (
        <p className="text-xs text-slate-400 text-center py-4">{t("group.noGroups")}</p>
      )}

      {groups.map((group) => {
        const isExpanded = expandedGroup === group.id;
        const available = isExpanded ? getAvailableUsers(group.id) : [];

        return (
          <div key={group.id} className="card overflow-hidden">
            {/* Group Header */}
            <button
              onClick={() => handleToggleGroup(group.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200 flex-1 text-left truncate">
                {group.name}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Users className="w-3 h-3" />
                {group.memberCount}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}
                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
              </button>
            </button>

            {/* Expanded: Description + Members */}
            {isExpanded && (
              <div className="border-t border-slate-100 dark:border-slate-700/50 px-4 py-3 space-y-3">
                {group.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{group.description}</p>
                )}

                {/* Member List */}
                <div className="space-y-1">
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    {t("group.members")} ({members.filter(m => m.groupId === group.id).length})
                  </h4>
                  {members.filter(m => m.groupId === group.id).map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                          {(member.user?.displayName || member.user?.username || "?")[0].toUpperCase()}
                        </div>
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {member.user?.displayName || member.user?.username || `User #${member.userId}`}
                        </span>
                        {member.user?.role === "admin" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                            admin
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveMember(group.id, member.userId)}
                        className="text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Member */}
                {addingMemberGroupId === group.id ? (
                  <div className="flex gap-2">
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : "")}
                      className="input-base flex-1 text-sm"
                    >
                      <option value="">{t("group.selectUser")}</option>
                      {available.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.displayName || u.username}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAddMember(group.id)}
                      disabled={!selectedUserId}
                      className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {t("common.add")}
                    </button>
                    <button
                      onClick={() => { setAddingMemberGroupId(null); setSelectedUserId(""); }}
                      className="text-xs px-2 py-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingMemberGroupId(group.id)}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-500 transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {t("group.addMember")}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
