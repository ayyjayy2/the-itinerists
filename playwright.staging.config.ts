import { defineConfig, devices } from '@playwright/test';

/**
 * After-deploy checks against the REAL staging site (the-itinerists-staging):
 * real Firebase, two seeded test accounts, live data. Run by hand after a merge
 * deploys staging:  npm run test:staging
 * Another address (e.g. a preview channel):  STAGING_URL=https://… npm run test:staging
 * Passwords come from scripts/staging-accounts.local.json (git-ignored).
 * One worker: the tests share the seeded trip, and each cleans up what it adds.
 */
export default defineConfig({
  testDir: 'e2e-staging',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  globalTeardown: './e2e-staging/cleanup.ts',
  use: {
    baseURL: process.env['STAGING_URL'] || 'https://the-itinerists-staging.web.app',
    ...devices['iPhone 14'],
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'sign-in', testMatch: /auth\.setup\.ts/ },
    { name: 'checks', testMatch: /staging\.spec\.ts/, dependencies: ['sign-in'], use: { storageState: 'e2e-staging/.auth/alayna.json' } },
  ],
});
