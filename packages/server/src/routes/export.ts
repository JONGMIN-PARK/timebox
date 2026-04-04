import { Router } from "express";
import { db } from "../db/index.js";
import { todos, events, timeBlocks } from "../db/schema.js";
import { eq, and, gte, lte } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError } from "../lib/errors.js";

const router = Router();

// ── Helpers ──

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const headerRow = headers.map(escapeCsvValue).join(",");
  const dataRows = rows.map(row =>
    headers.map(h => escapeCsvValue(row[h])).join(",")
  );
  return [headerRow, ...dataRows].join("\n");
}

function sendExport(
  res: import("express").Response,
  data: Record<string, unknown>[],
  format: string,
  filename: string
) {
  if (format === "csv") {
    const csv = toCsv(data);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    res.send(csv);
  } else {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.json"`);
    res.json({ success: true, data });
  }
}

// ── GET /export/todos?format=json|csv ──

router.get("/todos", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const format = (req.query.format as string) || "json";
  if (format !== "json" && format !== "csv") {
    throw new ValidationError("format must be 'json' or 'csv'");
  }

  const rows = await db.select().from(todos).where(eq(todos.userId, userId));
  sendExport(res, rows, format, "todos");
}));

// ── GET /export/events?format=json|csv ──

router.get("/events", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const format = (req.query.format as string) || "json";
  if (format !== "json" && format !== "csv") {
    throw new ValidationError("format must be 'json' or 'csv'");
  }

  const rows = await db.select().from(events).where(eq(events.userId, userId));
  sendExport(res, rows, format, "events");
}));

// ── GET /export/timeblocks?format=json|csv&start=YYYY-MM-DD&end=YYYY-MM-DD ──

router.get("/timeblocks", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const format = (req.query.format as string) || "json";
  if (format !== "json" && format !== "csv") {
    throw new ValidationError("format must be 'json' or 'csv'");
  }

  const start = req.query.start as string | undefined;
  const end = req.query.end as string | undefined;

  const conditions = [eq(timeBlocks.userId, userId)];
  if (start) conditions.push(gte(timeBlocks.date, start));
  if (end) conditions.push(lte(timeBlocks.date, end));

  const rows = await db.select().from(timeBlocks).where(and(...conditions));
  sendExport(res, rows, format, "timeblocks");
}));

// ── GET /export/all ── JSON bundle of everything

router.get("/all", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;

  const [todoRows, eventRows, timeBlockRows] = await Promise.all([
    db.select().from(todos).where(eq(todos.userId, userId)),
    db.select().from(events).where(eq(events.userId, userId)),
    db.select().from(timeBlocks).where(eq(timeBlocks.userId, userId)),
  ]);

  const bundle = {
    exportedAt: new Date().toISOString(),
    todos: todoRows,
    events: eventRows,
    timeBlocks: timeBlockRows,
  };

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="timebox-export.json"');
  res.json({ success: true, data: bundle });
}));

export default router;
