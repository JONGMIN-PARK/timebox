import { create } from "zustand";
import { api } from "./api";

interface CrudState<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  add: (data: Partial<T>) => Promise<T | undefined>;
  update: (id: number, data: Partial<T>) => Promise<T | undefined>;
  remove: (id: number) => Promise<boolean>;
}

export function createCrudStore<T extends { id: number }>(endpoint: string) {
  return create<CrudState<T>>((set, get) => ({
    items: [],
    loading: false,
    error: null,

    fetch: async () => {
      set({ error: null, loading: true });
      try {
        const res = await api.get<T[]>(endpoint);
        if (res.success && res.data) {
          set({ items: res.data, loading: false });
        } else {
          set({ error: res.error || "Fetch failed", loading: false });
        }
      } catch {
        set({ error: "Fetch failed", loading: false });
      }
    },

    add: async (data) => {
      set({ error: null });
      try {
        const res = await api.post<T>(endpoint, data);
        if (res.success && res.data) {
          set({ items: [...get().items, res.data] });
          return res.data;
        }
        set({ error: res.error || "Create failed" });
      } catch {
        set({ error: "Create failed" });
      }
    },

    update: async (id, data) => {
      set({ error: null });
      try {
        const res = await api.put<T>(`${endpoint}/${id}`, data);
        if (res.success && res.data) {
          set({
            items: get().items.map((item) =>
              item.id === id ? res.data! : item,
            ),
          });
          return res.data;
        }
        set({ error: res.error || "Update failed" });
      } catch {
        set({ error: "Update failed" });
      }
    },

    remove: async (id) => {
      set({ error: null });
      try {
        const res = await api.delete(`${endpoint}/${id}`);
        if (res.success) {
          set({ items: get().items.filter((item) => item.id !== id) });
          return true;
        }
        set({ error: res.error || "Delete failed" });
        return false;
      } catch {
        set({ error: "Delete failed" });
        return false;
      }
    },
  }));
}
