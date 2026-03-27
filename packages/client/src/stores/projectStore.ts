import { create } from "zustand";
import { api } from "@/lib/api";

export interface Project {
  id: number;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  ownerId: number;
  visibility: string;
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
  createProject: (data: { name: string; description?: string; color?: string; icon?: string }) => Promise<Project | undefined>;
  updateProject: (id: number, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: number) => Promise<void>;
  fetchMembers: (projectId: number) => Promise<ProjectMember[]>;
  inviteMember: (projectId: number, username: string, role?: string) => Promise<void>;
  removeMember: (projectId: number, userId: number) => Promise<void>;
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
      const res = await api.get<Project[]>("/projects");
      if (res.success && res.data) {
        set({ projects: res.data, loading: false });
      } else {
        set({ error: res.error || "Failed", loading: false });
      }
    } catch {
      set({ error: "Failed to fetch projects", loading: false });
    }
  },

  createProject: async (data) => {
    set({ error: null });
    try {
      const res = await api.post<Project>("/projects", data);
      if (res.success && res.data) {
        set({ projects: [...get().projects, res.data] });
        return res.data;
      }
      set({ error: res.error || "Failed" });
    } catch {
      set({ error: "Failed to create project" });
    }
  },

  updateProject: async (id, data) => {
    set({ error: null });
    try {
      const res = await api.put<Project>(`/projects/${id}`, data);
      if (res.success && res.data) {
        set({ projects: get().projects.map(p => p.id === id ? { ...p, ...res.data } : p) });
      }
    } catch {
      set({ error: "Failed to update project" });
    }
  },

  deleteProject: async (id) => {
    set({ error: null });
    try {
      const res = await api.delete(`/projects/${id}`);
      if (res.success) {
        set({ projects: get().projects.filter(p => p.id !== id), activeProjectId: null });
      }
    } catch {
      set({ error: "Failed to delete project" });
    }
  },

  fetchMembers: async (projectId) => {
    try {
      const res = await api.get<ProjectMember[]>(`/projects/${projectId}/members`);
      return res.data || [];
    } catch {
      return [];
    }
  },

  inviteMember: async (projectId, username, role) => {
    set({ error: null });
    try {
      await api.post(`/projects/${projectId}/members`, { username, role });
    } catch {
      set({ error: "Failed to invite member" });
    }
  },

  removeMember: async (projectId, userId) => {
    set({ error: null });
    try {
      await api.delete(`/projects/${projectId}/members/${userId}`);
    } catch {
      set({ error: "Failed to remove member" });
    }
  },
}));
