import { create } from "zustand";
import { api } from "@/lib/api";

// ── Category definitions ──
export interface TodoCategoryDef {
  id: string;
  label: string;
  icon: string;
  color: string;
  children?: { id: string; label: string }[];
}

export const TODO_CATEGORIES: TodoCategoryDef[] = [
  {
    id: "work", label: "Work", icon: "💼", color: "#3b82f6",
    children: [
      { id: "work.meeting", label: "Meeting" },
      { id: "work.proposal", label: "Proposal" },
      { id: "work.dev", label: "Development" },
      { id: "work.review", label: "Review" },
      { id: "work.report", label: "Report" },
      { id: "work.other", label: "Other" },
    ],
  },
  {
    id: "personal", label: "Personal", icon: "🏠", color: "#8b5cf6",
    children: [
      { id: "personal.errand", label: "Errand" },
      { id: "personal.health", label: "Health" },
      { id: "personal.finance", label: "Finance" },
      { id: "personal.other", label: "Other" },
    ],
  },
  {
    id: "study", label: "Study", icon: "📚", color: "#f59e0b",
    children: [
      { id: "study.course", label: "Course" },
      { id: "study.reading", label: "Reading" },
      { id: "study.research", label: "Research" },
    ],
  },
  {
    id: "project", label: "Project", icon: "🚀", color: "#10b981",
    children: [
      { id: "project.planning", label: "Planning" },
      { id: "project.design", label: "Design" },
      { id: "project.implementation", label: "Implementation" },
    ],
  },
  { id: "urgent", label: "Urgent", icon: "🔥", color: "#ef4444" },
  { id: "idea", label: "Idea", icon: "💡", color: "#06b6d4" },
];

export function getCategoryInfo(catId: string): { label: string; icon: string; color: string; parentLabel?: string } {
  for (const cat of TODO_CATEGORIES) {
    if (cat.id === catId) return { label: cat.label, icon: cat.icon, color: cat.color };
    if (cat.children) {
      const child = cat.children.find((c) => c.id === catId);
      if (child) return { label: child.label, icon: cat.icon, color: cat.color, parentLabel: cat.label };
    }
  }
  return { label: catId, icon: "📌", color: "#94a3b8" };
}

// ── Store ──
export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  priority: string;
  category: string;
  dueDate: string | null;
  sortOrder: number;
  parentId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface TodoState {
  todos: Todo[];
  filter: "all" | "active" | "completed";
  categoryFilter: string; // "" = all
  loading: boolean;
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

  setFilter: (filter) => set({ filter }),
  setCategoryFilter: (cat) => set({ categoryFilter: cat }),

  fetchTodos: async () => {
    set({ loading: true });
    const res = await api.get<Todo[]>("/todos");
    if (res.success && res.data) {
      set({ todos: res.data, loading: false });
    } else {
      set({ loading: false });
    }
  },

  addTodo: async (title, priority = "medium", dueDate?, category = "personal") => {
    const date = dueDate || new Date().toISOString().slice(0, 10);
    const res = await api.post<Todo>("/todos", { title, priority, dueDate: date, category });
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

  reorderTodos: async (items) => {
    const todosMap = new Map(get().todos.map((t) => [t.id, t]));
    items.forEach(({ id, sortOrder }) => {
      const todo = todosMap.get(id);
      if (todo) todosMap.set(id, { ...todo, sortOrder });
    });
    set({ todos: Array.from(todosMap.values()) });
    await api.put("/todos/reorder", { items });
  },
}));
