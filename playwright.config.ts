import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/ui',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:5189',
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    timezoneId: 'Asia/Seoul',
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    { name: 'tablet', use: { viewport: { width: 1024, height: 900 } } },
    { name: 'dark', use: { viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' } },
  ],
  webServer: {
    cwd: fileURLToPath(new URL('./packages/client', import.meta.url)),
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5189',
    url: 'http://127.0.0.1:5189',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
