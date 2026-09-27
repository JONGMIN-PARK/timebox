import { create } from 'zustand';
import { createListMutations } from '@/lib/listMutations';
import { nextTemporaryId } from '@/lib/entityMutations';
import { todayDate } from '@/lib/dateUtils';
import { timeblockApi } from '@/lib/apiService';
import { showToast } from '@/components/ui/Toast';
import type { TimeBlock, TimeBlockCategory } from '@timebox/shared';

export type { TimeBlock, TimeBlockCategory };

// Re-export from unified config for backward compatibility
export { TIMEBLOCK_CATEGORIES as CATEGORY_CONFIG } from '@/lib/categories';

interface TimeBlockState {
  blocks: TimeBlock[];
  loading: boolean;
  error: string | null;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  fetchBlocks: (date: string) => Promise<void>;
  addBlock: (block: Partial<TimeBlock>) => Promise<TimeBlock | undefined>;
  updateBlock: (id: number, updates: Partial<TimeBlock>) => Promise<boolean>;
  deleteBlock: (id: number) => Promise<boolean>;
  toggleCompleted: (id: number) => Promise<void>;
}

export const useTimeBlockStore = create<TimeBlockState>((set, get) => {
  let sequence = 0;
  const actions = createListMutations<TimeBlock>(
    () => get().blocks,
    (blocks) => set({ blocks, error: null }),
    (error) => {
      set({ error });
      showToast('error', error);
    },
  );
  return {
    blocks: [],
    loading: false,
    error: null,
    selectedDate: todayDate(),
    setSelectedDate: (selectedDate) => {
      if (selectedDate === get().selectedDate) return;
      sequence++;
      set({ selectedDate, blocks: [], loading: true, error: null });
      void get().fetchBlocks(selectedDate);
    },
    fetchBlocks: async (date) => {
      if (date !== get().selectedDate) return;
      const request = ++sequence;
      set({ error: null, loading: true });
      await actions.queue.idle();
      const revision = actions.queue.revision;
      const current = () => request === sequence && date === get().selectedDate;
      try {
        const result = await timeblockApi.getAll(date);
        if (!current()) return;
        if (revision !== actions.queue.revision) {
          await get().fetchBlocks(date);
          return;
        }
        if (!result.success || !result.data)
          throw new Error(result.error || 'Failed to fetch time blocks');
        set({ blocks: result.data, loading: false });
      } catch (error) {
        if (current()) {
          const message = error instanceof Error ? error.message : 'Failed to fetch time blocks';
          set({ error: message, loading: false });
          showToast('error', message);
        }
      }
    },
    addBlock: async (block) => {
      const date = block.date || get().selectedDate;
      const id = nextTemporaryId();
      const current = () => date === get().selectedDate;
      return actions.queue.run([id], async () => {
        const now = new Date().toISOString();
        const temp = {
          ...block,
          date,
          id,
          userId: 0,
          completed: false,
          notes: block.notes ?? null,
          meta: block.meta ?? null,
          createdAt: now,
          updatedAt: now,
        } as TimeBlock;
        if (current()) set({ blocks: [...get().blocks, temp], error: null });
        try {
          const result = await timeblockApi.create({ ...block, date });
          if (!result.success || !result.data)
            throw new Error(result.error || 'Failed to add time block');
          if (current())
            set({ blocks: get().blocks.map((item) => (item.id === id ? result.data! : item)) });
          return result.data;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to add time block';
          if (current())
            set({ blocks: get().blocks.filter((item) => item.id !== id), error: message });
          showToast('error', message);
          return undefined;
        }
      });
    },
    updateBlock: (id, updates) => {
      const date = get().selectedDate;
      return actions.mutate(
        [id],
        () => get().selectedDate === date,
        (items) => items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
        () => timeblockApi.update(id, updates),
        'Failed to update time block',
      );
    },
    deleteBlock: (id) => {
      const date = get().selectedDate;
      return actions.mutate(
        [id],
        () => get().selectedDate === date,
        (items) => items.filter((item) => item.id !== id),
        () => timeblockApi.delete(id),
        'Failed to delete time block',
      );
    },
    toggleCompleted: async (id) => {
      const item = get().blocks.find((item) => item.id === id);
      if (item) await get().updateBlock(id, { completed: !item.completed });
    },
  };
});
