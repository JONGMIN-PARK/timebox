import { create } from "zustand";
import { todoApi } from "@/lib/apiService";
import { showToast } from "@/components/ui/Toast";
import type { Todo } from "@timebox/shared";

// Re-export category definitions from unified config for backward compatibility
export { TODO_CATEGORIES, getCategoryInfo } from "@/lib/categories";
export type { TodoCategoryDef } from "@/lib/categories";

// ── Store ──
export type { Todo };

interface TodoState {
  todos: Todo[];
  filter: "all" | "active" | "completed";
  categoryFilter: string; // "" = all
  loading: boolean;
  error: string | null;
  setFilter: (filter: "all" | "active" | "completed") => void;
  setCategoryFilter: (cat: string) => void;
  fetchTodos: () => Promise<void>;
  addTodo: (title: string, priority?: string, dueDate?: string, category?: string) => Promise<void>;
  toggleTodo: (id: number) => Promise<void>;
  deleteTodo: (id: number) => Promise<void>;
  updateTodo: (id: number, updates: Partial<Todo>) => Promise<void>;
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
      const res = await todoApi.getAll();
      if (res.success && res.data) {
        set({ todos: res.data, loading: false });
      } else {
        const msg = res.error || "Failed to fetch todos";
        set({ error: msg, loading: false });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to fetch todos";
      set({ error: msg, loading: false });
      showToast("error", msg);
    }
  },

  addTodo: async (title, priority = "medium", dueDate?, category = "personal") => {
    // Optimistic: add temp item
    const tempId = -Date.now();
    const date = dueDate || new Date().toISOString().slice(0, 10);
    const tempTodo = { id: tempId, title, completed: false, progress: 0, priority, dueDate: date, category, sortOrder: 0, parentId: null, userId: 0, createdAt: new Date().toISOString() };
    set({ todos: [tempTodo as Todo, ...get().todos] });

    try {
      const res = await todoApi.create({ title, priority, dueDate: date, category });
      if (res.success && res.data) {
        set({ todos: get().todos.map(t => t.id === tempId ? res.data! : t) });
      } else {
        const msg = res.error || "Failed to add todo";
        set({ todos: get().todos.filter(t => t.id !== tempId), error: msg });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to add todo";
      set({ todos: get().todos.filter(t => t.id !== tempId), error: msg });
      showToast("error", msg);
    }
  },

  toggleTodo: async (id) => {
    // Optimistic update
    const prev = get().todos;
    const todo = prev.find(t => t.id === id);
    if (!todo) return;
    const newCompleted = !todo.completed;
    const newProgress = newCompleted ? 100 : (todo.progress >= 100 ? 0 : todo.progress);
    set({ todos: prev.map(t => t.id === id ? { ...t, completed: newCompleted, progress: newProgress } : t) });

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
    // Optimistic delete
    const prev = get().todos;
    set({ todos: prev.filter(t => t.id !== id) });

    try {
      const res = await todoApi.delete(id);
      if (!res.success) {
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

  updateTodo: async (id, updates) => {
    set({ error: null });
    // Optimistic update
    const prev = get().todos;
    set({ todos: prev.map(t => t.id === id ? { ...t, ...updates } : t) });

    try {
      const res = await todoApi.update(id, updates);
      if (res.success && res.data) {
        set({ todos: get().todos.map(t => t.id === id ? res.data! : t) });
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
