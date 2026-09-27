import dotenv from 'dotenv';
import { createServer } from 'node:http';
import { validateEnv } from './lib/env.js';
import { initDb, closeDb } from './db/index.js';
import { createApp } from './app.js';
import { initSocket, getIO } from './socket/index.js';
import { startJobs } from './jobs.js';
import { stopTelegramBot } from './telegram/bot.js';
import { startTelegram } from './services/startup.js';
import { logger } from './lib/logger.js';

dotenv.config();
const env = validateEnv();
await initDb();
try {
  const { ensureGlobalRoom } = await import('./lib/globalRoom.js');
  await ensureGlobalRoom();
} catch (error) {
  logger.error('Failed to ensure global chat room', { error: (error as Error).message });
}
const server = createServer(createApp(env));
initSocket(server);
let stopJobs: (() => void) | undefined;
server.listen(env.PORT, () => {
  logger.info(`TimeBox server running on http://localhost:${env.PORT}`);
  if (!env.GEMINI_API_KEY) logger.warn('GEMINI_API_KEY not set — AI features are disabled');
  startTelegram(env);
  stopJobs = startJobs();
});

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  stopJobs?.();
  const timeout = setTimeout(() => process.exit(1), 10_000).unref();
  await stopTelegramBot();
  getIO()?.disconnectSockets(true);
  getIO()?.close();
  server.closeIdleConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeDb();
  clearTimeout(timeout);
  process.exit(0);
}
process.on('SIGTERM', () => {
  void shutdown();
});
process.on('SIGINT', () => {
  void shutdown();
});
