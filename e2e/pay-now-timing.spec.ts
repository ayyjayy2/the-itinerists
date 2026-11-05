import { test, expect, Page } from '@playwright/test';

/**
 * #772, #783: Pay now waits inside a person's opened row until the trip's last day,
 * then sits on the row. The demo trip is in Chiang Mai, Nov 12 – 19, 2026 (Bangkok time).
 */
async function oweMaya(page: Page) {
  await page.goto('/finance');
  // Maya pays a big dinner for everyone, so I owe her overall.
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByPlaceholder('e.g. The Grey').fill('Big dinner');
  await page.getByPlaceholder('0.00').first().fill('40000');
  await page.locator('.modal-card select').filter({ has: page.locator('option', { hasText: 'Maya' }) }).first().selectOption('Maya');
  await page.getByRole('button', { name: 'Add Expense' }).click();
  return page.locator('.banner-negative');
}

test('before the last day, Pay now shows only once Maya is opened', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-15T12:00:00+07:00'));
  const owe = await oweMaya(page);
  const maya = owe.locator('.banner-person-tap').filter({ hasText: 'Maya' });
  await expect(maya).toHaveAttribute('aria-expanded', 'false');
  await expect(owe.getByRole('button', { name: 'Pay now' })).toHaveCount(0);
  await maya.click();
  await expect(owe.getByRole('button', { name: 'Pay now' })).toBeVisible();
});

test('on the last day, Pay now is on Maya\'s folded row', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-19T09:00:00+07:00'));
  const owe = await oweMaya(page);
  await expect(owe.locator('.banner-person-tap').filter({ hasText: 'Maya' })).toHaveAttribute('aria-expanded', 'false');
  await expect(owe.getByRole('button', { name: 'Pay now' })).toBeVisible();
});

test('the evening before the last day (Bangkok time), it still waits inside the row', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-18T23:30:00+07:00'));
  const owe = await oweMaya(page);
  await expect(owe.getByRole('button', { name: 'Pay now' })).toHaveCount(0);
});
