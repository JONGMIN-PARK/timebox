import { create } from "zustand";
import { api, setToken, clearToken, isAuthenticated } from "@/lib/api";

interface TeamGroupInfo {
  id: number;
  name: string;
  color: string;
}

interface User {
  id: number;
  username: string;
  displayName: string | null;
  role: string;
  teamGroups?: TeamGroupInfo[];
  hasProjectAccess?: boolean;
}

interface AuthState {
  authenticated: boolean;
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  authenticated: isAuthenticated(),
  user: null,
  loading: false,
  error: null,

  login: async (username, password) => {
    set({ loading: true, error: null });
    const res = await api.post<{ token: string; user: User }>("/auth/login", { username, password });
    if (res.success && res.data) {
      setToken(res.data.token);
      set({ authenticated: true, user: res.data.user, loading: false });
      return true;
    }
    set({ error: res.error || "Login failed", loading: false });
    return false;
  },

  logout: () => {
    clearToken();
    set({ authenticated: false, user: null });
  },

  checkAuth: () => {
    set({ authenticated: isAuthenticated() });
  },

  fetchMe: async () => {
    const res = await api.get<User>("/auth/me");
    if (res.success && res.data) {
      set({ user: res.data });
    }
  },
}));
