import TelegramBot from "node-telegram-bot-api";
import { db } from "../db/index.js";
import { todos, events, ddays, telegramConfig, timeBlocks } from "../db/schema.js";
import { eq, gte, lte, and } from "drizzle-orm";
import cron from "node-cron";

let bot: TelegramBot | null = null;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function parseDateInput(input: string): string {
  const today = new Date();
  if (input === "오늘" || input === "today") {
    return today.toISOString().slice(0, 10);
  }
  if (input === "내일" || input === "tomorrow") {
    today.setDate(today.getDate() + 1);
    return today.toISOString().slice(0, 10);
  }
  if (input === "모레") {
    today.setDate(today.getDate() + 2);
    return today.toISOString().slice(0, 10);
  }
  // Try parsing as date
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return today.toISOString().slice(0, 10);
}

function parseTimeRange(input: string): { start: string; end: string } | null {
  // Matches: 14:00, 14:00-15:00
  const match = input.match(/(\d{1,2}):(\d{2})(?:\s*-\s*(\d{1,2}):(\d{2}))?/);
  if (!match) return null;
  const startH = match[1].padStart(2, "0");
  const startM = match[2];
  const endH = match[3] ? match[3].padStart(2, "0") : String(parseInt(startH) + 1).padStart(2, "0");
  const endM = match[4] || startM;
  return { start: `${startH}:${startM}`, end: `${endH}:${endM}` };
}

export function initTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token) {
    console.log("TELEGRAM_BOT_TOKEN not set, skipping Telegram bot init");
    return;
  }

  bot = new TelegramBot(token, { polling: true });
  console.log("Telegram bot initialized (polling mode)");

  // Save config to DB
  const existing = db.select().from(telegramConfig).all();
  if (existing.length === 0) {
    db.insert(telegramConfig).values({
      chatId: chatId || null,
      active: true,
    }).run();
  }

  // ── Command: /start ──
  bot.onText(/\/start/, (msg) => {
    const id = msg.chat.id.toString();
    // Update chat_id
    const conf = db.select().from(telegramConfig).limit(1).all();
    if (conf.length > 0) {
      db.update(telegramConfig).set({ chatId: id, active: true, updatedAt: new Date().toISOString() }).where(eq(telegramConfig.id, conf[0].id)).run();
    }
    bot!.sendMessage(msg.chat.id,
      `✅ TimeBox 봇 연결 완료!\n\n📋 사용 가능한 명령어:\n/today - 오늘의 일정/투두 요약\n/add [날짜] [시간] [제목] - 일정 추가\n/todo [제목] - 투두 추가\n/dday - D-Day 목록\n/blocks - 오늘의 타임블록\n/help - 도움말`
    );
  });

  // ── Command: /today ──
  bot.onText(/\/today/, (msg) => {
    if (!isAuthorized(msg)) return;
    const today = new Date().toISOString().slice(0, 10);

    const todayEvents = db.select().from(events)
      .where(and(gte(events.startTime, `${today}T00:00:00`), lte(events.endTime, `${today}T23:59:59`)))
      .all();

    const todayTodos = db.select().from(todos).all();
    const activeTodos = todayTodos.filter((t) => !t.completed);
    const completedTodos = todayTodos.filter((t) => t.completed);

    const todayBlocks = db.select().from(timeBlocks).where(eq(timeBlocks.date, today)).all();

    let msg_text = `📅 *오늘의 브리핑* (${today})\n\n`;

    // Events
    if (todayEvents.length > 0) {
      msg_text += `📌 *일정* (${todayEvents.length}건)\n`;
      todayEvents.forEach((e) => {
        msg_text += `  • ${e.startTime.slice(11, 16)} ${e.title}\n`;
      });
      msg_text += "\n";
    }

    // Time blocks
    if (todayBlocks.length > 0) {
      msg_text += `⏱ *타임블록* (${todayBlocks.length}건)\n`;
      todayBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach((b) => {
        const status = b.completed ? "✅" : "⬜";
        msg_text += `  ${status} ${b.startTime}-${b.endTime} ${b.title}\n`;
      });
      msg_text += "\n";
    }

    // Todos
    msg_text += `✅ *투두* (${completedTodos.length}/${todayTodos.length} 완료)\n`;
    activeTodos.slice(0, 10).forEach((t) => {
      const p = t.priority === "high" ? "🔴" : t.priority === "medium" ? "🟡" : "⚪";
      msg_text += `  ${p} ${t.title}\n`;
    });

    bot!.sendMessage(msg.chat.id, msg_text, { parse_mode: "Markdown" });
  });

  // ── Command: /add [date] [time] [title] ──
  bot.onText(/\/add\s+(.+)/, (msg, match) => {
    if (!isAuthorized(msg) || !match) return;
    const parts = match[1].trim().split(/\s+/);

    // Parse: /add 내일 14:00 팀 미팅
    // or: /add 14:00 팀 미팅
    let dateStr = new Date().toISOString().slice(0, 10);
    let timeRange: { start: string; end: string } | null = null;
    let titleParts: string[] = [];

    for (let i = 0; i < parts.length; i++) {
      const tr = parseTimeRange(parts[i]);
      if (tr) {
        timeRange = tr;
        titleParts = parts.slice(i + 1);
        break;
      } else if (i === 0) {
        dateStr = parseDateInput(parts[i]);
      } else {
        titleParts = parts.slice(i);
        break;
      }
    }

    if (!titleParts.length) {
      bot!.sendMessage(msg.chat.id, "❌ 사용법: /add [날짜] [시간] 제목\n예: /add 내일 14:00 팀 미팅");
      return;
    }

    const title = titleParts.join(" ");
    const start = timeRange?.start || "09:00";
    const end = timeRange?.end || "10:00";

    db.insert(events).values({
      userId: 1,
      title,
      startTime: `${dateStr}T${start}:00`,
      endTime: `${dateStr}T${end}:00`,
      allDay: false,
      color: "#3b82f6",
    }).run();

    bot!.sendMessage(msg.chat.id, `✅ 일정 추가됨\n📅 ${dateStr} ${start}-${end}\n📝 ${title}`);
  });

  // ── Command: /todo [title] [!priority] ──
  bot.onText(/\/todo\s+(.+)/, (msg, match) => {
    if (!isAuthorized(msg) || !match) return;
    let text = match[1].trim();
    let priority = "medium";

    if (text.includes("!high") || text.includes("!높음")) {
      priority = "high";
      text = text.replace(/!high|!높음/g, "").trim();
    } else if (text.includes("!low") || text.includes("!낮음")) {
      priority = "low";
      text = text.replace(/!low|!낮음/g, "").trim();
    }

    const maxOrder = db.select().from(todos).all().reduce((max, t) => Math.max(max, t.sortOrder), -1);

    db.insert(todos).values({
      userId: 1,
      title: text,
      priority,
      sortOrder: maxOrder + 1,
    }).run();

    const emoji = priority === "high" ? "🔴" : priority === "low" ? "⚪" : "🟡";
    bot!.sendMessage(msg.chat.id, `✅ 투두 추가됨\n${emoji} ${text}`);
  });

  // ── Command: /dday ──
  bot.onText(/\/dday$/, (msg) => {
    if (!isAuthorized(msg)) return;
    const allDdays = db.select().from(ddays).all();

    if (allDdays.length === 0) {
      bot!.sendMessage(msg.chat.id, "📅 D-Day 목록이 비어있습니다");
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let text = "📅 *D-Day 목록*\n\n";
    allDdays.forEach((d) => {
      const target = new Date(d.targetDate);
      target.setHours(0, 0, 0, 0);
      const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const label = diff === 0 ? "D-Day!" : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
      text += `  ${label} ${d.title}\n`;
    });

    bot!.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
  });

  // ── Command: /blocks ──
  bot.onText(/\/blocks/, (msg) => {
    if (!isAuthorized(msg)) return;
    const today = new Date().toISOString().slice(0, 10);
    const blocks = db.select().from(timeBlocks).where(eq(timeBlocks.date, today)).all();

    if (blocks.length === 0) {
      bot!.sendMessage(msg.chat.id, "⏱ 오늘의 타임블록이 없습니다");
      return;
    }

    let text = `⏱ *오늘의 타임블록* (${today})\n\n`;
    blocks.sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach((b) => {
      const status = b.completed ? "✅" : "⬜";
      text += `${status} ${b.startTime}-${b.endTime} ${b.title}\n`;
    });

    bot!.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
  });

  // ── Command: /help ──
  bot.onText(/\/help/, (msg) => {
    bot!.sendMessage(msg.chat.id,
      `📋 *TimeBox 봇 명령어*\n\n` +
      `/today - 오늘의 일정/투두/타임블록 요약\n` +
      `/add [날짜] [시간] 제목 - 일정 추가\n` +
      `  예: /add 내일 14:00 팀 미팅\n` +
      `  예: /add 14:00-15:30 코드 리뷰\n` +
      `/todo 제목 [!high|!low] - 투두 추가\n` +
      `  예: /todo 보고서 작성 !high\n` +
      `/dday - D-Day 목록\n` +
      `/blocks - 오늘의 타임블록\n` +
      `/help - 이 도움말`,
      { parse_mode: "Markdown" },
    );
  });

  // ── Daily briefing cron ──
  setupDailyBriefing();
}

function isAuthorized(msg: TelegramBot.Message): boolean {
  const expectedChatId = process.env.TELEGRAM_CHAT_ID;
  if (!expectedChatId) return true; // If not set, allow all
  return msg.chat.id.toString() === expectedChatId;
}

function setupDailyBriefing() {
  // Default: 08:00 daily
  const conf = db.select().from(telegramConfig).limit(1).all();
  const briefingTime = conf[0]?.dailyBriefingTime || "08:00";
  const [hour, minute] = briefingTime.split(":").map(Number);

  cron.schedule(`${minute} ${hour} * * *`, () => {
    sendDailyBriefing();
  });

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

  const allTodos = db.select().from(todos).all();
  const activeTodos = allTodos.filter((t) => !t.completed);

  const todayBlocks = db.select().from(timeBlocks).where(eq(timeBlocks.date, today)).all();

  const allDdays = db.select().from(ddays).all();
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  let text = `🌅 *좋은 아침! 오늘의 브리핑*\n📅 ${today}\n\n`;

  if (todayEvents.length > 0) {
    text += `📌 일정 ${todayEvents.length}건\n`;
    todayEvents.sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach((e) => {
      text += `  • ${e.startTime.slice(11, 16)} ${e.title}\n`;
    });
    text += "\n";
  }

  if (todayBlocks.length > 0) {
    text += `⏱ 타임블록 ${todayBlocks.length}건\n`;
    todayBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach((b) => {
      text += `  • ${b.startTime}-${b.endTime} ${b.title}\n`;
    });
    text += "\n";
  }

  if (activeTodos.length > 0) {
    text += `✅ 할 일 ${activeTodos.length}건\n`;
    activeTodos.slice(0, 5).forEach((t) => {
      const p = t.priority === "high" ? "🔴" : t.priority === "medium" ? "🟡" : "⚪";
      text += `  ${p} ${t.title}\n`;
    });
    if (activeTodos.length > 5) text += `  ...외 ${activeTodos.length - 5}건\n`;
    text += "\n";
  }

  // Upcoming D-Days
  const upcoming = allDdays.filter((d) => {
    const target = new Date(d.targetDate);
    target.setHours(0, 0, 0, 0);
    const diff = Math.ceil((target.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 7;
  });

  if (upcoming.length > 0) {
    text += `🎯 다가오는 D-Day\n`;
    upcoming.forEach((d) => {
      const target = new Date(d.targetDate);
      target.setHours(0, 0, 0, 0);
      const diff = Math.ceil((target.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
      text += `  ${diff === 0 ? "🔥 D-Day!" : `D-${diff}`} ${d.title}\n`;
    });
  }

  bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
}

export function getTelegramBot() {
  return bot;
}
