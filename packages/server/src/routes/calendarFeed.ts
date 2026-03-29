import { Router } from "express";
import { db } from "../db/index.js";
import { users, events } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function toIcsDate(iso: string, allDay: boolean): string {
  const d = new Date(iso);
  if (allDay) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Public read-only feed; no auth. */
router.get(
  "/feed.ics",
  asyncHandler(async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
    if (token.length < 16) {
      res.status(400).send("Missing or invalid token");
      return;
    }

    const userRows = await db.select({ id: users.id }).from(users).where(eq(users.calendarFeedToken, token));
    const user = userRows[0];
    if (!user) {
      res.status(404).send("Unknown feed");
      return;
    }

    const now = new Date();
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 7);
    const end = new Date(now);
    end.setUTCDate(end.getUTCDate() + 365);

    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const list = await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.userId, user.id),
          sql`${events.startTime} < ${endIso}`,
          sql`${events.endTime} > ${startIso}`,
        ),
      );

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//TimeBox//Calendar Feed//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:TimeBox",
    ];

    for (const ev of list) {
      const uid = `timebox-event-${ev.id}@timebox`;
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${toIcsDate(new Date().toISOString(), false)}`);
      if (ev.allDay) {
        lines.push(`DTSTART;VALUE=DATE:${toIcsDate(ev.startTime, true)}`);
        const endD = new Date(ev.endTime);
        endD.setUTCDate(endD.getUTCDate() + 1);
        lines.push(`DTEND;VALUE=DATE:${toIcsDate(endD.toISOString(), true)}`);
      } else {
        lines.push(`DTSTART:${toIcsDate(ev.startTime, false)}`);
        lines.push(`DTEND:${toIcsDate(ev.endTime, false)}`);
      }
      lines.push(`SUMMARY:${icsEscape(ev.title)}`);
      if (ev.description) {
        lines.push(`DESCRIPTION:${icsEscape(ev.description)}`);
      }
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(lines.join("\r\n"));
  }),
);

export default router;
