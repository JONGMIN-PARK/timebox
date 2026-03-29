import { create } from "zustand";
import { timeblockApi } from "@/lib/apiService";
import { showToast } from "@/components/ui/Toast";
import type { TimeBlock } from "@timebox/shared";
import type { TimeBlockCategory } from "@timebox/shared";

export type { TimeBlock, TimeBlockCategory };

// Re-export from unified config for backward compatibility
export { TIMEBLOCK_CATEGORIES as CATEGORY_CONFIG } from "@/lib/categories";

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
      const res = await timeblockApi.getAll(date);
      if (res.success && res.data) {
        set({ blocks: res.data, loading: false });
      } else {
        const msg = res.error || "Failed to fetch time blocks";
        set({ error: msg, loading: false });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to fetch time blocks";
      set({ error: msg, loading: false });
      showToast("error", msg);
    }
  },

  addBlock: async (block) => {
    set({ error: null });
    // Optimistic add
    const tempId = -Date.now();
    const tempBlock = {
      id: tempId,
      ...block,
      userId: 0,
      notes: block.notes ?? null,
      meta: block.meta ?? null,
      createdAt: new Date().toISOString(),
    } as TimeBlock;
    set({ blocks: [...get().blocks, tempBlock] });

    try {
      const res = await timeblockApi.create(block);
      if (res.success && res.data) {
        set({ blocks: get().blocks.map(b => b.id === tempId ? res.data! : b) });
      } else {
        const msg = res.error || "Failed to add time block";
        set({ blocks: get().blocks.filter(b => b.id !== tempId), error: msg });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to add time block";
      set({ blocks: get().blocks.filter(b => b.id !== tempId), error: msg });
      showToast("error", msg);
    }
  },

  updateBlock: async (id, updates) => {
    set({ error: null });
    // Optimistic update
    const prev = get().blocks;
    set({ blocks: prev.map(b => b.id === id ? { ...b, ...updates } : b) });

    try {
      const res = await timeblockApi.update(id, updates);
      if (res.success && res.data) {
        set({ blocks: get().blocks.map(b => b.id === id ? res.data! : b) });
      } else {
        const msg = res.error || "Failed to update time block";
        set({ blocks: prev, error: msg });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to update time block";
      set({ blocks: prev, error: msg });
      showToast("error", msg);
    }
  },

  deleteBlock: async (id) => {
    set({ error: null });
    // Optimistic delete
    const prev = get().blocks;
    set({ blocks: prev.filter(b => b.id !== id) });

    try {
      const res = await timeblockApi.delete(id);
      if (!res.success) {
        const msg = res.error || "Failed to delete time block";
        set({ blocks: prev, error: msg });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to delete time block";
      set({ blocks: prev, error: msg });
      showToast("error", msg);
    }
  },

  toggleCompleted: async (id) => {
    const block = get().blocks.find((b) => b.id === id);
    if (block) {
      await get().updateBlock(id, { completed: !block.completed });
    }
  },
}));
