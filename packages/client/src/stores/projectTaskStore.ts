import { create } from "zustand";
import { api } from "@/lib/api";

export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";

export interface ProjectTask {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string;
  assigneeId: number | null;
  reporterId: number;
  dueDate: string | null;
  tags: string;
  sortOrder: number;
  parentId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface ProjectTaskState {
  tasks: ProjectTask[];
  loading: boolean;
  error: string | null;
  fetchTasks: (projectId: number) => Promise<void>;
  addTask: (projectId: number, data: Partial<ProjectTask>) => Promise<ProjectTask | undefined>;
  updateTask: (projectId: number, taskId: number, data: Partial<ProjectTask>) => Promise<void>;
  deleteTask: (projectId: number, taskId: number) => Promise<void>;
  reorderTasks: (projectId: number, items: { id: number; sortOrder: number; status: string }[]) => Promise<void>;
}

export const useProjectTaskStore = create<ProjectTaskState>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,

  fetchTasks: async (projectId) => {
    set({ error: null, loading: true });
    try {
      const res = await api.get<ProjectTask[]>(`/projects/${projectId}/tasks`);
      if (res.success && res.data) set({ tasks: res.data, loading: false });
      else set({ error: "Failed", loading: false });
    } catch {
      set({ error: "Failed", loading: false });
    }
  },

  addTask: async (projectId, data) => {
    set({ error: null });
    try {
      const res = await api.post<ProjectTask>(`/projects/${projectId}/tasks`, data);
      if (res.success && res.data) {
        set({ tasks: [...get().tasks, res.data] });
        return res.data;
      }
    } catch {
      set({ error: "Failed to add task" });
    }
  },

  updateTask: async (projectId, taskId, data) => {
    set({ error: null });
    try {
      const res = await api.put<ProjectTask>(`/projects/${projectId}/tasks/${taskId}`, data);
      if (res.success && res.data) {
        set({ tasks: get().tasks.map(t => t.id === taskId ? res.data! : t) });
      }
    } catch {
      set({ error: "Failed to update task" });
    }
  },

  deleteTask: async (projectId, taskId) => {
    set({ error: null });
    try {
      const res = await api.delete(`/projects/${projectId}/tasks/${taskId}`);
      if (res.success) {
        set({ tasks: get().tasks.filter(t => t.id !== taskId) });
      }
    } catch {
      set({ error: "Failed to delete task" });
    }
  },

  reorderTasks: async (projectId, items) => {
    try {
      await api.put(`/projects/${projectId}/tasks/reorder`, { items });
    } catch {
      // silent fail for reorder
    }
  },
}));
