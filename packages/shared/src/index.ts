// Shared types and utilities for TimeBox

// ── Auth ──
export interface LoginRequest {
  pin: string;
}

export interface AuthResponse {
  token: string;
}

// ── Event (Calendar) ──
export interface Event {
  id: number;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  categoryId?: number;
  recurrenceRule?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

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
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  category: TimeBlockCategory;
  color?: string;
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
  title: string;
  completed: boolean;
  priority: Priority;
  dueDate?: string;
  sortOrder: number;
  parentId?: number;
  children?: Todo[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTodoInput {
  title: string;
  priority?: Priority;
  dueDate?: string;
  parentId?: number;
}

// ── D-Day ──
export interface DDay {
  id: number;
  title: string;
  targetDate: string;
  color?: string;
  icon?: string;
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
  title: string;
  message?: string;
  remindAt: string;
  repeatRule?: string;
  sourceType: ReminderSourceType;
  sourceId?: number;
  channel: ReminderChannel;
  sent: boolean;
  snoozedUntil?: string;
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
  icon?: string;
}

// ── API Response ──
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
