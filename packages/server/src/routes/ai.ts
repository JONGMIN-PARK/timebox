import { Router } from "express";
import { type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError, AppError } from "../lib/errors.js";
import { getGeminiModel, extractJson } from "../lib/gemini.js";

const router = Router();

interface ParsedItem {
  kind: "event" | "todo";
  title: string;
  date: string | null;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  priority: "high" | "medium" | "low";
  description: string | null;
}

// POST /api/ai/parse — turn a natural-language phrase into a structured event/todo
router.post("/parse", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
  if (!text) throw new ValidationError("text is required");
  const today = typeof req.body.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.body.today)
    ? req.body.today
    : new Date().toISOString().slice(0, 10);
  const nowTime = typeof req.body.now === "string" && /^\d{2}:\d{2}$/.test(req.body.now) ? req.body.now : "09:00";

  const model = await getGeminiModel(userId);
  const prompt =
    `너는 일정/할일 파서야. 오늘은 ${today}(현지시간 기준), 현재 시각은 ${nowTime} 이야.\n` +
    `사용자의 한 줄 입력을 아래 JSON 스키마로 변환해. 설명 없이 JSON만 출력해.\n\n` +
    `스키마:\n` +
    `{\n` +
    `  "kind": "event" | "todo",   // 특정 시간/약속이면 event, 해야 할 일이면 todo\n` +
    `  "title": string,             // 핵심만, 날짜/시간 표현은 제외\n` +
    `  "date": "YYYY-MM-DD" | null, // 상대 표현(오늘/내일/모레/다음주 월요일 등)을 오늘 기준으로 계산\n` +
    `  "allDay": boolean,           // 시간이 없으면 true\n` +
    `  "startTime": "HH:MM" | null, // event이고 시간이 있으면 채움\n` +
    `  "endTime": "HH:MM" | null,   // 없으면 시작+1시간\n` +
    `  "priority": "high" | "medium" | "low",\n` +
    `  "description": string | null\n` +
    `}\n\n` +
    `규칙: 날짜가 전혀 없으면 date는 오늘. "오전/오후", "3시", "15:00" 등 시간 표현을 24시간제로 변환. ` +
    `todo는 보통 allDay=true(마감일만). 애매하면 todo로.\n\n` +
    `입력: "${text}"`;

  let parsed: ParsedItem;
  try {
    const result = await model.generateContent(prompt);
    parsed = extractJson<ParsedItem>(result.response.text());
  } catch {
    throw new AppError("Failed to parse input", 502);
  }

  // Normalize / guard the model output.
  const kind = parsed.kind === "event" ? "event" : "todo";
  const title = (parsed.title || text).toString().slice(0, 200).trim();
  const date = typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : today;
  const hhmm = (v: unknown) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : null);
  let startTime = hhmm(parsed.startTime);
  let endTime = hhmm(parsed.endTime);
  const allDay = parsed.allDay === true || (kind === "event" && !startTime);
  if (kind === "event" && startTime && !endTime) {
    const [h, m] = startTime.split(":").map(Number);
    endTime = `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  if (kind === "todo") { startTime = null; endTime = null; }
  const priority = ["high", "medium", "low"].includes(parsed.priority) ? parsed.priority : "medium";

  res.json({
    success: true,
    data: {
      kind,
      title,
      date,
      allDay,
      startTime,
      endTime,
      priority,
      description: typeof parsed.description === "string" ? parsed.description.slice(0, 500) : null,
    },
  });
}));

export default router;
