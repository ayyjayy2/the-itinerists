import { test, expect, Page } from '@playwright/test';

async function signOut(page: Page) {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Log Out' }).click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page).toHaveURL(/\/login/);
}

test('a signed-out visitor opening the app lands on the welcome page', async ({ page }) => {
  await signOut(page);
  await page.goto('/home');
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole('heading', { name: /Plan the trip together/ })).toBeVisible();
  await expect(page.locator('video')).toHaveCount(3);
  await expect(page.locator('.app-card')).toContainText('Coming soon');
});

test('Notify me adds an email, and the browser and sign-in links go where they say', async ({ page }) => {
  await signOut(page);
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Notify me' }).click();
  await expect(page.locator('.app-card .field-error')).toContainText('email');
  await page.getByPlaceholder('you@example.com').fill('maya@example.com');
  await page.getByRole('button', { name: 'Notify me' }).click();
  await expect(page.locator('.app-card')).toContainText("You're on the list");

  await page.getByRole('link', { name: 'Continue in browser' }).click();
  await expect(page).toHaveURL(/\/signup/);
  await page.goto('/welcome');
  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/login/);
});

test('someone signed in skips the welcome page', async ({ page }) => {
  await page.goto('/welcome');
  await expect(page).toHaveURL(/\/home/);
});
