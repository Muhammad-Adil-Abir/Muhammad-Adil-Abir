import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the production build (`npm run build` first).
 * Chrome: uses CHROME_PATH if set, otherwise Playwright's "chrome" channel (a locally installed Google Chrome).
 * WebGL runs through SwiftShader so tests also work on machines without a GPU.
 */
const launchOptions = {
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
};
const channel = process.env.CHROME_PATH ? undefined : 'chrome';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4175',
    channel,
    launchOptions,
    trace: 'off',
  },
  webServer: {
    command: 'npx vite preview --port 4175 --strictPort',
    url: 'http://localhost:4175',
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel, launchOptions } },
    { name: 'reduced-motion', use: { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' } },
  ],
});
