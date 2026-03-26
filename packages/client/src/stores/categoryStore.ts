import { create } from "zustand";
import { api } from "@/lib/api";

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string | null;
}

interface CategoryState {
  categories: Category[];
  loading: boolean;
  fetchCategories: () => Promise<void>;
}

export const useCategoryStore = create<CategoryState>((set) => ({
  categories: [],
  loading: false,

  fetchCategories: async () => {
    set({ loading: true });
    const res = await api.get<Category[]>("/categories");
    if (res.success && res.data) {
      set({ categories: res.data, loading: false });
    } else {
      set({ loading: false });
    }
  },
}));
