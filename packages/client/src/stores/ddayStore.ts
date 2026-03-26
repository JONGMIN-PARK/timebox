import { create } from "zustand";
import { api } from "@/lib/api";

interface DDay {
  id: number;
  title: string;
  targetDate: string;
  color: string;
  icon: string | null;
  daysLeft: number;
  createdAt: string;
  updatedAt: string;
}

interface DDayState {
  ddays: DDay[];
  loading: boolean;
  fetchDDays: () => Promise<void>;
  addDDay: (title: string, targetDate: string, color?: string) => Promise<void>;
  updateDDay: (id: number, updates: Partial<DDay>) => Promise<void>;
  deleteDDay: (id: number) => Promise<void>;
}

export const useDDayStore = create<DDayState>((set, get) => ({
  ddays: [],
  loading: false,

  fetchDDays: async () => {
    set({ loading: true });
    const res = await api.get<DDay[]>("/ddays");
    if (res.success && res.data) {
      set({ ddays: res.data, loading: false });
    } else {
      set({ loading: false });
    }
  },

  addDDay: async (title, targetDate, color) => {
    const res = await api.post<DDay>("/ddays", { title, targetDate, color });
    if (res.success && res.data) {
      set({ ddays: [...get().ddays, res.data] });
    }
  },

  updateDDay: async (id, updates) => {
    const res = await api.put<DDay>(`/ddays/${id}`, updates);
    if (res.success && res.data) {
      set({ ddays: get().ddays.map((d) => (d.id === id ? res.data! : d)) });
    }
  },

  deleteDDay: async (id) => {
    const res = await api.delete(`/ddays/${id}`);
    if (res.success) {
      set({ ddays: get().ddays.filter((d) => d.id !== id) });
    }
  },
}));
