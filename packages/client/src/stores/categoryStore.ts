import { create } from "zustand";
import { api } from "@/lib/api";
import type { Category } from "@timebox/shared";

export type { Category };

interface CategoryState {
  categories: Category[];
  loading: boolean;
  error: string | null;
  fetchCategories: () => Promise<void>;
}

export const useCategoryStore = create<CategoryState>((set) => ({
  categories: [],
  loading: false,
  error: null,

  fetchCategories: async () => {
    set({ error: null, loading: true });
    try {
      const res = await api.get<Category[]>("/categories");
      if (res.success && res.data) {
        set({ categories: res.data, loading: false });
      } else {
        set({ error: res.error || "Failed to fetch categories", loading: false });
      }
    } catch {
      set({ error: "Failed to fetch categories", loading: false });
    }
  },
}));
