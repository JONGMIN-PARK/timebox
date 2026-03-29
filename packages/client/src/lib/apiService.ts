/**
 * Typed API service layer.
 *
 * All HTTP calls live here so that stores only deal with state management.
 * Every function returns the raw response shape from `api` (`{ success, data?, error? }`).
 */

import { api } from "./api";
import type {
  Todo,
  CalendarEvent,
  TimeBlock,
  Category,
  DDay,
} from "@timebox/shared";
import type { Project, ProjectMember } from "@/stores/projectStore";
import type { ProjectTask } from "@/stores/projectTaskStore";

// ── Response helper type ──────────────────────────────────────────────
export type ApiRes<T> = { success: boolean; data?: T; error?: string };

// ── Todo ──────────────────────────────────────────────────────────────
export const todoApi = {
  getAll: (filter?: 'waiting' | 'active' | 'completed' | 'trash') => {
    const query = filter ? `?filter=${filter}` : "";
    return api.get<Todo[]>(`/todos${query}`);
  },
  create: (data: { title: string; priority?: string; dueDate?: string; category?: string; status?: 'waiting' | 'active' | 'completed' }) =>
    api.post<Todo>("/todos", data),
  update: (id: number, data: Partial<Todo>) =>
    api.put<Todo>(`/todos/${id}`, data),
  delete: (id: number) => api.delete<Todo>(`/todos/${id}`),
  restore: (id: number) => api.post<Todo>(`/todos/${id}/restore`, {}),
  deletePermanent: (id: number) => api.delete<Todo>(`/todos/${id}/permanent`),
  emptyTrash: () => api.delete<{ count: number }>("/todos/trash"),
  toggle: (id: number, data: { completed: boolean; progress: number }) =>
    api.put<Todo>(`/todos/${id}`, data),
  reorder: (items: { id: number; sortOrder: number }[]) =>
    api.put("/todos/reorder", { items }),
  updateStatus: (id: number, status: 'waiting' | 'active' | 'completed') =>
    api.put<Todo>(`/todos/${id}/status`, { status }),
};

// ── Event ─────────────────────────────────────────────────────────────
export const eventApi = {
  getAll: (start?: string, end?: string) => {
    const query = start && end ? `?start=${start}&end=${end}` : "";
    return api.get<CalendarEvent[]>(`/events${query}`);
  },
  create: (data: Partial<CalendarEvent>) =>
    api.post<CalendarEvent>("/events", data),
  update: (id: number, data: Partial<CalendarEvent>) =>
    api.put<CalendarEvent>(`/events/${id}`, data),
  delete: (id: number) => api.delete(`/events/${id}`),
};

// ── TimeBlock ─────────────────────────────────────────────────────────
export const timeblockApi = {
  getAll: (date: string) =>
    api.get<TimeBlock[]>(`/timeblocks?date=${date}`),
  create: (data: Partial<TimeBlock>) =>
    api.post<TimeBlock>("/timeblocks", data),
  update: (id: number, data: Partial<TimeBlock>) =>
    api.put<TimeBlock>(`/timeblocks/${id}`, data),
  delete: (id: number) => api.delete(`/timeblocks/${id}`),
};

// ── Category ──────────────────────────────────────────────────────────
export const categoryApi = {
  getAll: () => api.get<Category[]>("/categories"),
};

// ── DDay ──────────────────────────────────────────────────────────────
export const ddayApi = {
  getAll: () => api.get<DDay[]>("/ddays"),
  create: (data: { title: string; targetDate: string; color?: string }) =>
    api.post<DDay>("/ddays", data),
  update: (id: number, data: Partial<DDay>) =>
    api.put<DDay>(`/ddays/${id}`, data),
  delete: (id: number) => api.delete(`/ddays/${id}`),
};

// ── Project ───────────────────────────────────────────────────────────
export const projectApi = {
  getAll: () => api.get<Project[]>("/projects"),
  create: (data: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    teamGroupId?: number;
    startDate?: string;
    targetDate?: string;
    docs?: string;
  }) => api.post<Project>("/projects", data),
  update: (id: number, data: Partial<Project>) =>
    api.put<Project>(`/projects/${id}`, data),
  delete: (id: number) => api.delete(`/projects/${id}`),
  archive: (id: number) =>
    api.put<{ archived: boolean }>(`/projects/${id}/archive`, {}),
  getMembers: (projectId: number) =>
    api.get<ProjectMember[]>(`/projects/${projectId}/members`),
  inviteMember: (projectId: number, username: string, role?: string) =>
    api.post(`/projects/${projectId}/members`, { username, role }),
  removeMember: (projectId: number, userId: number) =>
    api.delete(`/projects/${projectId}/members/${userId}`),
};

// ── ProjectTask ───────────────────────────────────────────────────────
export const projectTaskApi = {
  getAll: (projectId: number) =>
    api.get<ProjectTask[]>(`/projects/${projectId}/tasks`),
  create: (projectId: number, data: Partial<ProjectTask>) =>
    api.post<ProjectTask>(`/projects/${projectId}/tasks`, data),
  update: (projectId: number, taskId: number, data: Partial<ProjectTask>) =>
    api.put<ProjectTask>(`/projects/${projectId}/tasks/${taskId}`, data),
  delete: (projectId: number, taskId: number) =>
    api.delete(`/projects/${projectId}/tasks/${taskId}`),
  reorder: (projectId: number, items: { id: number; sortOrder: number; status: string }[]) =>
    api.put(`/projects/${projectId}/tasks/reorder`, { items }),
};

// ── Auth ──────────────────────────────────────────────────────────────
interface AuthUser {
  id: number;
  username: string;
  displayName: string | null;
  role: string;
  aiModel?: string;
  allowedModels?: string[];
  teamGroups?: { id: number; name: string; color: string }[];
  hasProjectAccess?: boolean;
  lastLoginAt?: string | null;
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ token: string; user: AuthUser }>("/auth/login", { username, password }),
  logout: () => api.post("/auth/logout", {}),
  me: () => api.get<AuthUser>("/auth/me"),
};
