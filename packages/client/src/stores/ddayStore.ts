import { create } from "zustand";
import { api } from "@/lib/api";
import type { DDay } from "@timebox/shared";

interface DDayState {
  ddays: DDay[];
  loading: boolean;
  error: string | null;
  fetchDDays: () => Promise<void>;
  addDDay: (title: string, targetDate: string, color?: string) => Promise<void>;
  updateDDay: (id: number, updates: Partial<DDay>) => Promise<void>;
  deleteDDay: (id: number) => Promise<void>;
}

export const useDDayStore = create<DDayState>((set, get) => ({
  ddays: [],
  loading: false,
  error: null,

  fetchDDays: async () => {
    set({ error: null, loading: true });
    try {
      const res = await api.get<DDay[]>("/ddays");
      if (res.success && res.data) {
        set({ ddays: res.data, loading: false });
      } else {
        set({ error: res.error || "Failed to fetch d-days", loading: false });
      }
    } catch {
      set({ error: "Failed to fetch d-days", loading: false });
    }
  },

  addDDay: async (title, targetDate, color) => {
    set({ error: null });
    try {
      const res = await api.post<DDay>("/ddays", { title, targetDate, color });
      if (res.success && res.data) {
        set({ ddays: [...get().ddays, res.data] });
      } else {
        set({ error: res.error || "Failed to add d-day" });
      }
    } catch {
      set({ error: "Failed to add d-day" });
    }
  },

  updateDDay: async (id, updates) => {
    set({ error: null });
    try {
      const res = await api.put<DDay>(`/ddays/${id}`, updates);
      if (res.success && res.data) {
        set({ ddays: get().ddays.map((d) => (d.id === id ? res.data! : d)) });
      } else {
        set({ error: res.error || "Failed to update d-day" });
      }
    } catch {
      set({ error: "Failed to update d-day" });
    }
  },

  deleteDDay: async (id) => {
    set({ error: null });
    try {
      const res = await api.delete(`/ddays/${id}`);
      if (res.success) {
        set({ ddays: get().ddays.filter((d) => d.id !== id) });
      } else {
        set({ error: res.error || "Failed to delete d-day" });
      }
    } catch {
      set({ error: "Failed to delete d-day" });
    }
  },
}));
