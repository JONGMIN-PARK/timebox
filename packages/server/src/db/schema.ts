import { pgTable, text, integer, serial, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── Users (multi-user) ──
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  role: text("role").notNull().default("user"), // "admin" | "user"
  active: boolean("active").notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});

// ── Registration Requests ──
export const registrationRequests = pgTable("registration_requests", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  message: text("message"),
  status: text("status").notNull().default("pending"), // "pending" | "approved" | "rejected"
  reviewedBy: integer("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});

// ── TimeBlock Templates ──
export const timeBlockTemplates = pgTable("time_block_templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  blocks: text("blocks").notNull(), // JSON array of {startTime, endTime, title, category, color}
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
});

// ── Categories ──
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#3b82f6"),
  icon: text("icon"),
});

// ── Events (Calendar) ──
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  allDay: boolean("all_day").notNull().default(false),
  categoryId: integer("category_id").references(() => categories.id),
  recurrenceRule: text("recurrence_rule"),
  color: text("color").default("#3b82f6"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`now()`),
});

// ── TimeBlocks ──
export const timeBlocks = pgTable("time_blocks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull().default("other"),
  color: text("color"),
  completed: boolean("completed").notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`now()`),
});

// ── Todos ──
export const todos = pgTable("todos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  priority: text("priority").notNull().default("medium"),
  category: text("category").notNull().default("personal"),
  dueDate: text("due_date"),
  sortOrder: integer("sort_order").notNull().default(0),
  parentId: integer("parent_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`now()`),
});

// ── D-Days ──
export const ddays = pgTable("ddays", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  targetDate: text("target_date").notNull(),
  color: text("color").default("#3b82f6"),
  icon: text("icon"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`now()`),
});

// ── Reminders ──
export const reminders = pgTable("reminders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message"),
  remindAt: text("remind_at").notNull(),
  repeatRule: text("repeat_rule"),
  sourceType: text("source_type").notNull().default("custom"),
  sourceId: integer("source_id"),
  channel: text("channel").notNull().default("telegram"),
  sent: boolean("sent").notNull().default(false),
  snoozedUntil: text("snoozed_until"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`now()`),
});

// ── Files ──
export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  originalName: text("original_name").notNull(),
  storedName: text("stored_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  tags: text("tags").notNull().default("[]"),
  uploadedVia: text("uploaded_via").notNull().default("web"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`now()`),
});

// ── Telegram Config ──
export const telegramConfig = pgTable("telegram_config", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  chatId: text("chat_id"),
  dailyBriefingTime: text("daily_briefing_time"),
  active: boolean("active").notNull().default(false),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`now()`),
});

// ── Projects ──
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#3b82f6"),
  icon: text("icon"),
  ownerId: integer("owner_id").notNull(),
  visibility: text("visibility").notNull().default("team"),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
});

// ── Project Members ──
export const projectMembers = pgTable("project_members", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull().default("member"),
  joinedAt: text("joined_at").notNull().default(sql`now()`),
});

// ── Project Tasks (Kanban) ──
export const projectTasks = pgTable("project_tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  assigneeId: integer("assignee_id"),
  reporterId: integer("reporter_id").notNull(),
  dueDate: text("due_date"),
  tags: text("tags").notNull().default("[]"),
  sortOrder: integer("sort_order").notNull().default(0),
  parentId: integer("parent_id"),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
});

// ── Task Comments ──
export const taskComments = pgTable("task_comments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  authorId: integer("author_id").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

// ── Activity Log ──
export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  userId: integer("user_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: integer("target_id"),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

// ── Task Transfers ──
export const taskTransfers = pgTable("task_transfers", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  projectId: integer("project_id").notNull(),
  fromUserId: integer("from_user_id").notNull(),
  toUserId: integer("to_user_id").notNull(),
  message: text("message"),
  status: text("status").notNull().default("pending"), // pending | accepted | rejected
  createdAt: text("created_at").notNull().default(sql`now()`),
  respondedAt: text("responded_at"),
});

// ── Posts (Bulletin Board) ──
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  authorId: integer("author_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  pinned: boolean("pinned").notNull().default(false),
  category: text("category").notNull().default("discussion"),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
});

// ── Post Comments ──
export const postComments = pgTable("post_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  authorId: integer("author_id").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

// ── Project Files (shared) ──
export const projectFiles = pgTable("project_files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  uploaderId: integer("uploader_id").notNull(),
  originalName: text("original_name").notNull(),
  storedName: text("stored_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  folder: text("folder").notNull().default("/"),
  tags: text("tags").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

// ── Chat Messages ──
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  channel: text("channel").notNull().default("general"),
  senderId: integer("sender_id").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("text"),
  replyTo: integer("reply_to"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});
