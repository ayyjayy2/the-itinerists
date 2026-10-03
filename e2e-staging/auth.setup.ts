import { test as setup, devices } from '@playwright/test';
import { signIn, STATE } from './helpers';

/**
 * Signs each test account in once and saves the session (Firebase keeps it in
 * IndexedDB), so the checks don't sign in a dozen times and trip Firebase's
 * rate limit. The files hold live tokens: e2e-staging/.auth/ is git-ignored.
 */
for (const user of ['alayna', 'maya'] as const) {
  setup(`sign in as ${user}`, async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ ...devices['iPhone 14'], baseURL });
    const page = await ctx.newPage();
    await signIn(page, user);
    await page.waitForTimeout(1_500);                  // let Firebase write the session to IndexedDB
    await ctx.storageState({ path: STATE[user], indexedDB: true });
    await ctx.close();
  });
}
