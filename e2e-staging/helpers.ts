import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Browser, BrowserContext, Page, expect, devices } from '@playwright/test';

/** Saved sessions from auth.setup.ts (git-ignored: they hold live tokens). */
export const STATE = { alayna: 'e2e-staging/.auth/alayna.json', maya: 'e2e-staging/.auth/maya.json' } as const;

/** Everything a check creates carries this tag, so cleanup can find it. */
export const TAG = '[check]';
export const stamp = () => `${TAG} ${new Date().toISOString().slice(11, 19)}`;

const ACCOUNTS = join(__dirname, '..', 'scripts', 'staging-accounts.local.json');
/** A staging test account's password: from the git-ignored file, or STAGING_PASSWORD_<NAME>. */
export function password(user: 'alayna' | 'maya' | 'sam'): string {
  const env = process.env[`STAGING_PASSWORD_${user.toUpperCase()}`];
  if (env) return env;
  if (!existsSync(ACCOUNTS)) throw new Error(`No password for ${user}: add scripts/staging-accounts.local.json (node scripts/seed-staging.js writes it) or set STAGING_PASSWORD_${user.toUpperCase()}.`);
  return JSON.parse(readFileSync(ACCOUNTS, 'utf8'))[user].password;
}

/** The staging web API key, read from the committed staging environment. */
export function apiKey(): string {
  const env = readFileSync(join(__dirname, '..', 'src', 'environments', 'environment.staging.ts'), 'utf8');
  return env.match(/apiKey:\s*'([^']+)'/)![1];
}

export async function signIn(page: Page, user: 'alayna' | 'maya' | 'sam', as: 'username' | 'email' = 'username') {   // 'email' = a recovery email
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(as === 'email' ? `${user}@the-itinerists.local` : user);
  await page.getByPlaceholder('Enter your password').fill(password(user));
  await page.locator('form button[type=submit]').click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

/**
 * Opens a page the way the app's own links do: a route change, no reload, so the open
 * trip's live listeners stay put and nothing is read from Firestore again (#586).
 * Staging is on the free plan (50,000 reads a day) and a reload re-reads the whole
 * trip. A tab that hasn't loaded the app yet loads it once, at `path`.
 * Use page.goto() only where the reload itself is what's being checked.
 */
export async function go(page: Page, path: string) {
  if (!page.url().startsWith('http')) { await page.goto(path); return; }
  const from = new URL(page.url()).pathname;
  if (from === path) return;
  await page.evaluate(p => {
    history.pushState(null, '', p);
    dispatchEvent(new PopStateEvent('popstate', { state: null }));   // the router follows, as it does for Back
  }, path);
  await page.waitForURL(u => u.pathname !== from, { timeout: 15_000 });
}

export async function signOut(page: Page) {
  await go(page, '/profile');
  await page.getByRole('button', { name: 'Log Out' }).click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** A second person on their own phone: a separate browser context, already signed in. */
export async function secondPerson(browser: Browser, user: 'alayna' | 'maya', baseURL: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ ...devices['iPhone 14'], baseURL, storageState: STATE[user] });
  const page = await ctx.newPage();
  await page.goto('/home');                                   // the one load; move on with go()
  await expect(page).not.toHaveURL(/\/login/);
  return { ctx, page };
}

/** Collects page errors and console errors, minus noise that isn't ours. */
export function watchErrors(page: Page, known: RegExp[] = []): string[] {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/favicon|Failed to load resource: the server responded with a status of 404/.test(t)) return;
    if (known.some(k => k.test(t))) return;
    errors.push(t);
  });
  return errors;
}

export async function addItineraryEvent(page: Page, title: string) {
  await go(page, '/itinerary');
  await page.getByRole('button', { name: '+ Add event' }).first().click();
  await page.getByPlaceholder("What's happening?").fill(title);
  await page.getByRole('button', { name: 'Add Event', exact: true }).click();
  await expect(page.getByText(title).first()).toBeVisible();
}

/** The itinerary card holding `title`, for its edit button. */
export const itineraryCard = (page: Page, title: string) =>
  page.locator('.itinerary-item').filter({ hasText: title }).last();
