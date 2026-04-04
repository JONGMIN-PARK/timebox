import { Router } from "express";
import { db } from "../db/index.js";
import { sql } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ── Auto-create sketches table if it doesn't exist ──

let tableReady = false;
async function ensureSketchesTable() {
  if (tableReady) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sketches (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        strokes TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT now(),
        updated_at TEXT NOT NULL DEFAULT now(),
        UNIQUE(user_id, date)
      )
    `);
    tableReady = true;
  } catch (e) {
    logger.error("Failed to create sketches table", { error: String(e) });
    throw e;
  }
}

// ── GET /sketches/:date ──

router.get("/:date", asyncHandler<AuthRequest>(async (req, res) => {
  await ensureSketchesTable();
  const userId = req.userId!;
  const date = req.params.date as string;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError("date must be in YYYY-MM-DD format");
  }

  const rows = await db.execute(
    sql`SELECT strokes, created_at, updated_at FROM sketches WHERE user_id = ${userId} AND date = ${date} LIMIT 1`
  );

  const resultRows = rows.rows ?? rows;
  const row = Array.isArray(resultRows) ? resultRows[0] : undefined;

  if (!row) {
    res.json({ success: true, data: { date, strokes: [] } });
    return;
  }

  let strokes: unknown[];
  try {
    strokes = JSON.parse(row.strokes as string);
  } catch {
    strokes = [];
  }

  res.json({
    success: true,
    data: {
      date,
      strokes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  });
}));

// ── PUT /sketches/:date ──

router.put("/:date", asyncHandler<AuthRequest>(async (req, res) => {
  await ensureSketchesTable();
  const userId = req.userId!;
  const date = req.params.date as string;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError("date must be in YYYY-MM-DD format");
  }

  const { strokes } = req.body;
  if (!Array.isArray(strokes)) {
    throw new ValidationError("strokes must be an array");
  }

  const strokesJson = JSON.stringify(strokes);
  const now = new Date().toISOString();

  // Upsert: insert or update on conflict
  await db.execute(
    sql`INSERT INTO sketches (user_id, date, strokes, created_at, updated_at)
        VALUES (${userId}, ${date}, ${strokesJson}, ${now}, ${now})
        ON CONFLICT (user_id, date)
        DO UPDATE SET strokes = ${strokesJson}, updated_at = ${now}`
  );

  res.json({ success: true, data: { date, strokes, updatedAt: now } });
}));

export default router;
