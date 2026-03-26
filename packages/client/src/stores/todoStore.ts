import { create } from "zustand";
import { api } from "@/lib/api";

interface Todo {
  id: number;
  title: string;
  completed: boolean;
  priority: string;
  dueDate: string | null;
  sortOrder: number;
  parentId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface TodoState {
  todos: Todo[];
  filter: "all" | "active" | "completed";
  loading: boolean;
  setFilter: (filter: "all" | "active" | "completed") => void;
  fetchTodos: () => Promise<void>;
  addTodo: (title: string, priority?: string) => Promise<void>;
  toggleTodo: (id: number) => Promise<void>;
  deleteTodo: (id: number) => Promise<void>;
  updateTodo: (id: number, updates: Partial<Todo>) => Promise<void>;
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],
  filter: "all",
  loading: false,

  setFilter: (filter) => set({ filter }),

  fetchTodos: async () => {
    set({ loading: true });
    const res = await api.get<Todo[]>("/todos");
    if (res.success && res.data) {
      set({ todos: res.data, loading: false });
    } else {
      set({ loading: false });
    }
  },

  addTodo: async (title, priority = "medium") => {
    const res = await api.post<Todo>("/todos", { title, priority });
    if (res.success && res.data) {
      set({ todos: [...get().todos, res.data] });
    }
  },

  toggleTodo: async (id) => {
    const todo = get().todos.find((t) => t.id === id);
    if (!todo) return;
    const res = await api.put<Todo>(`/todos/${id}`, { completed: !todo.completed });
    if (res.success && res.data) {
      set({ todos: get().todos.map((t) => (t.id === id ? res.data! : t)) });
    }
  },

  deleteTodo: async (id) => {
    const res = await api.delete(`/todos/${id}`);
    if (res.success) {
      set({ todos: get().todos.filter((t) => t.id !== id) });
    }
  },

  updateTodo: async (id, updates) => {
    const res = await api.put<Todo>(`/todos/${id}`, updates);
    if (res.success && res.data) {
      set({ todos: get().todos.map((t) => (t.id === id ? res.data! : t)) });
    }
  },
}));
