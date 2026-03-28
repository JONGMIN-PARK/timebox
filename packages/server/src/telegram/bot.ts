import TelegramBot from "node-telegram-bot-api";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../db/index.js";
import { todos, events, ddays, telegramConfig, timeBlocks, users, files, projects, projectMembers, projectTasks } from "../db/schema.js";
import { eq, gte, lte, and, inArray } from "drizzle-orm";
import cron from "node-cron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename2 = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename2);
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname2, "../../uploads");

let bot: TelegramBot | null = null;
let botUsername: string | null = null;

async function isLinkedUser(msg: TelegramBot.Message): Promise<number | null> {
  const chatId = msg.chat.id.toString();
  const conf = await db.select().from(telegramConfig).where(eq(telegramConfig.chatId, chatId));
  if (conf[0]?.userId && conf[0]?.active) return conf[0].userId;
  return null;
}

async function getUserIdFromChat(chatId: string): Promise<number | null> {
  const conf = await db.select().from(telegramConfig).where(eq(telegramConfig.chatId, chatId));
  if (conf[0]?.userId && conf[0]?.active) return conf[0].userId;
  return null;
}

function parseDateInput(input: string): string {
  const today = new Date();
  const map: Record<string, number> = { today: 0, tomorrow: 1, tmr: 1, "2d": 2, "3d": 3 };
  if (input in map) { today.setDate(today.getDate() + map[input]); return today.toISOString().slice(0, 10); }
  const parsed = new Date(input);
  return !isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : today.toISOString().slice(0, 10);
}

function parseTimeRange(input: string): { start: string; end: string } | null {
  const match = input.match(/(\d{1,2}):(\d{2})(?:\s*-\s*(\d{1,2}):(\d{2}))?/);
  if (!match) return null;
  const sH = match[1].padStart(2, "0"), sM = match[2];
  const eH = match[3] ? match[3].padStart(2, "0") : String(parseInt(sH) + 1).padStart(2, "0");
  const eM = match[4] || sM;
  return { start: `${sH}:${sM}`, end: `${eH}:${eM}` };
}

function fmtDuration(mins: number): string {
  return mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 > 0 ? `${mins % 60}m` : ""}` : `${mins}m`;
}

export async function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) { console.log("TELEGRAM_BOT_TOKEN not set, skipping"); return; }

  bot = new TelegramBot(token, { polling: { interval: 300, params: { timeout: 10 } } });

  await bot.setMyCommands([
    { command: "help", description: "도움말 보기" },
    { command: "today", description: "오늘 브리핑" },
    { command: "add", description: "일정 추가" },
    { command: "todo", description: "할일 추가" },
    { command: "list", description: "할일 목록" },
    { command: "check", description: "할일 완료 (번호)" },
    { command: "del", description: "할일 삭제 (번호)" },
    { command: "done", description: "완료된 할일" },
    { command: "dday", description: "D-Day 목록" },
    { command: "blocks", description: "오늘 타임블록" },
    { command: "week", description: "주간 요약" },
    { command: "stats", description: "통계" },
    { command: "project", description: "내 프로젝트 현황" },
    { command: "mytasks", description: "나에게 할당된 태스크" },
    { command: "inbox", description: "안읽은 메시지" },
    { command: "msg", description: "메시지 보내기" },
    { command: "link", description: "계정 연동 (코드)" },
  ]);

  // Cache bot username for QR deep links
  try {
    const me = await bot.getMe();
    botUsername = me.username || null;
    console.log(`Telegram bot initialized: @${botUsername}`);
  } catch {
    console.log("Telegram bot initialized (could not fetch username)");
  }

  // ── /start ── (handles deep link: /start link_CODE)
  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const payload = match?.[1];
    if (payload && payload.startsWith("link_")) {
      const code = payload.slice(5);
      // Reuse /link logic
      const chatId = msg.chat.id.toString();
      const { linkCodes } = await import("../lib/telegramLink.js");
      const linkData = linkCodes.get(code);
      if (!linkData) {
        bot!.sendMessage(msg.chat.id, "❌ 유효하지 않거나 만료된 코드입니다. 설정에서 새 코드를 생성해주세요.");
        return;
      }
      const existing = await db.select().from(telegramConfig).where(eq(telegramConfig.userId, linkData.userId));
      if (existing.length > 0) {
        await db.update(telegramConfig).set({ chatId, active: true, updatedAt: new Date().toISOString() })
          .where(eq(telegramConfig.userId, linkData.userId));
      } else {
        await db.insert(telegramConfig).values({ userId: linkData.userId, chatId, active: true });
      }
      linkCodes.delete(code);
      bot!.sendMessage(msg.chat.id, "✅ 계정이 연동되었습니다! 🎉\n\n/help 로 사용법을 확인하세요.", { parse_mode: "Markdown" });
      return;
    }
    bot!.sendMessage(msg.chat.id, `✅ *TimeBox Bot Connected!*\n\nType /h for quick help or /help for full commands.\n먼저 /link 코드 로 계정을 연동해주세요.`, { parse_mode: "Markdown" });
  });

  // ── /link CODE — link Telegram to a user account ──
  bot.onText(/\/link\s+(\w+)/, async (msg, match) => {
    const chatId = msg.chat.id.toString();
    const code = match?.[1];
    if (!code) {
      bot!.sendMessage(msg.chat.id, "❌ 사용법: `/link 코드`\n설정에서 생성한 연동 코드를 입력하세요.", { parse_mode: "Markdown" });
      return;
    }

    // Import linkCodes from shared location
    const { linkCodes } = await import("../lib/telegramLink.js");
    const linkData = linkCodes.get(code);
    if (!linkData) {
      bot!.sendMessage(msg.chat.id, "❌ 유효하지 않거나 만료된 코드입니다. 설정에서 새 코드를 생성해주세요.");
      return;
    }

    // Save chatId for this user
    const existing = await db.select().from(telegramConfig).where(eq(telegramConfig.userId, linkData.userId));
    if (existing.length > 0) {
      await db.update(telegramConfig).set({ chatId, active: true, updatedAt: new Date().toISOString() })
        .where(eq(telegramConfig.userId, linkData.userId));
    } else {
      await db.insert(telegramConfig).values({ userId: linkData.userId, chatId, active: true });
    }

    linkCodes.delete(code);

    const userRows = await db.select().from(users).where(eq(users.id, linkData.userId));
    const userName = userRows[0]?.displayName || userRows[0]?.username || "User";
    bot!.sendMessage(msg.chat.id, `✅ *${userName}* 계정과 연동되었습니다!\n\n이제 메시지와 알림을 텔레그램으로 받을 수 있습니다.`, { parse_mode: "Markdown" });
  });

  // ── /help or /h — Full help ──
  bot.onText(/\/(help|h)$/, (msg) => {
    bot!.sendMessage(msg.chat.id,
`📋 *TimeBox Bot Commands*

*Quick Actions:*
\`/s\` — 오늘 브리핑
\`/a\` — 일정 추가
\`/t\` — 할일 추가
\`/l\` — 할일 목록
\`/b\` — 타임블록
\`/d\` — D-Day

*프로젝트:*
\`/project\` — 내 프로젝트 현황
\`/mytasks\` — 할당된 태스크
\`/inbox\` — 안읽은 메시지
\`/msg @user 내용\` — 메시지 보내기

*할일 관리:*
\`/check N\` — N번 할일 완료
\`/del N\` — N번 할일 삭제
\`/done\` — 완료 목록

*기타:*
\`/week\` — 주간 요약
\`/stats\` — 통계
\`/link 코드\` — 계정 연동

💡 *AI 질문:* 명령어 없이 자유롭게 메시지를 보내면 AI가 답변합니다!`, { parse_mode: "Markdown" });
  });

  // ── /today or /s — Daily briefing ──
  bot.onText(/\/(today|s)$/, async (msg) => {
    const userId = await isLinkedUser(msg);
    if (!userId) { bot!.sendMessage(msg.chat.id, "❌ 먼저 /link 코드로 계정을 연동해주세요."); return; }

    const today = new Date().toISOString().slice(0, 10);

    const todayEvents = await db.select().from(events)
      .where(and(eq(events.userId, userId), gte(events.startTime, `${today}T00:00:00`), lte(events.endTime, `${today}T23:59:59`)));
    const allTodos = await db.select().from(todos).where(eq(todos.userId, userId));
    const active = allTodos.filter((t) => !t.completed);
    const completed = allTodos.filter((t) => t.completed);
    const todayBlocks = await db.select().from(timeBlocks).where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.date, today)));

    let text = `📅 *Daily Briefing* — ${today}\n\n`;

    if (todayEvents.length > 0) {
      text += `📌 *Events* (${todayEvents.length})\n`;
      todayEvents.sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach((e) => {
        text += `  • ${e.startTime.slice(11, 16)} ${e.title}\n`;
      });
      text += "\n";
    }

    if (todayBlocks.length > 0) {
      const totalMin = todayBlocks.reduce((s, b) => {
        const [sh, sm] = b.startTime.split(":").map(Number);
        const [eh, em] = b.endTime.split(":").map(Number);
        return s + (eh * 60 + em) - (sh * 60 + sm);
      }, 0);
      text += `⏱ *Time Blocks* (${todayBlocks.length} / ${fmtDuration(totalMin)})\n`;
      todayBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach((b) => {
        text += `  ${b.completed ? "✅" : "⬜"} ${b.startTime}-${b.endTime} ${b.title}\n`;
      });
      text += "\n";
    }

    text += `✅ *Todos* (${completed.length}/${allTodos.length} done)\n`;
    active.slice(0, 10).forEach((t, i) => {
      const p = t.priority === "high" ? "🔴" : t.priority === "medium" ? "🟡" : "⚪";
      text += `  ${i + 1}. ${p} ${t.title}\n`;
    });
    if (active.length > 10) text += `  ...and ${active.length - 10} more\n`;

    bot!.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
  });

  // ── /add or /a — Add event ──
  bot.onText(/\/(add|a)\s+(.+)/, async (msg, match) => {
    const userId = await isLinkedUser(msg);
    if (!userId) { bot!.sendMessage(msg.chat.id, "❌ 먼저 /link 코드로 계정을 연동해주세요."); return; }
    if (!match) return;

    const parts = match[2].trim().split(/\s+/);
    let dateStr = new Date().toISOString().slice(0, 10);
    let timeRange: { start: string; end: string } | null = null;
    let titleParts: string[] = [];

    for (let i = 0; i < parts.length; i++) {
      const tr = parseTimeRange(parts[i]);
      if (tr) { timeRange = tr; titleParts = parts.slice(i + 1); break; }
      else if (i === 0 && ["today", "tomorrow", "tmr", "2d", "3d"].includes(parts[i].toLowerCase())) {
        dateStr = parseDateInput(parts[i].toLowerCase());
      } else { titleParts = parts.slice(i); break; }
    }

    if (!titleParts.length) {
      bot!.sendMessage(msg.chat.id, "❌ Usage: `/add [date] [time] title`\nEx: `/add tomorrow 14:00 Team meeting`", { parse_mode: "Markdown" });
      return;
    }

    const title = titleParts.join(" ");
    const start = timeRange?.start || "09:00";
    const end = timeRange?.end || "10:00";

    await db.insert(events).values({
      userId, title, startTime: `${dateStr}T${start}:00`, endTime: `${dateStr}T${end}:00`, allDay: false, color: "#3b82f6",
    });

    bot!.sendMessage(msg.chat.id, `✅ *Event added*\n📅 ${dateStr} ${start}-${end}\n📝 ${title}`, { parse_mode: "Markdown" });
  });

  // ── /todo or /t — Add todo ──
  bot.onText(/\/(todo|t)\s+(.+)/, async (msg, match) => {
    const userId = await isLinkedUser(msg);
    if (!userId) { bot!.sendMessage(msg.chat.id, "❌ 먼저 /link 코드로 계정을 연동해주세요."); return; }
    if (!match) return;

    let text = match[2].trim();
    let priority = "medium";
    let category = "personal";

    if (text.includes("!high") || text.includes("!h")) { priority = "high"; text = text.replace(/!high|!h/g, "").trim(); }
    else if (text.includes("!low") || text.includes("!l")) { priority = "low"; text = text.replace(/!low|!l/g, "").trim(); }

    if (text.includes("@work") || text.includes("@w")) { category = "work"; text = text.replace(/@work|@w/g, "").trim(); }
    else if (text.includes("@study") || text.includes("@s")) { category = "study"; text = text.replace(/@study|@s/g, "").trim(); }
    else if (text.includes("@project") || text.includes("@p")) { category = "project"; text = text.replace(/@project|@p/g, "").trim(); }
    else if (text.includes("@urgent") || text.includes("@u")) { category = "urgent"; text = text.replace(/@urgent|@u/g, "").trim(); }

    if (!text) { bot!.sendMessage(msg.chat.id, "❌ Please provide a task title"); return; }

    const allTodos = await db.select().from(todos).where(eq(todos.userId, userId));
    const maxOrder = allTodos.reduce((max, t) => Math.max(max, t.sortOrder), -1);
    await db.insert(todos).values({
      userId, title: text, priority, category, sortOrder: maxOrder + 1, dueDate: new Date().toISOString().slice(0, 10),
    });

    const emoji = priority === "high" ? "🔴" : priority === "low" ? "⚪" : "🟡";
    bot!.sendMessage(msg.chat.id, `✅ *Todo added*\n${emoji} ${text}\n📂 ${category}`, { parse_mode: "Markdown" });
  });

  // ── /list or /l — List active todos ──
  bot.onText(/\/(list|l)$/, async (msg) => {
    const userId = await isLinkedUser(msg);
    if (!userId) { bot!.sendMessage(msg.chat.id, "❌ 먼저 /link 코드로 계정을 연동해주세요."); return; }

    const active = (await db.select().from(todos).where(and(eq(todos.userId, userId), eq(todos.completed, false))))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    if (active.length === 0) { bot!.sendMessage(msg.chat.id, "✨ No active todos!"); return; }

    let text = `📋 *Active Todos* (${active.length})\n\n`;
    active.forEach((t, i) => {
      const p = t.priority === "high" ? "🔴" : t.priority === "medium" ? "🟡" : "⚪";
      text += `${i + 1}. ${p} ${t.title}`;
      if (t.dueDate) text += ` 📅${t.dueDate.slice(5)}`;
      text += "\n";
    });
    text += `\n_Use /check N to complete, /del N to delete_`;

    bot!.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
  });

  // ── /check N — Complete todo by number ──
  bot.onText(/\/check\s+(\d+)/, async (msg, match) => {
    const userId = await isLinkedUser(msg);
    if (!userId) { bot!.sendMessage(msg.chat.id, "❌ 먼저 /link 코드로 계정을 연동해주세요."); return; }
    if (!match) return;

    const num = parseInt(match[1]);
    const active = (await db.select().from(todos).where(and(eq(todos.userId, userId), eq(todos.completed, false))))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    if (num < 1 || num > active.length) {
      bot!.sendMessage(msg.chat.id, `❌ Invalid number. Use /list to see todos (1-${active.length})`);
      return;
    }

    const todo = active[num - 1];
    await db.update(todos).set({ completed: true, updatedAt: new Date().toISOString() }).where(eq(todos.id, todo.id));
    bot!.sendMessage(msg.chat.id, `✅ Completed: ~${todo.title}~`, { parse_mode: "Markdown" });
  });

  // ── /del N — Delete todo by number ──
  bot.onText(/\/del\s+(\d+)/, async (msg, match) => {
    const userId = await isLinkedUser(msg);
    if (!userId) { bot!.sendMessage(msg.chat.id, "❌ 먼저 /link 코드로 계정을 연동해주세요."); return; }
    if (!match) return;

    const num = parseInt(match[1]);
    const active = (await db.select().from(todos).where(and(eq(todos.userId, userId), eq(todos.completed, false))))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    if (num < 1 || num > active.length) {
      bot!.sendMessage(msg.chat.id, `❌ Invalid number. Use /list to see todos (1-${active.length})`);
      return;
    }

    const todo = active[num - 1];
    await db.delete(todos).where(eq(todos.id, todo.id));
    bot!.sendMessage(msg.chat.id, `🗑 Deleted: ${todo.title}`);
  });

  // ── /done — Show completed todos ──
  bot.onText(/\/done$/, async (msg) => {
    const userId = await isLinkedUser(msg);
    if (!userId) { bot!.sendMessage(msg.chat.id, "❌ 먼저 /link 코드로 계정을 연동해주세요."); return; }

    const completed = await db.select().from(todos).where(and(eq(todos.userId, userId), eq(todos.completed, true)));

    if (completed.length === 0) { bot!.sendMessage(msg.chat.id, "No completed todos yet"); return; }

    let text = `✅ *Completed* (${completed.length})\n\n`;
    completed.slice(-10).forEach((t) => { text += `  ~${t.title}~\n`; });
    if (completed.length > 10) text += `  ...and ${completed.length - 10} more\n`;

    bot!.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
  });

  // ── /dday or /d ──
  bot.onText(/\/(dday|d)$/, async (msg) => {
    const userId = await isLinkedUser(msg);
    if (!userId) { bot!.sendMessage(msg.chat.id, "❌ 먼저 /link 코드로 계정을 연동해주세요."); return; }

    const allDdays = await db.select().from(ddays).where(eq(ddays.userId, userId));

    if (allDdays.length === 0) { bot!.sendMessage(msg.chat.id, "📅 No D-Days set"); return; }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    let text = "📅 *D-Day List*\n\n";
    allDdays.sort((a, b) => a.targetDate.localeCompare(b.targetDate)).forEach((d) => {
      const target = new Date(d.targetDate); target.setHours(0, 0, 0, 0);
      const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const label = diff === 0 ? "🔥 D-Day!" : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
      text += `  ${label} ${d.title}\n`;
    });

    bot!.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
  });

  // ── /blocks or /b ──
  bot.onText(/\/(blocks|b)$/, async (msg) => {
    const userId = await isLinkedUser(msg);
    if (!userId) { bot!.sendMessage(msg.chat.id, "❌ 먼저 /link 코드로 계정을 연동해주세요."); return; }

    const today = new Date().toISOString().slice(0, 10);
    const blocks = await db.select().from(timeBlocks).where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.date, today)));

    if (blocks.length === 0) { bot!.sendMessage(msg.chat.id, "⏱ No time blocks today"); return; }

    let text = `⏱ *Today's Time Blocks*\n\n`;
    blocks.sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach((b) => {
      text += `${b.completed ? "✅" : "⬜"} ${b.startTime}-${b.endTime} ${b.title}\n`;
    });

    bot!.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
  });

  // ── /week — Week summary ──
  bot.onText(/\/week$/, async (msg) => {
    const userId = await isLinkedUser(msg);
    if (!userId) { bot!.sendMessage(msg.chat.id, "❌ 먼저 /link 코드로 계정을 연동해주세요."); return; }

    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
    const startStr = weekStart.toISOString().slice(0, 10);
    const endStr = weekEnd.toISOString().slice(0, 10);

    const weekEvents = await db.select().from(events)
      .where(and(eq(events.userId, userId), gte(events.startTime, `${startStr}T00:00:00`), lte(events.endTime, `${endStr}T23:59:59`)));

    const allTodos = await db.select().from(todos).where(eq(todos.userId, userId));
    const allBlocks = await db.select().from(timeBlocks).where(eq(timeBlocks.userId, userId));
    const weekBlocks = allBlocks.filter((b) => b.date >= startStr && b.date <= endStr);

    const totalBlockMins = weekBlocks.reduce((s, b) => {
      const [sh, sm] = b.startTime.split(":").map(Number);
      const [eh, em] = b.endTime.split(":").map(Number);
      return s + (eh * 60 + em) - (sh * 60 + sm);
    }, 0);

    const allDdays2 = await db.select().from(ddays).where(eq(ddays.userId, userId));
    let text = `📊 *Week Summary* (${startStr} ~ ${endStr})\n\n`;
    text += `📌 Events: ${weekEvents.length}\n`;
    text += `⏱ Time blocks: ${weekBlocks.length} (${fmtDuration(totalBlockMins)})\n`;
    text += `✅ Todos: ${allTodos.filter((t) => t.completed).length}/${allTodos.length} done\n`;
    text += `📅 Upcoming D-Days: ${allDdays2.filter((d) => {
      const diff = Math.ceil((new Date(d.targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 7;
    }).length}\n`;

    bot!.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
  });

  // ── /stats — Statistics ──
  bot.onText(/\/stats$/, async (msg) => {
    const userId = await isLinkedUser(msg);
    if (!userId) { bot!.sendMessage(msg.chat.id, "❌ 먼저 /link 코드로 계정을 연동해주세요."); return; }

    const allTodos = await db.select().from(todos).where(eq(todos.userId, userId));
    const allEvents = await db.select().from(events).where(eq(events.userId, userId));
    const allBlocks = await db.select().from(timeBlocks).where(eq(timeBlocks.userId, userId));
    const allDdays2 = await db.select().from(ddays).where(eq(ddays.userId, userId));

    const catCounts: Record<string, number> = {};
    allTodos.forEach((t) => {
      const root = (t.category || "personal").split(".")[0];
      catCounts[root] = (catCounts[root] || 0) + 1;
    });

    let text = `📊 *Statistics*\n\n`;
    text += `📋 Todos: ${allTodos.length} total (${allTodos.filter((t) => t.completed).length} done)\n`;
    text += `📌 Events: ${allEvents.length}\n`;
    text += `⏱ Time Blocks: ${allBlocks.length}\n`;
    text += `📅 D-Days: ${allDdays2.length}\n`;
    text += `\n*Todo Categories:*\n`;
    Object.entries(catCounts).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
      text += `  ${cat}: ${count}\n`;
    });

    bot!.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
  });

  // ── /project or /p — My project status ──
  bot.onText(/\/(project|p)$/, async (msg) => {
    const userId = await isLinkedUser(msg);
    if (!userId) { bot!.sendMessage(msg.chat.id, "❌ 먼저 /link 코드로 계정을 연동해주세요."); return; }

    const { projectMembers, projects, projectTasks } = await import("../db/schema.js");
    const memberships = await db.select().from(projectMembers).where(eq(projectMembers.userId, userId));
    if (memberships.length === 0) { bot!.sendMessage(msg.chat.id, "📁 참여 중인 프로젝트가 없습니다."); return; }

    const projectIds = memberships.map(m => m.projectId);
    const myProjects = await db.select().from(projects).where(inArray(projects.id, projectIds));
    const allTasks = await db.select().from(projectTasks).where(inArray(projectTasks.projectId, projectIds));

    let text = "📁 *내 프로젝트*\n\n";
    for (const p of myProjects) {
      const tasks = allTasks.filter(t => t.projectId === p.id);
      const done = tasks.filter(t => t.status === "done").length;
      const total = tasks.length;
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;
      const myTasks = tasks.filter(t => t.assigneeId === userId && t.status !== "done").length;

      let dDayStr = "";
      if (p.targetDate) {
        const diff = Math.ceil((new Date(p.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        dDayStr = diff === 0 ? " 🔥D-Day" : diff > 0 ? ` D-${diff}` : ` D+${Math.abs(diff)}`;
      }

      text += `*${p.name}*${dDayStr}\n`;
      text += `  진행: ${progress}% (${done}/${total})`;
      if (myTasks > 0) text += ` | 내 할일: ${myTasks}개`;
      text += "\n\n";
    }

    bot!.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
  });

  // ── /mytasks or /mt — My assigned tasks ──
  bot.onText(/\/(mytasks|mt)$/, async (msg) => {
    const userId = await isLinkedUser(msg);
    if (!userId) { bot!.sendMessage(msg.chat.id, "❌ 먼저 /link 코드로 계정을 연동해주세요."); return; }

    const { projectTasks, projects } = await import("../db/schema.js");
    const myTasks = await db.select().from(projectTasks).where(eq(projectTasks.assigneeId, userId));
    const activeTasks = myTasks.filter(t => t.status !== "done");

    if (activeTasks.length === 0) { bot!.sendMessage(msg.chat.id, "✨ 할당된 태스크가 없습니다!"); return; }

    const projectIds = [...new Set(activeTasks.map(t => t.projectId))];
    const taskProjects = await db.select().from(projects).where(inArray(projects.id, projectIds));
    const projectMap = new Map(taskProjects.map(p => [p.id, p.name]));

    let text = `📋 *내 태스크* (${activeTasks.length}개)\n\n`;
    const statusIcon: Record<string, string> = { backlog: "⬜", todo: "📝", in_progress: "🔄", review: "👀" };

    activeTasks.forEach((t, i) => {
      const icon = statusIcon[t.status] || "📌";
      const project = projectMap.get(t.projectId) || "";
      text += `${i + 1}. ${icon} ${t.title}\n`;
      text += `   📁 ${project}`;
      if (t.dueDate) text += ` | 📅 ${t.dueDate.slice(0, 10)}`;
      text += "\n";
    });

    bot!.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
  });

  // ── /inbox or /i — Unread messages ──
  bot.onText(/\/(inbox|i)$/, async (msg) => {
    const userId = await isLinkedUser(msg);
    if (!userId) { bot!.sendMessage(msg.chat.id, "❌ 먼저 /link 코드로 계정을 연동해주세요."); return; }

    const { inboxMessages } = await import("../db/schema.js");
    const unread = await db.select().from(inboxMessages)
      .where(and(eq(inboxMessages.toUserId, userId), eq(inboxMessages.read, false)));

    if (unread.length === 0) { bot!.sendMessage(msg.chat.id, "📭 새 메시지가 없습니다."); return; }

    // Get sender names
    const senderIds = [...new Set(unread.map(m => m.fromUserId))];
    const senders = senderIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, senderIds)) : [];
    const senderMap = new Map(senders.map(s => [s.id, s.displayName || s.username]));

    let text = `📬 *안읽은 메시지* (${unread.length}개)\n\n`;
    unread.slice(0, 10).forEach((m, i) => {
      const from = senderMap.get(m.fromUserId) || "Unknown";
      const typeIcon = m.type === "task_assignment" ? "📋" : m.type === "system" ? "🔔" : "💬";
      text += `${i + 1}. ${typeIcon} *${m.subject}*\n   👤 ${from} | ${m.createdAt.slice(0, 10)}\n\n`;
    });
    if (unread.length > 10) text += `...+${unread.length - 10}개 더\n`;

    bot!.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
  });

  // ── /msg or /m — Send message ──
  bot.onText(/\/(msg|m)\s+(\S+)\s+(.+)/, async (msg, match) => {
    const userId = await isLinkedUser(msg);
    if (!userId) { bot!.sendMessage(msg.chat.id, "❌ 먼저 /link 코드로 계정을 연동해주세요."); return; }
    if (!match) return;

    const targetUsername = match[2];
    const content = match[3].trim();

    const targetUser = await db.select().from(users).where(eq(users.username, targetUsername));
    if (!targetUser[0]) { bot!.sendMessage(msg.chat.id, `❌ 사용자 "${targetUsername}"을(를) 찾을 수 없습니다.`); return; }

    const { inboxMessages } = await import("../db/schema.js");
    const senderRows = await db.select().from(users).where(eq(users.id, userId));
    const fromName = senderRows[0]?.displayName || senderRows[0]?.username || "Unknown";

    await db.insert(inboxMessages).values({
      fromUserId: userId,
      toUserId: targetUser[0].id,
      subject: `${fromName}님의 텔레그램 메시지`,
      content,
      type: "message",
    });

    // Also send telegram notification to recipient if they have it linked
    const recipientConf = await db.select().from(telegramConfig).where(eq(telegramConfig.userId, targetUser[0].id));
    if (recipientConf[0]?.chatId && recipientConf[0]?.active && bot) {
      const preview = content.length > 100 ? content.slice(0, 100) + "..." : content;
      await bot.sendMessage(recipientConf[0].chatId, `📬 *새 메시지*\n👤 ${fromName}\n\n${preview}`, { parse_mode: "Markdown" });
    }

    bot!.sendMessage(msg.chat.id, `✅ ${targetUser[0].displayName || targetUser[0].username}에게 메시지를 보냈습니다.`);
  });

  // ── File handler — auto-save to vault ──
  bot.on("document", async (msg) => {
    const userId = await getUserIdFromChat(msg.chat.id.toString());
    if (!userId || !msg.document) {
      if (!userId) bot!.sendMessage(msg.chat.id, "❌ 먼저 /link 코드로 계정을 연동해주세요.");
      return;
    }
    const doc = msg.document;

    try {
      const fileLink = await bot!.getFileLink(doc.file_id);
      const response = await fetch(fileLink);
      const buffer = Buffer.from(await response.arrayBuffer());

      if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      const ext = path.extname(doc.file_name || "");
      const storedName = `${crypto.randomUUID()}${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, storedName), buffer);

      await db.insert(files).values({
        userId,
        originalName: doc.file_name || "unnamed",
        storedName,
        mimeType: doc.mime_type || "application/octet-stream",
        size: doc.file_size || buffer.length,
        tags: JSON.stringify(["Telegram"]),
        uploadedVia: "telegram",
      });

      bot!.sendMessage(msg.chat.id, `📁 File saved to Vault: ${doc.file_name}`);
    } catch (err) {
      bot!.sendMessage(msg.chat.id, "❌ Failed to save file");
    }
  });

  // ── Photo handler ──
  bot.on("photo", async (msg) => {
    const userId = await getUserIdFromChat(msg.chat.id.toString());
    if (!userId || !msg.photo) {
      if (!userId) bot!.sendMessage(msg.chat.id, "❌ 먼저 /link 코드로 계정을 연동해주세요.");
      return;
    }
    const photo = msg.photo[msg.photo.length - 1];

    try {
      const fileLink = await bot!.getFileLink(photo.file_id);
      const response = await fetch(fileLink);
      const buffer = Buffer.from(await response.arrayBuffer());

      if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      const storedName = `${crypto.randomUUID()}.jpg`;
      fs.writeFileSync(path.join(UPLOAD_DIR, storedName), buffer);

      await db.insert(files).values({
        userId,
        originalName: `photo_${new Date().toISOString().slice(0, 10)}.jpg`,
        storedName,
        mimeType: "image/jpeg",
        size: buffer.length,
        tags: JSON.stringify(["Telegram", "Photo"]),
        uploadedVia: "telegram",
      });

      bot!.sendMessage(msg.chat.id, `📸 Photo saved to Vault`);
    } catch (err) {
      bot!.sendMessage(msg.chat.id, "❌ Failed to save photo");
    }
  });

  // ── Gemini AI Q&A: catch-all for non-command messages ──
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const genAI = new GoogleGenerativeAI(geminiKey);

    // Per-chat conversation history (max 20 turns)
    const chatHistories = new Map<string, { role: string; parts: { text: string }[] }[]>();

    bot.on("message", async (msg) => {
      // Skip commands, photos, and non-text messages
      if (!msg.text || msg.text.startsWith("/")) return;
      const userId = await getUserIdFromChat(msg.chat.id.toString());
      if (!userId) return;

      const chatKey = msg.chat.id.toString();

      try {
        // Get user info and model
        const [userRow] = await db.select().from(users).where(eq(users.id, userId));
        if (!userRow) return;
        const isAdmin = userRow.role === "admin";
        const modelName = userRow.aiModel || "gemini-2.0-flash";
        const model = genAI.getGenerativeModel({ model: modelName });

        const today = new Date().toISOString().slice(0, 10);
        let contextLines: string[] = [`오늘 날짜: ${today}`, `사용자: ${userRow.displayName || userRow.username} (${userRow.role})`];

        if (isAdmin) {
          // Admin: full app data
          const [allUsers, allTodos, allEvents, allBlocks, allDdays, allProjects, allTasks] = await Promise.all([
            db.select({ id: users.id, username: users.username, displayName: users.displayName, role: users.role, active: users.active }).from(users),
            db.select().from(todos).where(eq(todos.completed, false)),
            db.select().from(events).where(and(gte(events.startTime, today), lte(events.startTime, today + "T23:59:59"))),
            db.select().from(timeBlocks).where(eq(timeBlocks.date, today)),
            db.select().from(ddays),
            db.select().from(projects),
            db.select().from(projectTasks),
          ]);

          contextLines.push(
            `\n[전체 사용자 ${allUsers.length}명]: ${allUsers.map(u => `${u.displayName || u.username}(${u.role}${u.active ? "" : ",비활성"})`).join(", ")}`,
            `\n[전체 미완료 할일 ${allTodos.length}개]: ${allTodos.slice(0, 15).map(t => `${t.title}(우선순위:${t.priority},진행:${t.progress}%)`).join(", ")}${allTodos.length > 15 ? ` ...외 ${allTodos.length - 15}개` : ""}`,
            `\n[오늘 일정 ${allEvents.length}개]: ${allEvents.slice(0, 10).map(e => `${e.startTime.slice(11, 16)} ${e.title}`).join(", ")}`,
            `\n[오늘 타임블록 ${allBlocks.length}개]: ${allBlocks.slice(0, 10).map(b => `${b.startTime}-${b.endTime} ${b.title}`).join(", ")}`,
            `\n[D-Day ${allDdays.length}개]: ${allDdays.slice(0, 10).map(d => `${d.title}(${d.targetDate})`).join(", ")}`,
            `\n[프로젝트 ${allProjects.length}개]: ${allProjects.map(p => `${p.name}(${p.archived ? "보관됨" : "진행중"})`).join(", ")}`,
            `\n[프로젝트 태스크 ${allTasks.length}개]: ${allTasks.slice(0, 10).map(t => `${t.title}(${t.status},${t.priority})`).join(", ")}${allTasks.length > 10 ? ` ...외 ${allTasks.length - 10}개` : ""}`,
          );
        } else {
          // Regular user: own data + assigned projects
          const [userTodos, userEvents, userBlocks, userDdays, memberOf] = await Promise.all([
            db.select().from(todos).where(and(eq(todos.userId, userId), eq(todos.completed, false))),
            db.select().from(events).where(and(eq(events.userId, userId), gte(events.startTime, today), lte(events.startTime, today + "T23:59:59"))),
            db.select().from(timeBlocks).where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.date, today))),
            db.select().from(ddays).where(eq(ddays.userId, userId)),
            db.select({ projectId: projectMembers.projectId }).from(projectMembers).where(eq(projectMembers.userId, userId)),
          ]);

          contextLines.push(
            userTodos.length > 0 ? `\n[내 할일 ${userTodos.length}개]: ${userTodos.slice(0, 10).map(t => `${t.title}(${t.priority},${t.progress}%)`).join(", ")}` : "\n할일 없음",
            userEvents.length > 0 ? `\n[오늘 일정 ${userEvents.length}개]: ${userEvents.slice(0, 10).map(e => `${e.startTime.slice(11, 16)} ${e.title}`).join(", ")}` : "\n오늘 일정 없음",
            userBlocks.length > 0 ? `\n[타임블록 ${userBlocks.length}개]: ${userBlocks.slice(0, 10).map(b => `${b.startTime}-${b.endTime} ${b.title}`).join(", ")}` : "\n타임블록 없음",
            userDdays.length > 0 ? `\n[D-Day ${userDdays.length}개]: ${userDdays.map(d => `${d.title}(${d.targetDate})`).join(", ")}` : "",
          );

          if (memberOf.length > 0) {
            const projectIds = memberOf.map(m => m.projectId);
            const [myProjects, myTasks] = await Promise.all([
              db.select().from(projects).where(inArray(projects.id, projectIds)),
              db.select().from(projectTasks).where(inArray(projectTasks.projectId, projectIds)),
            ]);
            contextLines.push(
              `\n[내 프로젝트 ${myProjects.length}개]: ${myProjects.map(p => `${p.name}(${p.archived ? "보관됨" : "진행중"})`).join(", ")}`,
              myTasks.length > 0 ? `\n[프로젝트 태스크 ${myTasks.length}개]: ${myTasks.slice(0, 10).map(t => `${t.title}(${t.status})`).join(", ")}` : "",
            );
          }
        }

        const systemPrompt = `너는 TimeBox 일정관리 앱의 AI 비서야. ${isAdmin ? "관리자로서 앱의 모든 데이터에 접근 가능하다." : "사용자 본인의 데이터만 접근 가능하다."}
앱 기능: 할일관리, 캘린더, 타임블록 스케줄러, D-Day, 프로젝트 관리, 파일 보관함, 팀 채팅.

현재 데이터:
${contextLines.filter(Boolean).join("\n")}

답변은 텔레그램에서 보기 좋게 짧고 핵심적으로. 일반 질문에도 자유롭게 답변해.`;

        // Get or create chat history
        let history = chatHistories.get(chatKey) || [];

        const chat = model.startChat({
          history: [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: "네, TimeBox AI 비서로서 도움드리겠습니다!" }] },
            ...history,
          ],
        });

        const result = await chat.sendMessage(msg.text);
        const reply = result.response.text();

        // Save to history (keep last 20 turns)
        history.push({ role: "user", parts: [{ text: msg.text }] });
        history.push({ role: "model", parts: [{ text: reply }] });
        if (history.length > 40) history = history.slice(-40);
        chatHistories.set(chatKey, history);

        await bot!.sendMessage(msg.chat.id, reply, { parse_mode: "Markdown" }).catch(() =>
          bot!.sendMessage(msg.chat.id, reply)
        );
      } catch (e) {
        console.error("[gemini]", e);
        bot!.sendMessage(msg.chat.id, "⚠️ AI 응답 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
    });

    console.log("[telegram] Gemini AI Q&A enabled");
  }

  await setupDailyBriefing();
}

async function setupDailyBriefing() {
  const conf = await db.select().from(telegramConfig).limit(1);
  const briefingTime = conf[0]?.dailyBriefingTime || "08:00";
  const [hour, minute] = briefingTime.split(":").map(Number);

  cron.schedule(`${minute} ${hour} * * *`, () => sendDailyBriefing());
  console.log(`Daily briefing scheduled at ${briefingTime}`);
}

async function sendDailyBriefing() {
  if (!bot) return;
  // Send daily briefing to all linked users
  const allConf = await db.select().from(telegramConfig);
  const activeConfs = allConf.filter((c) => c.chatId && c.active);
  if (activeConfs.length === 0) return;

  const today = new Date().toISOString().slice(0, 10);
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);

  for (const conf of activeConfs) {
    try {
      const userId = conf.userId!;

      const todayEvents = await db.select().from(events)
        .where(and(eq(events.userId, userId), gte(events.startTime, `${today}T00:00:00`), lte(events.endTime, `${today}T23:59:59`)));
      const activeTodos = await db.select().from(todos).where(and(eq(todos.userId, userId), eq(todos.completed, false)));
      const todayBlocks = await db.select().from(timeBlocks).where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.date, today)));
      const allDdays2 = await db.select().from(ddays).where(eq(ddays.userId, userId));
      const upcoming = allDdays2.filter((d) => {
        const diff = Math.ceil((new Date(d.targetDate).getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
        return diff >= 0 && diff <= 7;
      });

      let text = `🌅 *Good morning! Daily Briefing*\n📅 ${today}\n\n`;

      if (todayEvents.length > 0) {
        text += `📌 ${todayEvents.length} events\n`;
        todayEvents.sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach((e) => {
          text += `  • ${e.startTime.slice(11, 16)} ${e.title}\n`;
        });
        text += "\n";
      }

      if (todayBlocks.length > 0) {
        text += `⏱ ${todayBlocks.length} time blocks\n`;
        todayBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach((b) => {
          text += `  • ${b.startTime}-${b.endTime} ${b.title}\n`;
        });
        text += "\n";
      }

      if (activeTodos.length > 0) {
        text += `✅ ${activeTodos.length} active todos\n`;
        activeTodos.slice(0, 5).forEach((t) => {
          const p = t.priority === "high" ? "🔴" : t.priority === "medium" ? "🟡" : "⚪";
          text += `  ${p} ${t.title}\n`;
        });
        if (activeTodos.length > 5) text += `  ...+${activeTodos.length - 5} more\n`;
        text += "\n";
      }

      if (upcoming.length > 0) {
        text += `🎯 Upcoming D-Days\n`;
        upcoming.forEach((d) => {
          const diff = Math.ceil((new Date(d.targetDate).getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
          text += `  ${diff === 0 ? "🔥 D-Day!" : `D-${diff}`} ${d.title}\n`;
        });
      }

      text += `\n_Type /h for commands_`;

      bot.sendMessage(conf.chatId!, text, { parse_mode: "Markdown" });
    } catch (e) {
      console.error(`daily-briefing send to ${conf.chatId}:`, e);
    }
  }
}

export function getTelegramBot() { return bot; }
export function getTelegramBotUsername() { return botUsername; }
