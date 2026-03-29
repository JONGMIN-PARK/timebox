import { create } from "zustand";
import { eventApi } from "@/lib/apiService";
import { showToast } from "@/components/ui/Toast";
import type { CalendarEvent } from "@timebox/shared";

interface EventState {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  fetchEvents: (start?: string, end?: string) => Promise<void>;
  addEvent: (event: Partial<CalendarEvent>) => Promise<void>;
  updateEvent: (id: number, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: number) => Promise<void>;
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  loading: false,
  error: null,

  fetchEvents: async (start, end) => {
    set({ error: null, loading: true });
    try {
      const res = await eventApi.getAll(start, end);
      if (res.success && res.data) {
        set({ events: res.data, loading: false });
      } else {
        const msg = res.error || "Failed to fetch events";
        set({ error: msg, loading: false });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to fetch events";
      set({ error: msg, loading: false });
      showToast("error", msg);
    }
  },

  addEvent: async (event) => {
    set({ error: null });
    // Optimistic add
    const tempId = -Date.now();
    const tempEvent = { id: tempId, ...event, userId: 0, createdAt: new Date().toISOString() } as CalendarEvent;
    set({ events: [...get().events, tempEvent] });

    try {
      const res = await eventApi.create(event);
      if (res.success && res.data) {
        set({ events: get().events.map(e => e.id === tempId ? res.data! : e) });
      } else {
        const msg = res.error || "Failed to add event";
        set({ events: get().events.filter(e => e.id !== tempId), error: msg });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to add event";
      set({ events: get().events.filter(e => e.id !== tempId), error: msg });
      showToast("error", msg);
    }
  },

  updateEvent: async (id, updates) => {
    set({ error: null });
    // Optimistic update
    const prev = get().events;
    set({ events: prev.map(e => e.id === id ? { ...e, ...updates } : e) });

    try {
      const res = await eventApi.update(id, updates);
      if (res.success && res.data) {
        set({ events: get().events.map(e => e.id === id ? res.data! : e) });
      } else {
        const msg = res.error || "Failed to update event";
        set({ events: prev, error: msg });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to update event";
      set({ events: prev, error: msg });
      showToast("error", msg);
    }
  },

  deleteEvent: async (id) => {
    set({ error: null });
    // Optimistic delete
    const prev = get().events;
    set({ events: prev.filter(e => e.id !== id) });

    try {
      const res = await eventApi.delete(id);
      if (!res.success) {
        const msg = res.error || "Failed to delete event";
        set({ events: prev, error: msg });
        showToast("error", msg);
      }
    } catch {
      const msg = "Failed to delete event";
      set({ events: prev, error: msg });
      showToast("error", msg);
    }
  },
}));
