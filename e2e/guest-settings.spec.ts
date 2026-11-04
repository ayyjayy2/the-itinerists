import { test, expect, Page } from '@playwright/test';

/** #743: a guest sees Trip settings read-only; Archive and Remove from my trips (which only affect them) stay. */

async function go(page: Page, route: string) {
  await page.evaluate(r => { history.pushState({}, '', r); dispatchEvent(new PopStateEvent('popstate', { state: {} })); }, route);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Log Out' }).click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page).toHaveURL(/\/login/);
  await go(page, '/join?code=DEMOJOIN');
  await page.getByRole('button', { name: 'See the trip' }).click();
  await page.getByLabel('What should the group call you?').fill('Robin');
  await page.getByRole('button', { name: 'See the trip' }).click();
  await expect(page).toHaveURL(/\/home/);
  await go(page, '/trip-settings');
  await expect(page.getByRole('heading', { name: 'Details' })).toBeVisible();
});

const card = (page: Page, heading: string | RegExp) =>
  page.locator('section.card').filter({ has: page.getByRole('heading', { name: heading, exact: typeof heading === 'string' }) });

test('a banner says it is read-only, and Create account opens the account sheet', async ({ page }) => {
  const banner = page.locator('.guest-nudge');
  await expect(banner).toContainText("You're a guest, so this is read-only.");
  await banner.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('#account-sheet-title')).toHaveText('Create your account');
});

test('Details are plain text, with no form and no Save', async ({ page }) => {
  const details = card(page, 'Details');
  await expect(details).toContainText('Chiang Mai, November');
  await expect(details).toContainText('Nov 12 – 19, 2026');
  await expect(details.locator('input, select')).toHaveCount(0);
  await expect(details.getByRole('button')).toHaveCount(0);
});

test('no sharing, inviting, removing or restoring', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Share with people at home' })).toHaveCount(0);
  await expect(card(page, /^Members/).getByRole('button')).toHaveCount(0);
  if (await card(page, 'Activity').count()) await expect(card(page, 'Activity').getByRole('button')).toHaveCount(0);
});

test('themes and menu pages are shown but greyed out', async ({ page }) => {
  const look = card(page, 'Appearance');
  await expect(look).toContainText('Create an account to pick one.');
  for (const b of await look.getByRole('button').all()) await expect(b).toBeDisabled();
  const menu = card(page, 'Customize Menu');
  await expect(menu).toContainText("Create an account to hide the ones you don't use.");
  for (const b of await menu.getByRole('button').all()) await expect(b).toBeDisabled();
});

test('Archive and Remove from my trips stay', async ({ page }) => {
  const trip = card(page, 'Trip');
  await expect(trip.getByRole('button', { name: 'Archive' })).toBeVisible();
  await expect(trip.getByRole('button', { name: 'Remove' })).toBeVisible();
});
