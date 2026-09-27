import { create } from 'zustand';
import { createListMutations } from '@/lib/listMutations';
import { projectTaskApi } from '@/lib/apiService';
import { showToast } from '@/components/ui/Toast';

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';

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
  projectId: number | null;
  loading: boolean;
  error: string | null;
  fetchTasks: (projectId: number) => Promise<void>;
  addTask: (projectId: number, data: Partial<ProjectTask>) => Promise<ProjectTask | undefined>;
  updateTask: (projectId: number, taskId: number, data: Partial<ProjectTask>) => Promise<void>;
  deleteTask: (projectId: number, taskId: number) => Promise<void>;
  reorderTasks: (
    projectId: number,
    items: { id: number; sortOrder: number; status: string }[],
  ) => Promise<void>;
}

export const useProjectTaskStore = create<ProjectTaskState>((set, get) => {
  let sequence = 0;
  const actions = createListMutations<ProjectTask>(
    () => get().tasks,
    (tasks) => set({ tasks, error: null }),
    (error) => {
      set({ error });
      showToast('error', error);
    },
  );
  return {
    tasks: [],
    projectId: null,
    loading: false,
    error: null,
    fetchTasks: async (projectId) => {
      const request = ++sequence;
      set({
        projectId,
        ...(get().projectId === projectId ? {} : { tasks: [] }),
        loading: true,
        error: null,
      });
      await actions.queue.idle();
      const revision = actions.queue.revision;
      const current = () => sequence === request && get().projectId === projectId;
      try {
        const result = await projectTaskApi.getAll(projectId);
        if (!current()) return;
        if (revision !== actions.queue.revision) {
          await get().fetchTasks(projectId);
          return;
        }
        if (!result.success || !result.data)
          throw new Error(result.error || 'Failed to fetch tasks');
        set({ tasks: result.data, loading: false });
      } catch (error) {
        if (current()) {
          const message = error instanceof Error ? error.message : 'Failed to fetch tasks';
          set({ error: message, loading: false });
          showToast('error', message);
        }
      }
    },
    addTask: async (projectId, data) =>
      actions.queue.run([-projectId], async () => {
        try {
          const result = await projectTaskApi.create(projectId, data);
          if (!result.success || !result.data)
            throw new Error(result.error || 'Failed to add task');
          if (get().projectId === projectId)
            set({ tasks: [...get().tasks, result.data], error: null });
          return result.data;
        } catch (error) {
          showToast('error', error instanceof Error ? error.message : 'Failed to add task');
          return undefined;
        }
      }),
    updateTask: async (projectId, taskId, data) => {
      await actions.mutate(
        [taskId],
        () => get().projectId === projectId,
        (items) => items.map((item) => (item.id === taskId ? { ...item, ...data } : item)),
        () => projectTaskApi.update(projectId, taskId, data),
        'Failed to update task',
      );
    },
    deleteTask: async (projectId, taskId) => {
      await actions.mutate(
        [taskId],
        () => get().projectId === projectId,
        (items) => items.filter((item) => item.id !== taskId),
        () => projectTaskApi.delete(projectId, taskId),
        'Failed to delete task',
      );
    },
    reorderTasks: async (projectId, items) => {
      await actions.mutate(
        items.map((item) => item.id),
        () => get().projectId === projectId,
        (tasks) =>
          tasks.map((task) => {
            const update = items.find((item) => item.id === task.id);
            return update
              ? { ...task, sortOrder: update.sortOrder, status: update.status as TaskStatus }
              : task;
          }),
        async () => {
          const result = await projectTaskApi.reorder(projectId, items);
          return { success: result.success, error: result.error };
        },
        'Failed to reorder tasks',
      );
    },
  };
});
