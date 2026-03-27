import { create } from "zustand";
import { api } from "@/lib/api";
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
      const query = start && end ? `?start=${start}&end=${end}` : "";
      const res = await api.get<CalendarEvent[]>(`/events${query}`);
      if (res.success && res.data) {
        set({ events: res.data, loading: false });
      } else {
        set({ error: res.error || "Failed to fetch events", loading: false });
      }
    } catch {
      set({ error: "Failed to fetch events", loading: false });
    }
  },

  addEvent: async (event) => {
    set({ error: null });
    try {
      const res = await api.post<CalendarEvent>("/events", event);
      if (res.success && res.data) {
        set({ events: [...get().events, res.data] });
      } else {
        set({ error: res.error || "Failed to add event" });
      }
    } catch {
      set({ error: "Failed to add event" });
    }
  },

  updateEvent: async (id, updates) => {
    set({ error: null });
    try {
      const res = await api.put<CalendarEvent>(`/events/${id}`, updates);
      if (res.success && res.data) {
        set({ events: get().events.map((e) => (e.id === id ? res.data! : e)) });
      } else {
        set({ error: res.error || "Failed to update event" });
      }
    } catch {
      set({ error: "Failed to update event" });
    }
  },

  deleteEvent: async (id) => {
    set({ error: null });
    try {
      const res = await api.delete(`/events/${id}`);
      if (res.success) {
        set({ events: get().events.filter((e) => e.id !== id) });
      } else {
        set({ error: res.error || "Failed to delete event" });
      }
    } catch {
      set({ error: "Failed to delete event" });
    }
  },
}));
