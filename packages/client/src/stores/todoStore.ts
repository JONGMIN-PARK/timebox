import { create } from 'zustand';
import { createMutationQueue, rollbackEntities, nextTemporaryId } from '@/lib/entityMutations';
import { todayDate } from '@/lib/dateUtils';
import { todoApi, type ApiRes } from '@/lib/apiService';
import { showToast } from '@/components/ui/Toast';
import type { Todo } from '@timebox/shared';
import { normalizeTodoStoreOrder } from '@/lib/todoSort';

// Re-export category definitions from unified config for backward compatibility
export { TODO_CATEGORIES, getCategoryInfo } from '@/lib/categories';
export type { TodoCategoryDef } from '@/lib/categories';

// ── Store ──
export type { Todo };

interface TodoState {
  todos: Todo[];
  filter: 'all' | 'waiting' | 'active' | 'completed';
  categoryFilter: string; // "" = all
  loading: boolean;
  error: string | null;
  setFilter: (filter: 'all' | 'waiting' | 'active' | 'completed') => void;
  setCategoryFilter: (cat: string) => void;
  fetchTodos: () => Promise<void>;
  addTodo: (
    title: string,
    priority?: string,
    dueDate?: string,
    category?: string,
    status?: 'waiting' | 'active' | 'completed',
    projectId?: number | null,
    memo?: string | null,
  ) => Promise<boolean>;
  toggleTodo: (id: number) => Promise<void>;
  deleteTodo: (id: number) => Promise<void>;
  restoreTodo: (id: number) => Promise<void>;
  permanentlyDeleteTodo: (id: number) => Promise<void>;
  emptyTrash: () => Promise<void>;
  updateTodo: (id: number, updates: Partial<Todo>) => Promise<void>;
  updateStatus: (id: number, status: 'waiting' | 'active' | 'completed') => Promise<void>;
  reorderTodos: (items: { id: number; sortOrder: number }[]) => Promise<void>;
}

const writes = createMutationQueue();
let fetchSequence = 0;

export const useTodoStore = create<TodoState>((set, get) => {
  const commit = (todos: Todo[]) => set({ todos: normalizeTodoStoreOrder(todos) });
  const fail = (message: string) => {
    set({ error: message });
    showToast('error', message);
  };
  const mutate = (
    ids: number[],
    optimistic: (items: Todo[]) => Todo[],
    request: () => Promise<ApiRes<Todo>>,
    message: string,
  ) =>
    writes.run(ids, async () => {
      const before = get().todos;
      set({ error: null });
      commit(optimistic(before));
      try {
        const result = await request();
        if (!result.success) throw new Error(result.error || message);
        if (result.data)
          commit(get().todos.map((item) => (item.id === result.data!.id ? result.data! : item)));
      } catch (error) {
        commit(rollbackEntities(get().todos, before, ids));
        fail(error instanceof Error ? error.message : message);
      }
    });

  return {
    todos: [],
    filter: 'all',
    categoryFilter: '',
    loading: false,
    error: null,
    setFilter: (filter) => set({ filter }),
    setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
    fetchTodos: async () => {
      const sequence = ++fetchSequence;
      set({ error: null, loading: true });
      await writes.idle();
      const revision = writes.revision;
      try {
        const [main, trash] = await Promise.all([todoApi.getAll(), todoApi.getAll('trash')]);
        if (sequence !== fetchSequence) return;
        if (revision !== writes.revision) {
          await get().fetchTodos();
          return;
        }
        if (!main.success || !main.data) throw new Error(main.error || 'Failed to fetch todos');
        commit([...main.data, ...(trash.success ? trash.data || [] : [])]);
        if (!trash.success) showToast('error', trash.error || 'Failed to fetch trash');
      } catch (error) {
        if (sequence === fetchSequence)
          fail(error instanceof Error ? error.message : 'Failed to fetch todos');
      } finally {
        if (sequence === fetchSequence) set({ loading: false });
      }
    },
    addTodo: async (
      title,
      priority = 'medium',
      dueDate,
      category = 'personal',
      status = 'active',
      projectId = null,
      memo = null,
    ) => {
      const id = nextTemporaryId();
      const date = dueDate || todayDate();
      return writes.run([id], async () => {
        const now = new Date().toISOString();
        const temp: Todo = {
          id,
          title,
          priority,
          dueDate: date,
          category,
          status,
          completed: status === 'completed',
          progress: status === 'completed' ? 100 : 0,
          sortOrder: 0,
          parentId: null,
          userId: 0,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          projectId,
          memo,
        };
        commit([temp, ...get().todos]);
        try {
          const result = await todoApi.create({
            title,
            priority,
            dueDate: date,
            category,
            status,
            projectId,
            memo,
          });
          if (!result.success || !result.data)
            throw new Error(result.error || 'Failed to add todo');
          commit(get().todos.map((item) => (item.id === id ? result.data! : item)));
          return true;
        } catch (error) {
          commit(get().todos.filter((item) => item.id !== id));
          fail(error instanceof Error ? error.message : 'Failed to add todo');
          return false;
        }
      });
    },
    toggleTodo: (id) =>
      mutate(
        [id],
        (items) => {
          const item = items.find((item) => item.id === id);
          if (!item) return items;
          const completed = !item.completed;
          return items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  completed,
                  status: completed ? 'completed' : 'active',
                  progress: completed ? 100 : item.progress >= 100 ? 0 : item.progress,
                }
              : item,
          );
        },
        () => {
          const item = get().todos.find((item) => item.id === id)!;
          return todoApi.toggle(id, {
            completed: item.completed,
            status: item.status,
            progress: item.progress,
          });
        },
        'Failed to toggle todo',
      ),
    deleteTodo: (id) =>
      mutate(
        [id],
        (items) =>
          items.map((item) =>
            item.id === id ? { ...item, deletedAt: new Date().toISOString() } : item,
          ),
        () => todoApi.delete(id),
        'Failed to delete todo',
      ),
    restoreTodo: (id) =>
      mutate(
        [id],
        (items) => items.map((item) => (item.id === id ? { ...item, deletedAt: null } : item)),
        () => todoApi.restore(id),
        'Failed to restore todo',
      ),
    permanentlyDeleteTodo: (id) =>
      mutate(
        [id],
        (items) => items.filter((item) => item.id !== id),
        () => todoApi.deletePermanent(id),
        'Failed to permanently delete todo',
      ),
    emptyTrash: async () => {
      const ids = get()
        .todos.filter((item) => item.deletedAt)
        .map((item) => item.id);
      await mutate(
        ids,
        (items) => items.filter((item) => !ids.includes(item.id)),
        async () => {
          const result = await todoApi.emptyTrash();
          return { success: result.success, error: result.error };
        },
        'Failed to empty trash',
      );
    },
    updateTodo: (id, updates) =>
      mutate(
        [id],
        (items) => items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
        () => todoApi.update(id, updates),
        'Failed to update todo',
      ),
    updateStatus: (id, status) =>
      mutate(
        [id],
        (items) =>
          items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status,
                  completed: status === 'completed',
                  progress: status === 'completed' ? 100 : status === 'waiting' ? 0 : item.progress,
                }
              : item,
          ),
        () => todoApi.updateStatus(id, status),
        'Failed to update status',
      ),
    reorderTodos: (items) =>
      mutate(
        items.map((item) => item.id),
        (todos) =>
          todos.map((todo) => {
            const update = items.find((item) => item.id === todo.id);
            return update ? { ...todo, sortOrder: update.sortOrder } : todo;
          }),
        async () => {
          const result = await todoApi.reorder(items);
          return { success: result.success, error: result.error };
        },
        'Failed to reorder todos',
      ),
  };
});
