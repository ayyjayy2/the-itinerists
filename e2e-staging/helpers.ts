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
export function password(user: 'alayna' | 'maya'): string {
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

export async function signIn(page: Page, user: 'alayna' | 'maya', as: 'username' | 'email' = 'username') {   // 'email' = a recovery email
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(as === 'email' ? `${user}@the-itinerists.local` : user);
  await page.getByPlaceholder('Enter your password').fill(password(user));
  await page.locator('form button[type=submit]').click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

export async function signOut(page: Page) {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Log Out' }).click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** A second person on their own phone: a separate browser context, already signed in. */
export async function secondPerson(browser: Browser, user: 'alayna' | 'maya', baseURL: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ ...devices['iPhone 14'], baseURL, storageState: STATE[user] });
  const page = await ctx.newPage();
  await page.goto('/home');
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
  await page.goto('/itinerary');
  await page.getByRole('button', { name: '+ Add event' }).first().click();
  await page.getByPlaceholder("What's happening?").fill(title);
  await page.getByRole('button', { name: 'Add Event', exact: true }).click();
  await expect(page.getByText(title).first()).toBeVisible();
}

/** The itinerary card holding `title`, for its edit button. */
export const itineraryCard = (page: Page, title: string) =>
  page.locator('.itinerary-item').filter({ hasText: title }).last();
