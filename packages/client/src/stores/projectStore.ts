import { create } from "zustand";
import { projectApi } from "@/lib/apiService";
import { showToast } from "@/components/ui/Toast";

export interface Project {
  id: number;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  ownerId: number;
  visibility: string;
  teamGroupId?: number | null;
  archived?: boolean;
  memberCount?: number;
  myRole?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: number;
  projectId: number;
  userId: number;
  role: string;
  username?: string;
  displayName?: string;
  joinedAt: string;
}

interface ProjectState {
  projects: Project[];
  activeProjectId: number | null;
  loading: boolean;
  error: string | null;
  setActiveProject: (id: number | null) => void;
  fetchProjects: () => Promise<void>;
  createProject: (data: { name: string; description?: string; color?: string; icon?: string; teamGroupId?: number; startDate?: string; targetDate?: string; docs?: string }) => Promise<Project | undefined>;
  updateProject: (id: number, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: number) => Promise<void>;
  fetchMembers: (projectId: number) => Promise<ProjectMember[]>;
  inviteMember: (projectId: number, username: string, role?: string) => Promise<void>;
  removeMember: (projectId: number, userId: number) => Promise<void>;
  archiveProject: (projectId: number) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  loading: false,
  error: null,

  setActiveProject: (id) => set({ activeProjectId: id }),

  fetchProjects: async () => {
    set({ error: null, loading: true });
    try {
      const res = await projectApi.getAll();
      if (res.success && res.data) {
        set({ projects: res.data, loading: false });
      } else {
        const msg = res.error || "Failed to fetch projects";
        set({ error: msg, loading: false });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to fetch projects";
      set({ error: msg, loading: false });
      showToast("error", msg);
    }
  },

  createProject: async (data) => {
    set({ error: null });
    try {
      const res = await projectApi.create(data);
      if (res.success && res.data) {
        set({ projects: [...get().projects, res.data] });
        return res.data;
      }
      const msg = res.error || "Failed to create project";
      set({ error: msg });
      showToast("error", msg);
    } catch {
      const msg = "Failed to create project";
      set({ error: msg });
      showToast("error", msg);
    }
  },

  updateProject: async (id, data) => {
    set({ error: null });
    // Optimistic update
    const prev = get().projects;
    set({ projects: prev.map(p => p.id === id ? { ...p, ...data } : p) });

    try {
      const res = await projectApi.update(id, data);
      if (res.success && res.data) {
        set({ projects: get().projects.map(p => p.id === id ? { ...p, ...res.data } : p) });
      } else {
        const msg = res.error || "Failed to update project";
        set({ projects: prev, error: msg });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to update project";
      set({ projects: prev, error: msg });
      showToast("error", msg);
    }
  },

  deleteProject: async (id) => {
    set({ error: null });
    // Optimistic delete
    const prev = get().projects;
    set({ projects: prev.filter(p => p.id !== id), activeProjectId: get().activeProjectId === id ? null : get().activeProjectId });

    try {
      const res = await projectApi.delete(id);
      if (!res.success) {
        const msg = res.error || "Failed to delete project";
        set({ projects: prev, error: msg });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to delete project";
      set({ projects: prev, error: msg });
      showToast("error", msg);
    }
  },

  fetchMembers: async (projectId) => {
    try {
      const res = await projectApi.getMembers(projectId);
      return res.data || [];
    } catch {
      return [];
    }
  },

  inviteMember: async (projectId, username, role) => {
    set({ error: null });
    try {
      const res = await projectApi.inviteMember(projectId, username, role);
      if (!res.success) {
        const msg = res.error || "Failed to invite member";
        set({ error: msg });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to invite member";
      set({ error: msg });
      showToast("error", msg);
    }
  },

  removeMember: async (projectId, userId) => {
    set({ error: null });
    try {
      const res = await projectApi.removeMember(projectId, userId);
      if (!res.success) {
        const msg = res.error || "Failed to remove member";
        set({ error: msg });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to remove member";
      set({ error: msg });
      showToast("error", msg);
    }
  },

  archiveProject: async (projectId) => {
    set({ error: null });
    // Optimistic update
    const prev = get().projects;
    const project = prev.find(p => p.id === projectId);
    if (project) {
      set({ projects: prev.map(p => p.id === projectId ? { ...p, archived: !p.archived } : p) });
    }

    try {
      const res = await projectApi.archive(projectId);
      if (res.success && res.data) {
        set({
          projects: get().projects.map(p =>
            p.id === projectId ? { ...p, archived: res.data!.archived } : p
          ),
        });
      } else {
        const msg = res.error || "Failed to archive project";
        set({ projects: prev, error: msg });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to archive project";
      set({ projects: prev, error: msg });
      showToast("error", msg);
    }
  },
}));
