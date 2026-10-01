import { test, expect, Page } from '@playwright/test';

/**
 * iPhone Safari and the native app's web view zoom the page in whenever a
 * field whose text is under 16px is focused, and stay zoomed across pages:
 * the header and tab bar then appear to scroll away. Every field must be at
 * least 16px. (Found 2026-10-01: all fields were 15.2px.)
 */

async function smallFields(page: Page): Promise<string[]> {
  return page.$$eval('input, select, textarea', els => els
    .filter(e => (e as HTMLElement).offsetParent !== null && (e as HTMLInputElement).type !== 'checkbox' && (e as HTMLInputElement).type !== 'radio')
    .filter(e => parseFloat(getComputedStyle(e).fontSize) < 16)
    .map(e => `${e.tagName.toLowerCase()}[${(e as HTMLInputElement).type}] ${getComputedStyle(e).fontSize} ${(e as HTMLInputElement).placeholder ?? ''}`.trim()));
}

const pages: Array<[string, (p: Page) => Promise<void>]> = [
  ['/trips/new', async () => {}],
  ['/finance', async p => { await p.getByRole('button', { name: '+ Add' }).click(); }],
  ['/flights', async p => { await p.getByRole('button', { name: /add flight/i }).click(); }],
  ['/itinerary', async p => { await p.getByRole('button', { name: '+ Add event' }).first().click(); }],
  ['/packing', async () => {}],
  ['/profile', async () => {}],
  ['/trip-settings', async () => {}],
  ['/recs', async p => { await p.getByRole('button', { name: /add rec/i }).click(); }],
  ['/accommodations', async p => { await p.getByRole('button', { name: /add stay/i }).click(); }],
  ['/transportation', async p => { await p.getByRole('button', { name: /add transportation/i }).click(); }],
];

for (const [route, open] of pages) {
  test(`no field under 16px on ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    await open(page);
    expect(await smallFields(page)).toEqual([]);
  });
}

test('no field under 16px on sign-in and sign-up', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Log Out' }).click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(await smallFields(page)).toEqual([]);
  await page.goto('/signup');
  expect(await smallFields(page)).toEqual([]);
});

test('double-tap never zooms the page', async ({ page }) => {
  await page.goto('/home');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).toBe('manipulation');
});
