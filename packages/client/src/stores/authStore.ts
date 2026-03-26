import { create } from "zustand";
import { api, setToken, clearToken, isAuthenticated } from "@/lib/api";

interface AuthState {
  authenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  authenticated: isAuthenticated(),
  loading: false,
  error: null,

  login: async (pin: string) => {
    set({ loading: true, error: null });
    const res = await api.post<{ token: string }>("/auth/login", { pin });
    if (res.success && res.data) {
      setToken(res.data.token);
      set({ authenticated: true, loading: false });
      return true;
    }
    set({ error: res.error || "Login failed", loading: false });
    return false;
  },

  logout: () => {
    clearToken();
    set({ authenticated: false });
  },

  checkAuth: () => {
    set({ authenticated: isAuthenticated() });
  },
}));
