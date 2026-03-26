import { create } from "zustand";
import { api } from "@/lib/api";

export type TimeBlockCategory =
  | "deep_work"
  | "meeting"
  | "email"
  | "exercise"
  | "break"
  | "personal"
  | "admin"
  | "other";

export interface TimeBlock {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  category: TimeBlockCategory;
  color: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export const CATEGORY_CONFIG: Record<TimeBlockCategory, { label: string; color: string; icon: string }> = {
  deep_work: { label: "심층 작업", color: "#3b82f6", icon: "🧠" },
  meeting: { label: "미팅", color: "#8b5cf6", icon: "👥" },
  email: { label: "이메일", color: "#f59e0b", icon: "📧" },
  exercise: { label: "운동", color: "#10b981", icon: "💪" },
  break: { label: "휴식", color: "#6b7280", icon: "☕" },
  personal: { label: "개인", color: "#ec4899", icon: "🏠" },
  admin: { label: "행정", color: "#f97316", icon: "📋" },
  other: { label: "기타", color: "#94a3b8", icon: "📌" },
};

interface TimeBlockState {
  blocks: TimeBlock[];
  loading: boolean;
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
  selectedDate: new Date().toISOString().slice(0, 10),

  setSelectedDate: (date) => {
    set({ selectedDate: date });
    get().fetchBlocks(date);
  },

  fetchBlocks: async (date) => {
    set({ loading: true });
    const res = await api.get<TimeBlock[]>(`/timeblocks?date=${date}`);
    if (res.success && res.data) {
      set({ blocks: res.data, loading: false });
    } else {
      set({ loading: false });
    }
  },

  addBlock: async (block) => {
    const res = await api.post<TimeBlock>("/timeblocks", block);
    if (res.success && res.data) {
      set({ blocks: [...get().blocks, res.data] });
    }
  },

  updateBlock: async (id, updates) => {
    const res = await api.put<TimeBlock>(`/timeblocks/${id}`, updates);
    if (res.success && res.data) {
      set({ blocks: get().blocks.map((b) => (b.id === id ? res.data! : b)) });
    }
  },

  deleteBlock: async (id) => {
    const res = await api.delete(`/timeblocks/${id}`);
    if (res.success) {
      set({ blocks: get().blocks.filter((b) => b.id !== id) });
    }
  },

  toggleCompleted: async (id) => {
    const block = get().blocks.find((b) => b.id === id);
    if (block) {
      await get().updateBlock(id, { completed: !block.completed });
    }
  },
}));
