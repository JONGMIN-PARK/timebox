import { create } from "zustand";
import { api } from "@/lib/api";
import type { TimeBlock } from "@timebox/shared";
import type { TimeBlockCategory } from "@timebox/shared";

export type { TimeBlock, TimeBlockCategory };

export const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  deep_work: { label: "Deep Work", color: "#3b82f6", icon: "\u{1F9E0}" },
  meeting: { label: "Meeting", color: "#8b5cf6", icon: "\u{1F465}" },
  email: { label: "Email", color: "#f59e0b", icon: "\u{1F4E7}" },
  exercise: { label: "Exercise", color: "#10b981", icon: "\u{1F4AA}" },
  break: { label: "Break", color: "#6b7280", icon: "\u2615" },
  personal: { label: "Personal", color: "#ec4899", icon: "\u{1F3E0}" },
  admin: { label: "Admin", color: "#f97316", icon: "\u{1F4CB}" },
  other: { label: "Other", color: "#94a3b8", icon: "\u{1F4CC}" },
};

interface TimeBlockState {
  blocks: TimeBlock[];
  loading: boolean;
  error: string | null;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  fetchBlocks: (date: string) => Promise<void>;
  addBlock: (block: Partial<TimeBlock>) => Promise<void>;
  updateBlock: (id: number, updates: Partial<TimeBlock>) => Promise<void>;
  deleteBlock: (id: number) => Promise<void>;
  toggleCompleted: (id: number) => Promise<void>;
}

export const useTimeBlockStore = create<TimeBlockState>((set, get) => ({
  blocks: [],
  loading: false,
  error: null,
  selectedDate: new Date().toISOString().slice(0, 10),

  setSelectedDate: (date) => {
    set({ selectedDate: date });
    get().fetchBlocks(date);
  },

  fetchBlocks: async (date) => {
    set({ error: null, loading: true });
    try {
      const res = await api.get<TimeBlock[]>(`/timeblocks?date=${date}`);
      if (res.success && res.data) {
        set({ blocks: res.data, loading: false });
      } else {
        set({ error: res.error || "Failed to fetch time blocks", loading: false });
      }
    } catch {
      set({ error: "Failed to fetch time blocks", loading: false });
    }
  },

  addBlock: async (block) => {
    set({ error: null });
    try {
      const res = await api.post<TimeBlock>("/timeblocks", block);
      if (res.success && res.data) {
        set({ blocks: [...get().blocks, res.data] });
      } else {
        set({ error: res.error || "Failed to add time block" });
      }
    } catch {
      set({ error: "Failed to add time block" });
    }
  },

  updateBlock: async (id, updates) => {
    set({ error: null });
    try {
      const res = await api.put<TimeBlock>(`/timeblocks/${id}`, updates);
      if (res.success && res.data) {
        set({ blocks: get().blocks.map((b) => (b.id === id ? res.data! : b)) });
      } else {
        set({ error: res.error || "Failed to update time block" });
      }
    } catch {
      set({ error: "Failed to update time block" });
    }
  },

  deleteBlock: async (id) => {
    set({ error: null });
    try {
      const res = await api.delete(`/timeblocks/${id}`);
      if (res.success) {
        set({ blocks: get().blocks.filter((b) => b.id !== id) });
      } else {
        set({ error: res.error || "Failed to delete time block" });
      }
    } catch {
      set({ error: "Failed to delete time block" });
    }
  },

  toggleCompleted: async (id) => {
    const block = get().blocks.find((b) => b.id === id);
    if (block) {
      await get().updateBlock(id, { completed: !block.completed });
    }
  },
}));
