import { Router } from "express";
import { db } from "../db/index.js";
import { events } from "../db/schema.js";
import { type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError } from "../lib/errors.js";

const router = Router();

// ── ICS Parser helpers ──

interface ParsedEvent {
  summary: string;
  description: string | null;
  dtstart: string | null;
  dtend: string | null;
}

/**
 * Parse an ICS date/datetime string into an ISO 8601 string.
 * Handles formats: 20260404T103000Z, 20260404T103000, 20260404
 */
function parseIcsDate(raw: string): string | null {
  if (!raw) return null;
  // Remove TZID prefix if present (e.g., TZID=America/New_York:20260404T103000)
  const val = raw.includes(":") ? raw.split(":").pop()! : raw;
  const clean = val.trim();

  // YYYYMMDD
  if (/^\d{8}$/.test(clean)) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T00:00:00.000Z`;
  }
  // YYYYMMDDTHHmmss or YYYYMMDDTHHmmssZ
  const m = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (m) {
    const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z`;
    return iso;
  }
  return null;
}

function extractField(block: string, field: string): string | null {
  // Handle folded lines (lines starting with space/tab are continuations)
  const unfolded = block.replace(/\r?\n[ \t]/g, "");
  const regex = new RegExp(`^${field}[;:](.*)$`, "im");
  const match = unfolded.match(regex);
  return match ? match[1].trim() : null;
}

function parseIcsText(icsText: string): ParsedEvent[] {
  const results: ParsedEvent[] = [];
  // Split on BEGIN:VEVENT
  const parts = icsText.split(/BEGIN:VEVENT/i);

  for (let i = 1; i < parts.length; i++) {
    const endIdx = parts[i].search(/END:VEVENT/i);
    const block = endIdx >= 0 ? parts[i].substring(0, endIdx) : parts[i];

    const summary = extractField(block, "SUMMARY") || "Untitled Event";
    const description = extractField(block, "DESCRIPTION");
    const dtstart = extractField(block, "DTSTART");
    const dtend = extractField(block, "DTEND");

    results.push({ summary, description, dtstart, dtend });
  }

  return results;
}

// ── POST /import/events/import-ics ──

router.post("/events/import-ics", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { url, icsData } = req.body as { url?: string; icsData?: string };

  if (!url && !icsData) {
    throw new ValidationError("Either 'url' or 'icsData' must be provided");
  }

  let icsText: string;

  if (icsData) {
    icsText = icsData;
  } else {
    // Fetch from URL
    const response = await fetch(url!);
    if (!response.ok) {
      throw new ValidationError(`Failed to fetch ICS from URL: ${response.status} ${response.statusText}`);
    }
    icsText = await response.text();
  }

  const parsed = parseIcsText(icsText);
  const errors: string[] = [];
  let imported = 0;

  for (const evt of parsed) {
    try {
      const startTime = parseIcsDate(evt.dtstart || "");
      const dtEnd = parseIcsDate(evt.dtend || "");

      if (!startTime) {
        errors.push(`Skipped "${evt.summary}": missing or unparseable DTSTART`);
        continue;
      }

      // If no end time, default to start + 1 hour
      const endTime = dtEnd || new Date(new Date(startTime).getTime() + 3600000).toISOString();

      // Detect all-day events (date-only DTSTART without time component)
      const rawStart = evt.dtstart || "";
      const cleanStart = rawStart.includes(":") ? rawStart.split(":").pop()! : rawStart;
      const allDay = /^\d{8}$/.test(cleanStart.trim());

      await db.insert(events).values({
        userId,
        title: evt.summary.trim(),
        description: evt.description || null,
        startTime,
        endTime,
        allDay,
        color: "#3b82f6",
      });

      imported++;
    } catch (e) {
      errors.push(`Failed to import "${evt.summary}": ${String(e)}`);
    }
  }

  res.json({ success: true, data: { imported, errors } });
}));

export default router;
