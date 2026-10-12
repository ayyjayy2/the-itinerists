import { test, expect, Page } from '@playwright/test';

// Every password field has an eye that shows what was typed, and hides it again.
async function checkEyes(page: Page, scope = page.locator('body')) {
  const fields = scope.locator('.input-wrap input, .pw-wrap input');
  const eyes = scope.locator('.eye-btn');
  await expect(fields.first()).toBeVisible();
  const n = await fields.count();
  await expect(eyes).toHaveCount(n);
  for (let i = 0; i < n; i++) await fields.nth(i).fill('Secret123');
  for (let i = 0; i < n; i++) {
    const box = await eyes.nth(i).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await eyes.nth(i).click();
    await expect(fields.nth(i)).toHaveAttribute('type', 'text');
    await expect(eyes.nth(i)).toHaveAttribute('aria-label', 'Hide password');
    await eyes.nth(i).click();
    await expect(fields.nth(i)).toHaveAttribute('type', 'password');
  }
  await expect(fields.first()).toHaveValue('Secret123');
}

test('profile: change password, email and delete account fields have the eye', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Change Password' }).click();
  await checkEyes(page, page.locator('.modal-box'));
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: /delete account/i }).first().click();
  await checkEyes(page, page.locator('.modal-box'));
});

test('sign-in and sign-up have the eye', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Log Out' }).click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page).toHaveURL(/\/login/);
  await checkEyes(page);
  await page.goto('/signup');
  await checkEyes(page);
});
