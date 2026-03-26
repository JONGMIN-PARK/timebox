import TelegramBot from "node-telegram-bot-api";
import { db } from "../db/index.js";
import { todos, events, ddays, telegramConfig, timeBlocks, users } from "../db/schema.js";
import { eq, gte, lte, and } from "drizzle-orm";
import cron from "node-cron";

let bot: TelegramBot | null = null;

// ── Helpers ──
function getUserIdFromChat(chatId: string): number | null {
  const conf = db.select().from(telegramConfig).all().find((c) => c.chatId === chatId);
  return conf ? 1 : null; // Default to user 1 for now
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

export function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) { console.log("TELEGRAM_BOT_TOKEN not set, skipping"); return; }

  bot = new TelegramBot(token, { polling: true });
  console.log("Telegram bot initialized");

  // Save config
  const existing = db.select().from(telegramConfig).all();
  if (existing.length === 0) {
    db.insert(telegramConfig).values({ chatId: process.env.TELEGRAM_CHAT_ID || null, active: true }).run();
  }

  // ── /start ──
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id.toString();
    const conf = db.select().from(telegramConfig).limit(1).all();
    if (conf.length > 0) {
      db.update(telegramConfig).set({ chatId, active: true, updatedAt: new Date().toISOString() }).where(eq(telegramConfig.id, conf[0].id)).run();
    }
    bot!.sendMessage(msg.chat.id, `✅ *TimeBox Bot Connected!*\n\nType /h for quick help or /help for full commands.`, { parse_mode: "Markdown" });
  });

  // ── /help or /h — Full help ──
  bot.onText(/\/(help|h)$/, (msg) => {
    bot!.sendMessage(msg.chat.id,
`📋 *TimeBox Bot Commands*

*Quick Actions (shortcuts):*
\`/a\` — Add event (same as /add)
\`/t\` — Add todo (same as /todo)
\`/d\` — D-Day list (same as /dday)
\`/b\` — Today's blocks (same as /blocks)
\`/s\` — Summary (same as /today)

*Events:*
\`/add [date] [time] title\`
  /add meeting with John
  /add tomorrow 14:00 team standup
  /add 14:00-15:30 code review

*Todos:*
\`/todo title [!high|!low]\`
  /todo finish report !high
  /todo buy groceries

*Quick Todo:*
\`/t title\` — add with default priority

*View:*
\`/today\` or \`/s\` — daily briefing
\`/blocks\` or \`/b\` — time blocks
\`/dday\` or \`/d\` — D-Day list
\`/list\` or \`/l\` — active todos
\`/done\` — completed todos
\`/week\` — week summary
\`/stats\` — statistics

*Actions:*
\`/check [number]\` — complete todo #N
\`/del [number]\` — delete todo #N`, { parse_mode: "Markdown" });
  });

  // ── /today or /s — Daily briefing ──
  bot.onText(/\/(today|s)$/, (msg) => {
    if (!isAuthorized(msg)) return;
    const today = new Date().toISOString().slice(0, 10);

    const todayEvents = db.select().from(events)
      .where(and(gte(events.startTime, `${today}T00:00:00`), lte(events.endTime, `${today}T23:59:59`)))
      .all();
    const allTodos = db.select().from(todos).all();
    const active = allTodos.filter((t) => !t.completed);
    const completed = allTodos.filter((t) => t.completed);
    const todayBlocks = db.select().from(timeBlocks).where(eq(timeBlocks.date, today)).all();

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
  bot.onText(/\/(add|a)\s+(.+)/, (msg, match) => {
    if (!isAuthorized(msg) || !match) return;
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

    db.insert(events).values({
      userId: 1, title, startTime: `${dateStr}T${start}:00`, endTime: `${dateStr}T${end}:00`, allDay: false, color: "#3b82f6",
    }).run();

    bot!.sendMessage(msg.chat.id, `✅ *Event added*\n📅 ${dateStr} ${start}-${end}\n📝 ${title}`, { parse_mode: "Markdown" });
  });

  // ── /todo or /t — Add todo ──
  bot.onText(/\/(todo|t)\s+(.+)/, (msg, match) => {
    if (!isAuthorized(msg) || !match) return;
    let text = match[2].trim();
    let priority = "medium";
    let category = "personal";

    // Parse flags
    if (text.includes("!high") || text.includes("!h")) { priority = "high"; text = text.replace(/!high|!h/g, "").trim(); }
    else if (text.includes("!low") || text.includes("!l")) { priority = "low"; text = text.replace(/!low|!l/g, "").trim(); }

    if (text.includes("@work") || text.includes("@w")) { category = "work"; text = text.replace(/@work|@w/g, "").trim(); }
    else if (text.includes("@study") || text.includes("@s")) { category = "study"; text = text.replace(/@study|@s/g, "").trim(); }
    else if (text.includes("@project") || text.includes("@p")) { category = "project"; text = text.replace(/@project|@p/g, "").trim(); }
    else if (text.includes("@urgent") || text.includes("@u")) { category = "urgent"; text = text.replace(/@urgent|@u/g, "").trim(); }

    if (!text) { bot!.sendMessage(msg.chat.id, "❌ Please provide a task title"); return; }

    const maxOrder = db.select().from(todos).all().reduce((max, t) => Math.max(max, t.sortOrder), -1);
    db.insert(todos).values({
      userId: 1, title: text, priority, category, sortOrder: maxOrder + 1, dueDate: new Date().toISOString().slice(0, 10),
    }).run();

    const emoji = priority === "high" ? "🔴" : priority === "low" ? "⚪" : "🟡";
    bot!.sendMessage(msg.chat.id, `✅ *Todo added*\n${emoji} ${text}\n📂 ${category}`, { parse_mode: "Markdown" });
  });

  // ── /list or /l — List active todos ──
  bot.onText(/\/(list|l)$/, (msg) => {
    if (!isAuthorized(msg)) return;
    const active = db.select().from(todos).where(eq(todos.completed, false)).all()
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
  bot.onText(/\/check\s+(\d+)/, (msg, match) => {
    if (!isAuthorized(msg) || !match) return;
    const num = parseInt(match[1]);
    const active = db.select().from(todos).where(eq(todos.completed, false)).all()
      .sort((a, b) => a.sortOrder - b.sortOrder);

    if (num < 1 || num > active.length) {
      bot!.sendMessage(msg.chat.id, `❌ Invalid number. Use /list to see todos (1-${active.length})`);
      return;
    }

    const todo = active[num - 1];
    db.update(todos).set({ completed: true, updatedAt: new Date().toISOString() }).where(eq(todos.id, todo.id)).run();
    bot!.sendMessage(msg.chat.id, `✅ Completed: ~${todo.title}~`, { parse_mode: "Markdown" });
  });

  // ── /del N — Delete todo by number ──
  bot.onText(/\/del\s+(\d+)/, (msg, match) => {
    if (!isAuthorized(msg) || !match) return;
    const num = parseInt(match[1]);
    const active = db.select().from(todos).where(eq(todos.completed, false)).all()
      .sort((a, b) => a.sortOrder - b.sortOrder);

    if (num < 1 || num > active.length) {
      bot!.sendMessage(msg.chat.id, `❌ Invalid number. Use /list to see todos (1-${active.length})`);
      return;
    }

    const todo = active[num - 1];
    db.delete(todos).where(eq(todos.id, todo.id)).run();
    bot!.sendMessage(msg.chat.id, `🗑 Deleted: ${todo.title}`);
  });

  // ── /done — Show completed todos ──
  bot.onText(/\/done$/, (msg) => {
    if (!isAuthorized(msg)) return;
    const completed = db.select().from(todos).where(eq(todos.completed, true)).all();

    if (completed.length === 0) { bot!.sendMessage(msg.chat.id, "No completed todos yet"); return; }

    let text = `✅ *Completed* (${completed.length})\n\n`;
    completed.slice(-10).forEach((t) => { text += `  ~${t.title}~\n`; });
    if (completed.length > 10) text += `  ...and ${completed.length - 10} more\n`;

    bot!.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
  });

  // ── /dday or /d ──
  bot.onText(/\/(dday|d)$/, (msg) => {
    if (!isAuthorized(msg)) return;
    const allDdays = db.select().from(ddays).all();

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
  bot.onText(/\/(blocks|b)$/, (msg) => {
    if (!isAuthorized(msg)) return;
    const today = new Date().toISOString().slice(0, 10);
    const blocks = db.select().from(timeBlocks).where(eq(timeBlocks.date, today)).all();

    if (blocks.length === 0) { bot!.sendMessage(msg.chat.id, "⏱ No time blocks today"); return; }

    let text = `⏱ *Today's Time Blocks*\n\n`;
    blocks.sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach((b) => {
      text += `${b.completed ? "✅" : "⬜"} ${b.startTime}-${b.endTime} ${b.title}\n`;
    });

    bot!.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
  });

  // ── /week — Week summary ──
  bot.onText(/\/week$/, (msg) => {
    if (!isAuthorized(msg)) return;
    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
    const startStr = weekStart.toISOString().slice(0, 10);
    const endStr = weekEnd.toISOString().slice(0, 10);

    const weekEvents = db.select().from(events)
      .where(and(gte(events.startTime, `${startStr}T00:00:00`), lte(events.endTime, `${endStr}T23:59:59`)))
      .all();

    const allTodos = db.select().from(todos).all();
    const weekBlocks = db.select().from(timeBlocks).all()
      .filter((b) => b.date >= startStr && b.date <= endStr);

    const totalBlockMins = weekBlocks.reduce((s, b) => {
      const [sh, sm] = b.startTime.split(":").map(Number);
      const [eh, em] = b.endTime.split(":").map(Number);
      return s + (eh * 60 + em) - (sh * 60 + sm);
    }, 0);

    let text = `📊 *Week Summary* (${startStr} ~ ${endStr})\n\n`;
    text += `📌 Events: ${weekEvents.length}\n`;
    text += `⏱ Time blocks: ${weekBlocks.length} (${fmtDuration(totalBlockMins)})\n`;
    text += `✅ Todos: ${allTodos.filter((t) => t.completed).length}/${allTodos.length} done\n`;
    text += `📅 Upcoming D-Days: ${db.select().from(ddays).all().filter((d) => {
      const diff = Math.ceil((new Date(d.targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 7;
    }).length}\n`;

    bot!.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
  });

  // ── /stats — Statistics ──
  bot.onText(/\/stats$/, (msg) => {
    if (!isAuthorized(msg)) return;
    const allTodos = db.select().from(todos).all();
    const allEvents = db.select().from(events).all();
    const allBlocks = db.select().from(timeBlocks).all();
    const allDdays = db.select().from(ddays).all();

    // Category breakdown
    const catCounts: Record<string, number> = {};
    allTodos.forEach((t) => {
      const root = (t.category || "personal").split(".")[0];
      catCounts[root] = (catCounts[root] || 0) + 1;
    });

    let text = `📊 *Statistics*\n\n`;
    text += `📋 Todos: ${allTodos.length} total (${allTodos.filter((t) => t.completed).length} done)\n`;
    text += `📌 Events: ${allEvents.length}\n`;
    text += `⏱ Time Blocks: ${allBlocks.length}\n`;
    text += `📅 D-Days: ${allDdays.length}\n`;
    text += `\n*Todo Categories:*\n`;
    Object.entries(catCounts).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
      text += `  ${cat}: ${count}\n`;
    });

    bot!.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
  });

  setupDailyBriefing();
}

function isAuthorized(msg: TelegramBot.Message): boolean {
  const expected = process.env.TELEGRAM_CHAT_ID;
  return !expected || msg.chat.id.toString() === expected;
}

function setupDailyBriefing() {
  const conf = db.select().from(telegramConfig).limit(1).all();
  const briefingTime = conf[0]?.dailyBriefingTime || "08:00";
  const [hour, minute] = briefingTime.split(":").map(Number);

  cron.schedule(`${minute} ${hour} * * *`, () => sendDailyBriefing());
  console.log(`Daily briefing scheduled at ${briefingTime}`);
}

function sendDailyBriefing() {
  if (!bot) return;
  const conf = db.select().from(telegramConfig).limit(1).all();
  if (!conf[0]?.chatId || !conf[0]?.active) return;

  const chatId = conf[0].chatId;
  const today = new Date().toISOString().slice(0, 10);

  const todayEvents = db.select().from(events)
    .where(and(gte(events.startTime, `${today}T00:00:00`), lte(events.endTime, `${today}T23:59:59`)))
    .all();
  const activeTodos = db.select().from(todos).where(eq(todos.completed, false)).all();
  const todayBlocks = db.select().from(timeBlocks).where(eq(timeBlocks.date, today)).all();

  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const upcoming = db.select().from(ddays).all().filter((d) => {
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
  bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
}

export function getTelegramBot() { return bot; }
