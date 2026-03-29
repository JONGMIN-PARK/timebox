import { create } from "zustand";
import { ddayApi } from "@/lib/apiService";
import { showToast } from "@/components/ui/Toast";
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
      const res = await ddayApi.getAll();
      if (res.success && res.data) {
        set({ ddays: res.data, loading: false });
      } else {
        const msg = res.error || "Failed to fetch d-days";
        set({ error: msg, loading: false });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to fetch d-days";
      set({ error: msg, loading: false });
      showToast("error", msg);
    }
  },

  addDDay: async (title, targetDate, color) => {
    set({ error: null });
    // Optimistic add
    const tempId = -Date.now();
    const tempDDay = { id: tempId, title, targetDate, color: color || "#3b82f6", userId: 0, createdAt: new Date().toISOString() } as DDay;
    set({ ddays: [...get().ddays, tempDDay] });

    try {
      const res = await ddayApi.create({ title, targetDate, color });
      if (res.success && res.data) {
        set({ ddays: get().ddays.map(d => d.id === tempId ? res.data! : d) });
      } else {
        const msg = res.error || "Failed to add d-day";
        set({ ddays: get().ddays.filter(d => d.id !== tempId), error: msg });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to add d-day";
      set({ ddays: get().ddays.filter(d => d.id !== tempId), error: msg });
      showToast("error", msg);
    }
  },

  updateDDay: async (id, updates) => {
    set({ error: null });
    // Optimistic update
    const prev = get().ddays;
    set({ ddays: prev.map(d => d.id === id ? { ...d, ...updates } : d) });

    try {
      const res = await ddayApi.update(id, updates);
      if (res.success && res.data) {
        set({ ddays: get().ddays.map(d => d.id === id ? res.data! : d) });
      } else {
        const msg = res.error || "Failed to update d-day";
        set({ ddays: prev, error: msg });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to update d-day";
      set({ ddays: prev, error: msg });
      showToast("error", msg);
    }
  },

  deleteDDay: async (id) => {
    set({ error: null });
    // Optimistic delete
    const prev = get().ddays;
    set({ ddays: prev.filter(d => d.id !== id) });

    try {
      const res = await ddayApi.delete(id);
      if (!res.success) {
        const msg = res.error || "Failed to delete d-day";
        set({ ddays: prev, error: msg });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to delete d-day";
      set({ ddays: prev, error: msg });
      showToast("error", msg);
    }
  },
}));
