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
  aiModel: text("ai_model").notNull().default("gemini-2.0-flash"),
  allowedModels: text("allowed_models").notNull().default("[]"),
  /** Secret token for read-only iCal feed URL (nullable until generated). */
  calendarFeedToken: text("calendar_feed_token"),
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
  projectId: integer("project_id"),
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
  notes: text("notes"),
  /** JSON: brainId, prioritySlot, showArrow, variant, etc. */
  meta: text("meta"),
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
  progress: integer("progress").notNull().default(0),
  priority: text("priority").notNull().default("medium"),
  category: text("category").notNull().default("personal"),
  status: text("status").notNull().default("active"),  // "waiting" | "active" | "completed"
  dueDate: text("due_date"),
  sortOrder: integer("sort_order").notNull().default(0),
  parentId: integer("parent_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`now()`),
  deletedAt: text("deleted_at"), // ISO timestamp when soft-deleted (trash)
  projectId: integer("project_id"),
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
  version: integer("version").notNull().default(1),
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
  startDate: text("start_date"),
  targetDate: text("target_date"),
  docs: text("docs"),  // Markdown/text for project overview, specs, notes
  archived: boolean("archived").notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
  teamGroupId: integer("team_group_id"),
});

// ── Project Members ──
export const projectMembers = pgTable("project_members", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull().default("member"),
  joinedAt: text("joined_at").notNull().default(sql`now()`),
});

// ── Project invite links (token shown once; stored as SHA-256 hex) ──
export const projectInvites = pgTable("project_invites", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  role: text("role").notNull().default("member"),
  createdBy: integer("created_by").notNull(),
  expiresAt: text("expires_at").notNull(),
  revokedAt: text("revoked_at"),
  usedAt: text("used_at"),
  usedByUserId: integer("used_by_user_id"),
  createdAt: text("created_at").notNull().default(sql`now()`),
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
  startDate: text("start_date"),
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

// ── Task Work Logs (progress updates) ──
export const taskWorkLogs = pgTable("task_work_logs", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  projectId: integer("project_id").notNull(),
  userId: integer("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull().default(sql`now()`),
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
  version: integer("version").notNull().default(1),
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
  deleted: boolean("deleted").notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

// ── Team Groups ──
export const teamGroups = pgTable("team_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#3b82f6"),
  createdBy: integer("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
});

// ── Team Group Members ──
export const teamGroupMembers = pgTable("team_group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  userId: integer("user_id").notNull(),
  joinedAt: text("joined_at").notNull().default(sql`now()`),
});

// ── User Inbox Messages ──
export const inboxMessages = pgTable("inbox_messages", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").notNull(),
  toUserId: integer("to_user_id").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("message"), // "message" | "task_assignment" | "system"
  relatedProjectId: integer("related_project_id"),
  relatedTaskId: integer("related_task_id"),
  read: boolean("read").notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`now()`),
  /** Recipient moved message to trash (soft delete). */
  toUserTrashedAt: text("to_user_trashed_at"),
  /** Sender moved message to trash in Sent folder. */
  fromUserTrashedAt: text("from_user_trashed_at"),
  /** Recipient permanently removed from trash (hidden forever; row may remain for sender). */
  toUserPurgedAt: text("to_user_purged_at"),
  /** Sender permanently removed from trash. */
  fromUserPurgedAt: text("from_user_purged_at"),
});

// ── Task Reactions ──
export const taskReactions = pgTable("task_reactions", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  userId: integer("user_id").notNull(),
  emoji: text("emoji").notNull(), // "👍" "🔥" "💪" "⚠️" "❤️" "👀" "🎉" etc.
  createdAt: text("created_at").notNull().default(sql`now()`),
});

// ── Chat Rooms ──
export const chatRooms = pgTable("chat_rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("group"), // "group" | "direct"
  description: text("description"),
  createdBy: integer("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
});

// ── Chat Members ──
export const chatMembers = pgTable("chat_members", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull().default("member"), // "owner" | "admin" | "member"
  joinedAt: text("joined_at").notNull().default(sql`now()`),
});

// ── Chat Messages ──
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  userId: integer("user_id").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("text"), // "text" | "system" | "image"
  replyTo: integer("reply_to"),
  deleted: boolean("deleted").notNull().default(false),
  readBy: text("read_by").notNull().default("[]"),  // JSON array of userIds who read this
  createdAt: text("created_at").notNull().default(sql`now()`),
});

// ── User Activity Log (Admin Analytics) ──
export const userActivityLog = pgTable("user_activity_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  action: text("action").notNull(), // e.g., "todo.create", "event.update", "project.view"
  category: text("category").notNull(), // "personal" | "project" | "general"
  targetType: text("target_type"), // "todo", "event", "project", "chat", etc.
  targetId: integer("target_id"),
  projectId: integer("project_id"),
  metadata: text("metadata"), // JSON string for extra info
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});
