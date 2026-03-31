import { Router } from "express";
import { google } from "googleapis";
import { db } from "../db/index.js";
import { googleCalendarConfig, events } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

const router = Router();

function getOAuth2Client(redirectUri?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ValidationError("Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri || "postmessage");
}

/** Build an authenticated OAuth2 client for a user from stored tokens. */
async function getAuthenticatedClient(userId: number) {
  const rows = await db.select().from(googleCalendarConfig).where(eq(googleCalendarConfig.userId, userId));
  const cfg = rows[0];
  if (!cfg) throw new ValidationError("Google Calendar is not connected");

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    access_token: cfg.accessToken,
    refresh_token: cfg.refreshToken,
    expiry_date: cfg.tokenExpiry ? Number(cfg.tokenExpiry) : undefined,
  });

  // Auto-refresh if expired
  oauth2.on("tokens", async (tokens) => {
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (tokens.access_token) updates.accessToken = tokens.access_token;
    if (tokens.expiry_date) updates.tokenExpiry = String(tokens.expiry_date);
    await db.update(googleCalendarConfig).set(updates).where(eq(googleCalendarConfig.userId, userId));
  });

  return oauth2;
}

// ── GET /config ──────────────────────────────────────────────
router.get("/config", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const rows = await db.select().from(googleCalendarConfig).where(eq(googleCalendarConfig.userId, userId));
  const cfg = rows[0];

  const clientId = process.env.GOOGLE_CLIENT_ID;
  res.json({
    success: true,
    data: {
      configured: Boolean(clientId),
      connected: Boolean(cfg),
      email: cfg?.email || null,
    },
  });
}));

// ── GET /auth-url ────────────────────────────────────────────
router.get("/auth-url", asyncHandler<AuthRequest>(async (req, res) => {
  const redirectUri = req.query.redirectUri as string | undefined;
  const oauth2 = getOAuth2Client(redirectUri);

  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
  });

  res.json({ success: true, data: { url } });
}));

// ── POST /callback ───────────────────────────────────────────
router.post("/callback", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { code, redirectUri } = req.body;
  if (!code) throw new ValidationError("Authorization code is required");

  const oauth2 = getOAuth2Client(redirectUri);
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    throw new ValidationError("Failed to get refresh token. Please revoke access at https://myaccount.google.com/permissions and try again.");
  }

  // Get user email
  oauth2.setCredentials(tokens);
  const oauth2Api = google.oauth2({ version: "v2", auth: oauth2 });
  const userInfo = await oauth2Api.userinfo.get();
  const email = userInfo.data.email || null;

  // Upsert config
  const existing = await db.select().from(googleCalendarConfig).where(eq(googleCalendarConfig.userId, userId));
  const now = new Date().toISOString();
  if (existing[0]) {
    await db.update(googleCalendarConfig).set({
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token,
      tokenExpiry: tokens.expiry_date ? String(tokens.expiry_date) : null,
      email,
      updatedAt: now,
    }).where(eq(googleCalendarConfig.userId, userId));
  } else {
    await db.insert(googleCalendarConfig).values({
      userId,
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token,
      tokenExpiry: tokens.expiry_date ? String(tokens.expiry_date) : null,
      email,
    });
  }

  logger.info("Google Calendar connected", { userId, email });
  res.json({ success: true, data: { email } });
}));

// ── POST /disconnect ─────────────────────────────────────────
router.post("/disconnect", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  try {
    const oauth2 = await getAuthenticatedClient(userId);
    await oauth2.revokeCredentials();
  } catch {
    // Ignore revoke errors — user may have already revoked
  }
  await db.delete(googleCalendarConfig).where(eq(googleCalendarConfig.userId, userId));
  logger.info("Google Calendar disconnected", { userId });
  res.json({ success: true });
}));

// ── GET /calendars ───────────────────────────────────────────
router.get("/calendars", asyncHandler<AuthRequest>(async (req, res) => {
  const oauth2 = await getAuthenticatedClient(req.userId!);
  const calendar = google.calendar({ version: "v3", auth: oauth2 });

  const list = await calendar.calendarList.list();
  const calendars = (list.data.items || []).map((c) => ({
    id: c.id,
    summary: c.summary,
    description: c.description || null,
    primary: c.primary || false,
    backgroundColor: c.backgroundColor || "#3b82f6",
  }));

  res.json({ success: true, data: calendars });
}));

// ── POST /import ─────────────────────────────────────────────
router.post("/import", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { calendarIds, from, to } = req.body as {
    calendarIds: string[];
    from?: string;
    to?: string;
  };

  if (!calendarIds?.length) throw new ValidationError("At least one calendar must be selected");

  const oauth2 = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: "v3", auth: oauth2 });

  const timeMin = from || new Date().toISOString();
  const toDate = to ? new Date(to) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const timeMax = toDate.toISOString();

  let importedCount = 0;
  let updatedCount = 0;

  for (const calendarId of calendarIds) {
    let pageToken: string | undefined;

    do {
      const response = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 250,
        pageToken,
      });

      const items = response.data.items || [];
      for (const item of items) {
        if (!item.id || !item.summary) continue;
        // Skip cancelled events
        if (item.status === "cancelled") continue;

        const allDay = Boolean(item.start?.date);
        const startTime = allDay
          ? `${item.start!.date}T00:00:00`
          : item.start?.dateTime?.replace(/\+.+$/, "").replace(/Z$/, "") || "";
        const endTime = allDay
          ? `${item.end!.date}T23:59:59`
          : item.end?.dateTime?.replace(/\+.+$/, "").replace(/Z$/, "") || "";

        if (!startTime || !endTime) continue;

        // Normalize to YYYY-MM-DDTHH:MM:SS
        const normStart = startTime.slice(0, 19);
        const normEnd = endTime.slice(0, 19);

        const googleEventId = `${calendarId}::${item.id}`;

        // Check existing by googleEventId
        const existing = await db.select({ id: events.id })
          .from(events)
          .where(and(eq(events.userId, userId), eq(events.googleEventId, googleEventId)));

        if (existing[0]) {
          // Update
          await db.update(events).set({
            title: item.summary,
            description: item.description || null,
            startTime: normStart,
            endTime: normEnd,
            allDay,
            color: item.colorId ? googleColorToHex(item.colorId) : "#3b82f6",
            updatedAt: new Date().toISOString(),
          }).where(eq(events.id, existing[0].id));
          updatedCount++;
        } else {
          // Insert
          await db.insert(events).values({
            userId,
            title: item.summary,
            description: item.description || null,
            startTime: normStart,
            endTime: normEnd,
            allDay,
            color: item.colorId ? googleColorToHex(item.colorId) : "#3b82f6",
            googleEventId,
          });
          importedCount++;
        }
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);
  }

  logger.info("Google Calendar import completed", { userId, importedCount, updatedCount });
  res.json({ success: true, data: { imported: importedCount, updated: updatedCount } });
}));

/** Map Google Calendar colorId to hex. */
function googleColorToHex(colorId: string): string {
  const colors: Record<string, string> = {
    "1": "#7986cb", "2": "#33b679", "3": "#8e24aa", "4": "#e67c73",
    "5": "#f6bf26", "6": "#f4511e", "7": "#039be5", "8": "#616161",
    "9": "#3f51b5", "10": "#0b8043", "11": "#d50000",
  };
  return colors[colorId] || "#3b82f6";
}

export default router;
