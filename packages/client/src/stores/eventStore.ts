import { create } from "zustand";
import { api } from "@/lib/api";

interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  categoryId: number | null;
  color: string;
  createdAt: string;
  updatedAt: string;
}

interface EventState {
  events: CalendarEvent[];
  loading: boolean;
  fetchEvents: (start?: string, end?: string) => Promise<void>;
  addEvent: (event: Partial<CalendarEvent>) => Promise<void>;
  updateEvent: (id: number, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: number) => Promise<void>;
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  loading: false,

  fetchEvents: async (start, end) => {
    set({ loading: true });
    const query = start && end ? `?start=${start}&end=${end}` : "";
    const res = await api.get<CalendarEvent[]>(`/events${query}`);
    if (res.success && res.data) {
      set({ events: res.data, loading: false });
    } else {
      set({ loading: false });
    }
  },

  addEvent: async (event) => {
    const res = await api.post<CalendarEvent>("/events", event);
    if (res.success && res.data) {
      set({ events: [...get().events, res.data] });
    }
  },

  updateEvent: async (id, updates) => {
    const res = await api.put<CalendarEvent>(`/events/${id}`, updates);
    if (res.success && res.data) {
      set({ events: get().events.map((e) => (e.id === id ? res.data! : e)) });
    }
  },

  deleteEvent: async (id) => {
    const res = await api.delete(`/events/${id}`);
    if (res.success) {
      set({ events: get().events.filter((e) => e.id !== id) });
    }
  },
}));
