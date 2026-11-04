import { test, expect, Page } from '@playwright/test';

/** #768: joining as a guest with a name already on the trip. */
async function go(page: Page, route: string) {
  await page.evaluate(r => { history.pushState({}, '', r); dispatchEvent(new PopStateEvent('popstate', { state: {} })); }, route);
}
async function join(page: Page, name: string) {
  await go(page, '/join?code=DEMOJOIN');
  await page.getByRole('button', { name: 'See the trip' }).click();
  await page.getByLabel('What should the group call you?').fill(name);
  await page.getByRole('button', { name: 'See the trip' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Log Out' }).click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page).toHaveURL(/\/login/);
});

test('a name someone else has: pick another one', async ({ page }) => {
  await join(page, 'maya');
  await expect(page.getByText('Someone on this trip is already called Maya. Add an initial or a nickname.')).toBeVisible();
  await expect(page.getByRole('button', { name: /this is me/i })).toHaveCount(0);
  const field = page.getByLabel('What should the group call you?');
  await field.fill('Maya');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Someone on this trip is already called Maya.')).toBeVisible();
  await field.fill('Maya B');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/home/);
  await go(page, '/trip-settings');
  await expect(page.locator('.member-row', { hasText: 'Maya B' })).toContainText('You');
});

test('a guest who left comes back: "Is this you?" Yes carries on as them', async ({ page }) => {
  await join(page, 'Robin');
  await expect(page).toHaveURL(/\/home/);
  await page.route('**/login', route => route.fulfill({ status: 204 }));   // keep the demo's data through log-out
  await go(page, '/profile');
  await page.getByRole('button', { name: 'Log Out' }).click();
  await page.getByRole('dialog', { name: 'Log out as a guest?' }).getByRole('button', { name: 'Log out' }).click();
  await page.unroute('**/login');

  await join(page, 'robin');
  await expect(page.getByRole('heading', { name: "There's already a Robin on this trip" })).toBeVisible();
  await page.getByRole('button', { name: 'Yes, this is me' }).click();
  await expect(page).toHaveURL(/\/home/);
  await go(page, '/trip-settings');
  const robins = page.locator('.member-row', { hasText: 'Robin' });
  await expect(robins).toHaveCount(1);
  await expect(robins).not.toContainText('Left');
});

test('a guest who left, but "No, I\'m someone else": pick another name', async ({ page }) => {
  await join(page, 'Robin');
  await expect(page).toHaveURL(/\/home/);
  await page.route('**/login', route => route.fulfill({ status: 204 }));
  await go(page, '/profile');
  await page.getByRole('button', { name: 'Log Out' }).click();
  await page.getByRole('dialog', { name: 'Log out as a guest?' }).getByRole('button', { name: 'Log out' }).click();
  await page.unroute('**/login');

  await join(page, 'Robin');
  await page.getByRole('button', { name: "No, I'm someone else" }).click();
  await page.getByLabel('What should the group call you?').fill('Robin K');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/home/);
});
