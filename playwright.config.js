import { defineConfig } from '@playwright/test';

// Browser end-to-end checks against the Vite dev server (which exposes the
// window.__driftDuel debug hook). WebGL runs on SwiftShader, so it is slow but
// behaves the same locally and in CI.
const PORT = 5199;

export default defineConfig({
  testDir: 'e2e',
  timeout: 150_000,
  expect: { timeout: 15_000 },
  workers: 1, // software WebGL is CPU-bound; parallel pages only slow each other down
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    // The flows below read the Korean UI; e2e/i18n.spec.js covers English.
    locale: 'ko-KR',
    // Local runs use the installed Chrome; CI installs Playwright's Chromium.
    channel: process.env.CI ? undefined : 'chrome',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 720 } } },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
