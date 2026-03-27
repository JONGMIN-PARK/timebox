// Shared types and utilities for TimeBox

// ── Auth ──
export interface LoginRequest {
  pin: string;
}

export interface AuthResponse {
  token: string;
}

// ── User ──
export interface User {
  id: number;
  username: string;
  displayName: string | null;
  role: string;
}

// ── Event (Calendar) ──
export interface CalendarEvent {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  categoryId: number | null;
  recurrenceRule: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
}

/** @deprecated Use CalendarEvent instead */
export type Event = CalendarEvent;

export interface CreateEventInput {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  allDay?: boolean;
  categoryId?: number;
  recurrenceRule?: string;
  color?: string;
}

// ── TimeBlock ──
export type TimeBlockCategory =
  | "deep_work"
  | "meeting"
  | "email"
  | "exercise"
  | "break"
  | "personal"
  | "admin"
  | "other";

export interface TimeBlock {
  id: number;
  userId: number;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  category: string;
  color: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTimeBlockInput {
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  category: TimeBlockCategory;
  color?: string;
}

// ── Todo ──
export type Priority = "high" | "medium" | "low";

export interface Todo {
  id: number;
  userId: number;
  title: string;
  completed: boolean;
  priority: string;
  category: string;
  dueDate: string | null;
  sortOrder: number;
  parentId: number | null;
  children?: Todo[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTodoInput {
  title: string;
  priority?: Priority;
  dueDate?: string;
  parentId?: number;
  category?: string;
}

// ── D-Day ──
export interface DDay {
  id: number;
  userId: number;
  title: string;
  targetDate: string;
  color: string;
  icon: string | null;
  daysLeft: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDDayInput {
  title: string;
  targetDate: string;
  color?: string;
  icon?: string;
}

// ── Reminder ──
export type ReminderChannel = "telegram" | "web_push" | "both";
export type ReminderSourceType = "event" | "todo" | "dday" | "custom";

export interface Reminder {
  id: number;
  userId: number;
  title: string;
  message: string | null;
  remindAt: string;
  repeatRule: string | null;
  sourceType: ReminderSourceType;
  sourceId: number | null;
  channel: ReminderChannel;
  sent: boolean;
  snoozedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReminderInput {
  title: string;
  message?: string;
  remindAt: string;
  repeatRule?: string;
  sourceType?: ReminderSourceType;
  sourceId?: number;
  channel?: ReminderChannel;
}

// ── File ──
export type UploadedVia = "web" | "telegram";

export interface FileItem {
  id: number;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  tags: string[];
  uploadedVia: UploadedVia;
  createdAt: string;
  updatedAt: string;
}

export interface StorageUsage {
  usedBytes: number;
  maxBytes: number;
  fileCount: number;
}

// ── Category ──
export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string | null;
}

// ── API Response ──
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── Project (Team) ──
export interface Project {
  id: number;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  ownerId: number;
  visibility: string;
  memberCount?: number;
  myRole?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectRole = "owner" | "admin" | "member" | "viewer";
export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";

export interface ProjectTask {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string;
  assigneeId: number | null;
  reporterId: number;
  dueDate: string | null;
  tags: string;
  sortOrder: number;
  parentId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: number;
  taskId: number;
  authorId: number;
  authorName?: string;
  content: string;
  createdAt: string;
}

export interface ActivityLogEntry {
  id: number;
  projectId: number;
  userId: number;
  userName?: string;
  action: string;
  targetType: string | null;
  targetId: number | null;
  metadata: any;
  createdAt: string;
}

export interface ProjectStats {
  total: number;
  done: number;
  inProgress: number;
  overdue: number;
  progress: number;
  memberStats: { userId: number; role: string; total: number; done: number; inProgress: number }[];
}
