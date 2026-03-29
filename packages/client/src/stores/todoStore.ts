import { create } from "zustand";
import { todoApi } from "@/lib/apiService";
import { showToast } from "@/components/ui/Toast";
import type { Todo } from "@timebox/shared";
import { normalizeTodoStoreOrder } from "@/lib/todoSort";

// Re-export category definitions from unified config for backward compatibility
export { TODO_CATEGORIES, getCategoryInfo } from "@/lib/categories";
export type { TodoCategoryDef } from "@/lib/categories";

// ── Store ──
export type { Todo };

interface TodoState {
  todos: Todo[];
  filter: "all" | "waiting" | "active" | "completed";
  categoryFilter: string; // "" = all
  loading: boolean;
  error: string | null;
  setFilter: (filter: "all" | "waiting" | "active" | "completed") => void;
  setCategoryFilter: (cat: string) => void;
  fetchTodos: () => Promise<void>;
  addTodo: (title: string, priority?: string, dueDate?: string, category?: string, status?: 'waiting' | 'active' | 'completed', projectId?: number | null) => Promise<boolean>;
  toggleTodo: (id: number) => Promise<void>;
  deleteTodo: (id: number) => Promise<void>;
  restoreTodo: (id: number) => Promise<void>;
  permanentlyDeleteTodo: (id: number) => Promise<void>;
  emptyTrash: () => Promise<void>;
  updateTodo: (id: number, updates: Partial<Todo>) => Promise<void>;
  updateStatus: (id: number, status: 'waiting' | 'active' | 'completed') => Promise<void>;
  reorderTodos: (items: { id: number; sortOrder: number }[]) => Promise<void>;
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],
  filter: "all",
  categoryFilter: "",
  loading: false,
  error: null,

  setFilter: (filter) => set({ filter }),
  setCategoryFilter: (cat) => set({ categoryFilter: cat }),

  fetchTodos: async () => {
    set({ error: null, loading: true });
    try {
      const [main, trash] = await Promise.all([todoApi.getAll(), todoApi.getAll("trash")]);
      if (main.success && main.data && trash.success && trash.data) {
        set({ todos: normalizeTodoStoreOrder([...main.data, ...trash.data]), loading: false });
      } else if (main.success && main.data) {
        set({ todos: normalizeTodoStoreOrder(main.data), loading: false });
        if (!trash.success && trash.error) {
          showToast("error", trash.error);
        }
      } else {
        const msg = main.error || "Failed to fetch todos";
        set({ error: msg, loading: false });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to fetch todos";
      set({ error: msg, loading: false });
      showToast("error", msg);
    }
  },

  addTodo: async (title, priority = "medium", dueDate?, category = "personal", status = "active", projectId: number | null = null) => {
    // Optimistic: add temp item
    const tempId = -Date.now();
    const date = dueDate || new Date().toISOString().slice(0, 10);
    const tempTodo = { id: tempId, title, completed: status === 'completed', progress: status === 'completed' ? 100 : 0, status, priority, dueDate: date, category, sortOrder: 0, parentId: null, userId: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null as string | null, projectId: projectId ?? null };
    set({ todos: normalizeTodoStoreOrder([tempTodo as Todo, ...get().todos]) });

    try {
      const res = await todoApi.create({ title, priority, dueDate: date, category, status, projectId: projectId ?? undefined });
      if (res.success && res.data) {
        set({ todos: normalizeTodoStoreOrder(get().todos.map(t => t.id === tempId ? res.data! : t)) });
        return true;
      } else {
        const msg = res.error || "Failed to add todo";
        set({ todos: get().todos.filter(t => t.id !== tempId), error: msg });
        showToast("error", msg);
        return false;
      }
    } catch {
      const msg = "Failed to add todo";
      set({ todos: get().todos.filter(t => t.id !== tempId), error: msg });
      showToast("error", msg);
      return false;
    }
  },

  toggleTodo: async (id) => {
    // Optimistic update
    const prev = get().todos;
    const todo = prev.find(t => t.id === id);
    if (!todo) return;
    const newCompleted = !todo.completed;
    const newProgress = newCompleted ? 100 : (todo.progress >= 100 ? 0 : todo.progress);
    set({ todos: normalizeTodoStoreOrder(prev.map(t => t.id === id ? { ...t, completed: newCompleted, progress: newProgress } : t)) });

    try {
      const res = await todoApi.toggle(id, { completed: newCompleted, progress: newProgress });
      if (!res.success) {
        set({ todos: prev });
        const msg = res.error || "Failed to toggle todo";
        set({ error: msg });
        showToast("error", msg);
      }
    } catch {
      set({ todos: prev });
      const msg = "Failed to toggle todo";
      set({ error: msg });
      showToast("error", msg);
    }
  },

  deleteTodo: async (id) => {
    set({ error: null });
    const prev = get().todos;
    const now = new Date().toISOString();
    set({
      todos: normalizeTodoStoreOrder(prev.map((t) => (t.id === id ? { ...t, deletedAt: now, updatedAt: now } : t))),
    });

    try {
      const res = await todoApi.delete(id);
      if (res.success && res.data) {
        set({ todos: normalizeTodoStoreOrder(get().todos.map((t) => (t.id === id ? res.data! : t))) });
      } else {
        const msg = res.error || "Failed to delete todo";
        set({ todos: prev, error: msg });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to delete todo";
      set({ todos: prev, error: msg });
      showToast("error", msg);
    }
  },

  restoreTodo: async (id) => {
    set({ error: null });
    const prev = get().todos;
    set({
      todos: normalizeTodoStoreOrder(prev.map((t) => (t.id === id ? { ...t, deletedAt: null, updatedAt: new Date().toISOString() } : t))),
    });
    try {
      const res = await todoApi.restore(id);
      if (res.success && res.data) {
        set({ todos: normalizeTodoStoreOrder(get().todos.map((t) => (t.id === id ? res.data! : t))) });
      } else {
        set({ todos: prev });
        const msg = res.error || "Failed to restore todo";
        set({ error: msg });
        showToast("error", msg);
      }
    } catch {
      set({ todos: prev });
      const msg = "Failed to restore todo";
      set({ error: msg });
      showToast("error", msg);
    }
  },

  permanentlyDeleteTodo: async (id) => {
    set({ error: null });
    const prev = get().todos;
    set({ todos: normalizeTodoStoreOrder(prev.filter((t) => t.id !== id)) });
    try {
      const res = await todoApi.deletePermanent(id);
      if (!res.success) {
        set({ todos: prev });
        const msg = res.error || "Failed to permanently delete";
        set({ error: msg });
        showToast("error", msg);
      }
    } catch {
      set({ todos: prev });
      const msg = "Failed to permanently delete";
      set({ error: msg });
      showToast("error", msg);
    }
  },

  emptyTrash: async () => {
    set({ error: null });
    const prev = get().todos;
    set({ todos: normalizeTodoStoreOrder(prev.filter((t) => !t.deletedAt)) });
    try {
      const res = await todoApi.emptyTrash();
      if (!res.success) {
        set({ todos: prev });
        const msg = res.error || "Failed to empty trash";
        set({ error: msg });
        showToast("error", msg);
      }
    } catch {
      set({ todos: prev });
      const msg = "Failed to empty trash";
      set({ error: msg });
      showToast("error", msg);
    }
  },

  updateTodo: async (id, updates) => {
    set({ error: null });
    // Optimistic update
    const prev = get().todos;
    set({ todos: normalizeTodoStoreOrder(prev.map(t => t.id === id ? { ...t, ...updates } : t)) });

    try {
      const res = await todoApi.update(id, updates);
      if (res.success && res.data) {
        set({ todos: normalizeTodoStoreOrder(get().todos.map(t => t.id === id ? res.data! : t)) });
      } else {
        const msg = res.error || "Failed to update todo";
        set({ todos: prev, error: msg });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to update todo";
      set({ todos: prev, error: msg });
      showToast("error", msg);
    }
  },

  updateStatus: async (id, status) => {
    const prev = get().todos;
    const todo = prev.find(t => t.id === id);
    if (!todo) return;
    const updates: Partial<Todo> = { status };
    if (status === 'completed') { updates.completed = true; updates.progress = 100; }
    else if (status === 'active') { updates.completed = false; }
    else if (status === 'waiting') { updates.completed = false; updates.progress = 0; }
    set({ todos: normalizeTodoStoreOrder(prev.map(t => t.id === id ? { ...t, ...updates } : t)) });

    try {
      const res = await todoApi.updateStatus(id, status);
      if (res.success && res.data) {
        set({ todos: normalizeTodoStoreOrder(get().todos.map(t => t.id === id ? res.data! : t)) });
        showToast("success", status === 'completed' ? "Todo completed" : status === 'waiting' ? "Todo set to waiting" : "Todo activated");
      } else {
        set({ todos: prev });
        const msg = res.error || "Failed to update status";
        set({ error: msg });
        showToast("error", msg);
      }
    } catch {
      set({ todos: prev });
      const msg = "Failed to update status";
      set({ error: msg });
      showToast("error", msg);
    }
  },

  reorderTodos: async (items) => {
    set({ error: null });
    // Optimistic reorder
    const prev = get().todos;
    const todosMap = new Map(get().todos.map((t) => [t.id, t]));
    items.forEach(({ id, sortOrder }) => {
      const todo = todosMap.get(id);
      if (todo) todosMap.set(id, { ...todo, sortOrder });
    });
    set({ todos: Array.from(todosMap.values()) });

    try {
      const res = await todoApi.reorder(items);
      if (!res.success) {
        set({ todos: prev });
        const msg = res.error || "Failed to reorder todos";
        set({ error: msg });
        showToast("error", msg);
      }
    } catch {
      set({ todos: prev });
      const msg = "Failed to reorder todos";
      set({ error: msg });
      showToast("error", msg);
    }
  },
}));
