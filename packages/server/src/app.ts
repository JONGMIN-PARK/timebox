import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authMiddleware, adminMiddleware, type AuthRequest } from './middleware/auth.js';
import { sanitizeMiddleware } from './middleware/sanitize.js';
import { errorHandler } from './middleware/errorHandler.js';
import { activityTracker } from './middleware/activityTracker.js';
import { logger } from './lib/logger.js';
import type { Env } from './lib/env.js';
import authRoutes from './routes/auth.js';
import todoRoutes from './routes/todos.js';
import eventRoutes from './routes/events.js';
import ddayRoutes from './routes/ddays.js';
import categoryRoutes from './routes/categories.js';
import timeblockRoutes from './routes/timeblocks.js';
import telegramRoutes from './routes/telegram.js';
import backupRoutes from './routes/backup.js';
import fileRoutes from './routes/files.js';
import reminderRoutes from './routes/reminders.js';
import projectRoutes from './routes/projects.js';
import projectTaskRoutes from './routes/projectTasks.js';
import projectPostRoutes from './routes/projectPosts.js';
import projectFileRoutes from './routes/projectFiles.js';
import projectMessageRoutes from './routes/projectMessages.js';
import teamGroupRoutes from './routes/teamGroups.js';
import presenceRoutes from './routes/presence.js';
import inboxRoutes from './routes/inbox.js';
import chatRoutes from './routes/chat.js';
import noteRoutes from './routes/notes.js';
import analyticsRoutes from './routes/analytics.js';
import calendarFeedRoutes from './routes/calendarFeed.js';
import googleCalendarRoutes from './routes/googleCalendar.js';
import summaryRoutes from './routes/summary.js';
import exportRoutes from './routes/export.js';
import sketchRoutes from './routes/sketches.js';
import dayPlanRoutes from './routes/dayplan.js';
import aiRoutes from './routes/ai.js';
import importRoutes from './routes/import.js';
import briefingRoutes from './routes/briefing.js';

export function createApp(env: Env) {
  const app = express();
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  // Middleware
  app.use(compression());
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : undefined;
  app.use(cors(allowedOrigins ? { origin: allowedOrigins, credentials: true } : undefined));
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(sanitizeMiddleware);

  // Rate limiting
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later' },
  });
  app.use('/api/', apiLimiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, error: 'Too many login attempts, please try again later' },
  });
  app.use('/api/auth/login', authLimiter);

  // Per-user rate limiting for authenticated routes
  const perUserLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use userId from auth token if available, fall back to IP
      return (req as AuthRequest).userId?.toString() || ipKeyGenerator(req.ip || 'unknown');
    },
    message: { success: false, error: 'Per-user rate limit exceeded, please try again later' },
  });

  // Request logging
  if (env.NODE_ENV !== 'production') {
    app.use((req, _res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });
  }

  // Health check
  app.get('/api/health', async (_req, res) => {
    try {
      const { db } = await import('./db/index.js');
      const { categories } = await import('./db/schema.js');
      await db.select().from(categories).limit(1);
      res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
    } catch {
      res
        .status(503)
        .json({ status: 'error', db: 'disconnected', timestamp: new Date().toISOString() });
    }
  });

  // Activity tracking (must be before routes to hook into res.finish)
  app.use(activityTracker);

  // Public routes
  app.use('/api/auth', authRoutes);
  app.use('/api/calendar', calendarFeedRoutes);
  // Google OAuth popup callback (public — Google redirects here directly)
  app.get('/api/google-calendar/oauth-popup', (req, res) => {
    const code = (req.query.code as string) || '';
    const error = (req.query.error as string) || '';
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html><html><body><script>
    window.opener && window.opener.postMessage(
      { type: "google-oauth-callback", code: ${JSON.stringify(code)}, error: ${JSON.stringify(error)} },
      window.location.origin
    );
    window.close();
  </script><p>Redirecting...</p></body></html>`);
  });

  // Protected routes (auth + per-user rate limiting)
  const protectedMiddleware = [authMiddleware, perUserLimiter];
  app.use('/api/todos', ...protectedMiddleware, todoRoutes);
  app.use('/api/events', ...protectedMiddleware, eventRoutes);
  app.use('/api/ddays', ...protectedMiddleware, ddayRoutes);
  app.use('/api/categories', ...protectedMiddleware, categoryRoutes);
  app.use('/api/timeblocks', ...protectedMiddleware, timeblockRoutes);
  app.use('/api/telegram', ...protectedMiddleware, telegramRoutes);
  app.use('/api/backup', ...protectedMiddleware, backupRoutes);
  app.use('/api/files', ...protectedMiddleware, fileRoutes);
  app.use('/api/reminders', ...protectedMiddleware, reminderRoutes);
  app.use('/api/projects', ...protectedMiddleware, projectRoutes);
  app.use('/api/projects', ...protectedMiddleware, projectTaskRoutes);
  app.use('/api/projects', ...protectedMiddleware, projectPostRoutes);
  app.use('/api/projects', ...protectedMiddleware, projectFileRoutes);
  app.use('/api/projects', ...protectedMiddleware, projectMessageRoutes);
  app.use('/api/admin/groups', authMiddleware, perUserLimiter, adminMiddleware, teamGroupRoutes);
  app.use('/api/presence', ...protectedMiddleware, presenceRoutes);
  app.use('/api/inbox', ...protectedMiddleware, inboxRoutes);
  app.use('/api/chat', ...protectedMiddleware, chatRoutes);
  app.use('/api/notes', ...protectedMiddleware, noteRoutes);
  app.use('/api/analytics', authMiddleware, perUserLimiter, adminMiddleware, analyticsRoutes);
  app.use('/api/summary', ...protectedMiddleware, summaryRoutes);
  app.use('/api/google-calendar', ...protectedMiddleware, googleCalendarRoutes); // auth-protected endpoints
  app.use('/api/export', ...protectedMiddleware, exportRoutes);
  app.use('/api/sketches', ...protectedMiddleware, sketchRoutes);
  app.use('/api/dayplan', ...protectedMiddleware, dayPlanRoutes);
  app.use('/api/ai', ...protectedMiddleware, aiRoutes);
  app.use('/api/import', ...protectedMiddleware, importRoutes);
  app.use('/api/briefing', ...protectedMiddleware, briefingRoutes);

  // Global error handler (must be after all routes)
  app.use(errorHandler);

  // Serve static files in production
  if (env.NODE_ENV === 'production') {
    const clientDist = path.join(__dirname, '../../client/dist');
    // Hashed assets (js, css, images) can be cached long-term
    app.use(
      '/assets',
      express.static(path.join(clientDist, 'assets'), {
        maxAge: '30d',
        immutable: true,
      }),
    );
    // Everything else (index.html, manifest, icons) - no cache
    app.use(
      express.static(clientDist, {
        maxAge: 0,
        etag: true,
      }),
    );
    // SPA fallback: only for navigation requests (not .js/.css/.map files)
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || /\.\w+$/.test(req.path)) {
        return next();
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return app;
}
