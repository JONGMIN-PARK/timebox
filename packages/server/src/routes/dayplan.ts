import { Router } from "express";
import { db } from "../db/index.js";
import { sql } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ── Auto-create day_plans table if it doesn't exist ──
// Stores per-day scheduler artifacts that previously lived only in the browser:
// the brain dump list, the "Top 3" priorities, and the free-form day memo.

let tableReady = false;
async function ensureDayPlansTable() {
  if (tableReady) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS day_plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        brain TEXT NOT NULL DEFAULT '[]',
        top3 TEXT NOT NULL DEFAULT '["","",""]',
        memo TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now(),
        UNIQUE(user_id, date)
      )
    `);
    tableReady = true;
  } catch (e) {
    logger.error("Failed to create day_plans table", { error: String(e) });
    throw e;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ── GET /dayplan/:date — returns { exists, brain, top3, memo } ──
router.get("/:date", asyncHandler<AuthRequest>(async (req, res) => {
  await ensureDayPlansTable();
  const userId = req.userId!;
  const date = req.params.date as string;
  if (!DATE_RE.test(date)) throw new ValidationError("date must be in YYYY-MM-DD format");

  const rows = await db.execute(
    sql`SELECT brain, top3, memo, created_at, updated_at FROM day_plans WHERE user_id = ${userId} AND date = ${date} LIMIT 1`,
  );
  const resultRows = rows.rows ?? rows;
  const row = Array.isArray(resultRows) ? resultRows[0] : undefined;

  if (!row) {
    res.json({ success: true, data: { date, exists: false, brain: [], top3: ["", "", ""], memo: "" } });
    return;
  }

  res.json({
    success: true,
    data: {
      date,
      exists: true,
      brain: parseJson<unknown[]>(row.brain, []),
      top3: parseJson<string[]>(row.top3, ["", "", ""]),
      memo: typeof row.memo === "string" ? row.memo : "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  });
}));

// ── PUT /dayplan/:date — partial upsert (only provided fields are updated) ──
router.put("/:date", asyncHandler<AuthRequest>(async (req, res) => {
  await ensureDayPlansTable();
  const userId = req.userId!;
  const date = req.params.date as string;
  if (!DATE_RE.test(date)) throw new ValidationError("date must be in YYYY-MM-DD format");

  const { brain, top3, memo } = req.body ?? {};
  if (brain !== undefined && !Array.isArray(brain)) throw new ValidationError("brain must be an array");
  if (top3 !== undefined && !Array.isArray(top3)) throw new ValidationError("top3 must be an array");
  if (memo !== undefined && typeof memo !== "string") throw new ValidationError("memo must be a string");
  if (brain === undefined && top3 === undefined && memo === undefined) {
    throw new ValidationError("Nothing to update");
  }

  const now = new Date().toISOString();
  const brainJson = brain !== undefined ? JSON.stringify(brain) : null;
  const top3Json = top3 !== undefined ? JSON.stringify([top3[0] ?? "", top3[1] ?? "", top3[2] ?? ""]) : null;
  const memoVal = memo !== undefined ? memo : null;

  // Insert a fresh row with any missing fields defaulted; on conflict update only
  // the fields that were provided (COALESCE keeps existing values otherwise).
  await db.execute(
    sql`INSERT INTO day_plans (user_id, date, brain, top3, memo, created_at, updated_at)
        VALUES (
          ${userId}, ${date},
          ${brainJson ?? "[]"},
          ${top3Json ?? '["","",""]'},
          ${memoVal ?? ""},
          ${now}, ${now}
        )
        ON CONFLICT (user_id, date) DO UPDATE SET
          brain = COALESCE(${brainJson}, day_plans.brain),
          top3 = COALESCE(${top3Json}, day_plans.top3),
          memo = COALESCE(${memoVal}, day_plans.memo),
          updated_at = ${now}`,
  );

  res.json({ success: true, data: { date, updatedAt: now } });
}));

export default router;
