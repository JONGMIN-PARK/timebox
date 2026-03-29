import { create } from "zustand";
import { setToken, clearToken, isAuthenticated } from "@/lib/api";
import { authApi } from "@/lib/apiService";
import { showToast } from "@/components/ui/Toast";
import { updateAppBadge } from "@/lib/badge";

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
  aiModel?: string;
  allowedModels?: string[];
  teamGroups?: TeamGroupInfo[];
  hasProjectAccess?: boolean;
  lastLoginAt?: string | null;
  hasCalendarFeed?: boolean;
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
    try {
      const res = await authApi.login(username, password);
      if (res.success && res.data) {
        setToken(res.data.token);
        // Cache token for service worker
        const token = res.data.token;
        if ('caches' in window) {
          caches.open('timebox-auth').then(cache => {
            cache.put('/auth-token', new Response(token));
          });
        }
        set({ authenticated: true, user: res.data.user, loading: false });
        return true;
      }
      const msg = res.error || "Login failed";
      set({ error: msg, loading: false });
      showToast("error", msg);
      return false;
    } catch {
      const msg = "Login failed";
      set({ error: msg, loading: false });
      showToast("error", msg);
      return false;
    }
  },

  logout: () => {
    authApi.logout().catch(() => {});
    clearToken();
    updateAppBadge(0);
    if ('caches' in window) {
      caches.open('timebox-auth').then(cache => cache.delete('/auth-token'));
    }
    set({ authenticated: false, user: null });
    window.location.href = "/";
  },

  checkAuth: () => {
    set({ authenticated: isAuthenticated() });
  },

  fetchMe: async () => {
    try {
      const res = await authApi.me();
      if (res.success && res.data) {
        set({ user: res.data, authenticated: true });
      } else {
        // Token expired or invalid - clear auth state
        clearToken();
        updateAppBadge(0);
        set({ authenticated: false, user: null });
      }
    } catch {
      clearToken();
      updateAppBadge(0);
      set({ authenticated: false, user: null });
    }
  },
}));
