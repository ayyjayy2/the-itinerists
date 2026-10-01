import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the DEMO build: Firebase is replaced by
 * in-memory stand-ins (src/demo), the app starts signed in as a seeded
 * traveller, and nothing touches the network or real data. Locally this
 * reuses a running demo server on :4400 (`npm run start:demo`); in CI it
 * builds the demo and serves it with e2e/serve.mjs.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4400',
    ...devices['iPhone 14'],
    browserName: 'chromium',   // phone viewport, but Chromium: the one browser CI installs
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build:demo && node e2e/serve.mjs dist/the-itinerists-demo/browser 4400',
    url: 'http://localhost:4400/',
    reuseExistingServer: !process.env['CI'],
    timeout: 240_000,
  },
});
