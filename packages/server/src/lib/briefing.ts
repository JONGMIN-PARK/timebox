/**
 * Daily Briefing — a single aggregated snapshot of a user's day.
 *
 * This is the single source of truth used by BOTH the web client
 * (GET /api/briefing/today) and the Telegram bot (/today command +
 * scheduled morning push), so the two surfaces always show the same thing.
 */
import { db } from "../db/index.js";
import { events, todos, reminders, ddays, timeBlocks } from "../db/schema.js";
import { and, eq, gte, lte, isNull } from "drizzle-orm";
import { kstToday, calcDaysLeft } from "./kst.js";

export type BriefingPeriod = "morning" | "afternoon" | "evening";

export interface BriefingEvent {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  color: string | null;
}
export interface BriefingTodo {
  id: number;
  title: string;
  priority: string;
  dueDate: string;
  overdue: boolean;
}
export interface BriefingReminder {
  id: number;
  title: string;
  message: string | null;
  remindAt: string;
}
export interface BriefingDday {
  id: number;
  title: string;
  targetDate: string;
  daysLeft: number;
}
export interface Briefing {
  date: string;
  period: BriefingPeriod;
  events: BriefingEvent[];
  todos: BriefingTodo[];
  reminders: BriefingReminder[];
  ddays: BriefingDday[];
  timeBlocks: { count: number; totalMinutes: number };
  counts: { events: number; todos: number; overdue: number; reminders: number; ddays: number };
}

/** Current hour (0-23) in KST. */
function kstHour(): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return parseInt(h, 10) % 24;
}

function periodOfDay(hour: number): BriefingPeriod {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/**
 * Build the day's briefing for a user. "Today" is always KST.
 * Events overlapping today (including multi-day / all-day) are included;
 * todos are those due today or overdue; reminders are those scheduled for
 * today; D-Days are those within the next 7 days.
 */
export async function buildBriefing(userId: number): Promise<Briefing> {
  const today = kstToday();
  const dayStart = `${today}T00:00:00`;
  const dayEnd = `${today}T23:59:59`;

  // Events overlapping today (start <= end-of-day AND end >= start-of-day).
  const evRows = await db.select().from(events).where(and(
    eq(events.userId, userId),
    lte(events.startTime, dayEnd),
    gte(events.endTime, dayStart),
  ));
  const evList: BriefingEvent[] = evRows
    .map((e) => ({ id: e.id, title: e.title, startTime: e.startTime, endTime: e.endTime, allDay: e.allDay, color: e.color }))
    .sort((a, b) => (a.allDay === b.allDay ? a.startTime.localeCompare(b.startTime) : a.allDay ? -1 : 1));

  // Todos due today or overdue (active, not trashed).
  const activeTodos = await db.select().from(todos).where(and(
    eq(todos.userId, userId),
    eq(todos.completed, false),
    isNull(todos.deletedAt),
  ));
  const dueTodos: BriefingTodo[] = activeTodos
    .filter((t) => t.dueDate && t.dueDate.slice(0, 10) <= today)
    .map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate as string,
      overdue: (t.dueDate as string).slice(0, 10) < today,
    }))
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return a.dueDate.localeCompare(b.dueDate);
    });

  // Reminders scheduled for today.
  const remRows = await db.select().from(reminders).where(and(
    eq(reminders.userId, userId),
    gte(reminders.remindAt, dayStart),
    lte(reminders.remindAt, dayEnd),
  ));
  const remList: BriefingReminder[] = remRows
    .map((r) => ({ id: r.id, title: r.title, message: r.message, remindAt: r.remindAt }))
    .sort((a, b) => a.remindAt.localeCompare(b.remindAt));

  // D-Days within the next 7 days (today .. +7).
  const ddayRows = await db.select().from(ddays).where(eq(ddays.userId, userId));
  const ddayList: BriefingDday[] = ddayRows
    .map((d) => ({ id: d.id, title: d.title, targetDate: d.targetDate, daysLeft: calcDaysLeft(d.targetDate) }))
    .filter((d) => d.daysLeft >= 0 && d.daysLeft <= 7)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // Time-block summary for today.
  const blocks = await db.select().from(timeBlocks).where(and(
    eq(timeBlocks.userId, userId),
    eq(timeBlocks.date, today),
  ));
  const totalMinutes = blocks.reduce((sum, b) => {
    const [sh, sm] = b.startTime.split(":").map(Number);
    const [eh, em] = b.endTime.split(":").map(Number);
    return sum + Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  }, 0);

  return {
    date: today,
    period: periodOfDay(kstHour()),
    events: evList,
    todos: dueTodos,
    reminders: remList,
    ddays: ddayList,
    timeBlocks: { count: blocks.length, totalMinutes },
    counts: {
      events: evList.length,
      todos: dueTodos.length,
      overdue: dueTodos.filter((t) => t.overdue).length,
      reminders: remList.length,
      ddays: ddayList.length,
    },
  };
}

function priorityEmoji(p: string): string {
  return p === "high" ? "🔴" : p === "medium" ? "🟡" : "⚪";
}

/**
 * Render a briefing as a Telegram-friendly Markdown message.
 * `greeting` prepends a "Good morning!"-style line for the scheduled push.
 */
export function formatBriefingText(b: Briefing, opts: { greeting?: boolean; name?: string } = {}): string {
  const emoji = b.period === "morning" ? "🌅" : b.period === "evening" ? "🌙" : "☀️";
  const hello = b.period === "morning" ? "좋은 아침이에요" : b.period === "evening" ? "좋은 저녁이에요" : "안녕하세요";
  let text = opts.greeting
    ? `${emoji} *${hello}${opts.name ? `, ${opts.name}님` : ""}!*\n📅 ${b.date}\n\n`
    : `📅 *오늘의 브리핑* — ${b.date}\n\n`;

  if (b.events.length > 0) {
    text += `📌 *일정* ${b.events.length}건\n`;
    b.events.slice(0, 8).forEach((e) => {
      const time = e.allDay ? "종일" : e.startTime.slice(11, 16);
      text += `  • ${time} ${e.title}\n`;
    });
    if (b.events.length > 8) text += `  …외 ${b.events.length - 8}건\n`;
    text += "\n";
  }

  if (b.todos.length > 0) {
    const overdue = b.counts.overdue;
    text += `✅ *마감 할일* ${b.todos.length}건${overdue > 0 ? ` (지연 ${overdue})` : ""}\n`;
    b.todos.slice(0, 8).forEach((t) => {
      text += `  ${priorityEmoji(t.priority)} ${t.overdue ? "⚠️ " : ""}${t.title}\n`;
    });
    if (b.todos.length > 8) text += `  …외 ${b.todos.length - 8}건\n`;
    text += "\n";
  }

  if (b.reminders.length > 0) {
    text += `🔔 *리마인더* ${b.reminders.length}건\n`;
    b.reminders.slice(0, 6).forEach((r) => {
      text += `  • ${r.remindAt.slice(11, 16)} ${r.title}\n`;
    });
    text += "\n";
  }

  if (b.timeBlocks.count > 0) {
    const h = Math.floor(b.timeBlocks.totalMinutes / 60);
    const m = b.timeBlocks.totalMinutes % 60;
    const dur = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
    text += `⏱ *타임블록* ${b.timeBlocks.count}개 (${dur})\n\n`;
  }

  if (b.ddays.length > 0) {
    text += `🎯 *다가오는 D-Day*\n`;
    b.ddays.forEach((d) => {
      text += `  ${d.daysLeft === 0 ? "🔥 D-Day!" : `D-${d.daysLeft}`} ${d.title}\n`;
    });
    text += "\n";
  }

  if (b.events.length === 0 && b.todos.length === 0 && b.reminders.length === 0 && b.ddays.length === 0) {
    text += "✨ 오늘은 예정된 일정이 없어요. 좋은 하루 보내세요!\n\n";
  }

  return text.trimEnd();
}
