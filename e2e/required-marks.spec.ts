import { test, expect, Page } from '@playwright/test';

/**
 * Every required field's label ends in the same red asterisk (#733): a blank
 * required field once left Add greyed out with nothing to say why.
 */

/** Label text (star removed) → the star's colour, for each visible label with one. */
async function starred(page: Page): Promise<Record<string, string>> {
  return page.$$eval('label', ls => Object.fromEntries(ls
    .filter(l => (l as HTMLElement).offsetParent !== null && l.querySelector('.label-required'))
    .map(l => [l.textContent!.replace('*', '').replace(/\(IATA\)/, '').replace(/\s+/g, ' ').trim(),
               getComputedStyle(l.querySelector('.label-required')!).color])));
}

const RED = 'rgb(192, 86, 74)';   // --danger

const forms: Array<[string, (p: Page) => Promise<void>, string[]]> = [
  ['/trips/new', async () => {}, ['Trip name', 'Destination', 'Start date', 'End date']],
  ['/trip-settings', async () => {}, ['Trip name']],
  ['/finance', async p => { await p.getByRole('button', { name: '+ Add' }).click(); }, ['Vendor', 'Amount']],
  ['/expenses', async p => { await p.getByRole('button', { name: '+ Add Expense' }).click(); }, ['Description', 'Amount']],
  ['/flights', async p => { await p.getByRole('button', { name: /add flight/i }).click(); },
    ['From', 'To', 'Departure Date', 'Departure Time', 'Arrival Date', 'Arrival Time']],
  ['/itinerary', async p => { await p.getByRole('button', { name: '+ Add event' }).first().click(); }, ['Activity']],
  ['/recs', async p => { await p.getByRole('button', { name: /add rec/i }).click(); }, ['Category', 'Title']],
  ['/accommodations', async p => { await p.getByRole('button', { name: /add stay/i }).click(); }, ['Name']],
  ['/profile', async () => {}, ['Name']],
];

for (const [route, open, required] of forms) {
  test(`required fields on ${route} carry the red star`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    await open(page);
    await expect(page.locator('label', { hasText: required[0] }).locator('.label-required').first()).toBeVisible();
    const stars = await starred(page);
    for (const label of required) expect(stars[label], label).toBe(RED);
  });
}

test('sign-in and sign-up star their required fields', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Log Out' }).click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(Object.keys(await starred(page))).toEqual(['Email', 'Password']);
  await page.goto('/signup');
  expect(Object.keys(await starred(page))).toEqual(['Your Name', 'Email', 'Password', 'Confirm Password']);
});
