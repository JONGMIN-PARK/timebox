import { create } from "zustand";
import { projectTaskApi } from "@/lib/apiService";
import { showToast } from "@/components/ui/Toast";

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
  startDate: string | null;
  tags: string;
  sortOrder: number;
  parentId: number | null;
  createdAt: string;
  updatedAt: string;
  reactions?: Record<string, number>;
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
      const res = await projectTaskApi.getAll(projectId);
      if (res.success && res.data) {
        set({ tasks: res.data, loading: false });
      } else {
        const msg = res.error || "Failed to fetch tasks";
        set({ error: msg, loading: false });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to fetch tasks";
      set({ error: msg, loading: false });
      showToast("error", msg);
    }
  },

  addTask: async (projectId, data) => {
    set({ error: null });
    try {
      const res = await projectTaskApi.create(projectId, data);
      if (res.success && res.data) {
        set({ tasks: [...get().tasks, res.data] });
        return res.data;
      }
      const msg = res.error || "Failed to add task";
      set({ error: msg });
      showToast("error", msg);
    } catch {
      const msg = "Failed to add task";
      set({ error: msg });
      showToast("error", msg);
    }
  },

  updateTask: async (projectId, taskId, data) => {
    set({ error: null });
    // Optimistic update
    const prev = get().tasks;
    set({ tasks: prev.map(t => t.id === taskId ? { ...t, ...data } : t) });

    try {
      const res = await projectTaskApi.update(projectId, taskId, data);
      if (res.success && res.data) {
        set({ tasks: get().tasks.map(t => t.id === taskId ? res.data! : t) });
      } else {
        const msg = res.error || "Failed to update task";
        set({ tasks: prev, error: msg });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to update task";
      set({ tasks: prev, error: msg });
      showToast("error", msg);
    }
  },

  deleteTask: async (projectId, taskId) => {
    set({ error: null });
    // Optimistic delete
    const prev = get().tasks;
    set({ tasks: prev.filter(t => t.id !== taskId) });

    try {
      const res = await projectTaskApi.delete(projectId, taskId);
      if (!res.success) {
        const msg = res.error || "Failed to delete task";
        set({ tasks: prev, error: msg });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to delete task";
      set({ tasks: prev, error: msg });
      showToast("error", msg);
    }
  },

  reorderTasks: async (projectId, items) => {
    // Optimistic reorder
    const prev = get().tasks;
    const taskMap = new Map(get().tasks.map(t => [t.id, t]));
    items.forEach(({ id, sortOrder, status }) => {
      const task = taskMap.get(id);
      if (task) taskMap.set(id, { ...task, sortOrder, status: status as TaskStatus });
    });
    set({ tasks: Array.from(taskMap.values()) });

    try {
      const res = await projectTaskApi.reorder(projectId, items);
      if (!res.success) {
        set({ tasks: prev });
        const msg = res.error || "Failed to reorder tasks";
        set({ error: msg });
        showToast("error", msg);
      }
    } catch {
      set({ tasks: prev });
      const msg = "Failed to reorder tasks";
      set({ error: msg });
      showToast("error", msg);
    }
  },
}));
