import { test, expect, Page } from '@playwright/test';

/** #744: a guest sees "+ Plan your own"; it asks them to create an account first, then opens New trip. */

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
});

test('My trips: "+ Plan your own" instead of "+ New Trip", and no Invite', async ({ page }) => {
  await go(page, '/trips');
  await expect(page.getByRole('button', { name: '+ Plan your own' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ New Trip' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Invite/ })).toHaveCount(0);
});

test('Plan your own asks for an account first, then opens the New trip form', async ({ page }) => {
  await go(page, '/trips');
  await page.getByRole('button', { name: '+ Plan your own' }).click();
  const sheet = page.getByRole('dialog', { name: 'Plan your own trip' });
  await expect(sheet).toContainText("You'll stay on Chiang Mai, November too.");
  await expect(page).toHaveURL(/\/trips$/);
  await sheet.getByLabel('Email').fill('robin@example.com');
  await sheet.getByLabel(/^Password/).fill('Sunshine2026');
  await sheet.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: "You're all set" })).toBeVisible();
  await page.getByRole('button', { name: 'Plan your trip' }).click();
  await expect(page).toHaveURL(/\/trips\/new/);
});

test('Not now keeps them where they were', async ({ page }) => {
  await go(page, '/trips');
  await page.getByRole('button', { name: '+ Plan your own' }).click();
  await page.getByRole('button', { name: 'Not now' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/trips$/);
});
