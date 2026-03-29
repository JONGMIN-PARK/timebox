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
  create: (data: { title: string; priority?: string; dueDate?: string; category?: string; status?: 'waiting' | 'active' | 'completed'; projectId?: number | null }) =>
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
  getCalendar: (projectId: number, start: string, end: string) =>
    api.get<{
      myEvents: Array<{ type: string; id: number; title: string; startTime: string; endTime: string; allDay: boolean; color?: string | null; userId: number; isMine: boolean }>;
      othersBusy: Array<{ type: string; id: number; title: string; startTime: string; endTime: string; allDay: boolean; userId: number; isMine: boolean }>;
      projectTasks: Array<{ type: string; id: number; title: string; dueDate: string | null; status: string; assigneeId: number | null; priority: string }>;
    }>(`/projects/${projectId}/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  createInviteLink: (projectId: number, body?: { role?: string; expiresInDays?: number }) =>
    api.post<{ id: number; token: string; expiresAt: string; role: string }>(`/projects/${projectId}/invites`, body || {}),
  listInvites: (projectId: number) =>
    api.get<{
      all: Array<{ id: number; role: string; expiresAt: string; revokedAt: string | null; usedAt: string | null; createdAt: string }>;
      pending: Array<{ id: number; role: string; expiresAt: string; revokedAt: string | null; usedAt: string | null; createdAt: string }>;
    }>(`/projects/${projectId}/invites`),
  revokeInvite: (projectId: number, inviteId: number) =>
    api.delete(`/projects/${projectId}/invites/${inviteId}`),
  acceptInvite: (token: string) =>
    api.post<{ projectId: number; projectName?: string }>("/projects/invites/accept", { token }),
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
  hasCalendarFeed?: boolean;
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ token: string; user: AuthUser }>("/auth/login", { username, password }),
  logout: () => api.post("/auth/logout", {}),
  me: () => api.get<AuthUser>("/auth/me"),
  regenerateCalendarFeed: () =>
    api.post<{ token: string }>("/auth/calendar-feed/regenerate", {}),
  revokeCalendarFeed: () => api.delete("/auth/calendar-feed"),
};

export const summaryApi = {
  week: () =>
    api.get<{
      personalTodosDue: Array<{ id: number; title: string; dueDate: string | null; projectId: number | null; priority: string }>;
      assignedProjectTasks: Array<{ id: number; projectId: number; title: string; dueDate: string | null; status: string; priority: string }>;
    }>("/summary/week"),
};
