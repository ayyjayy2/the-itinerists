import { test, expect } from '@playwright/test';

test('editing an itinerary item can move it to another day with a date picker', async ({ page }) => {
  await page.goto('/itinerary');
  await page.getByRole('button', { name: 'All', exact: true }).first().click();
  const firstCard = page.locator('.itinerary-item').first();
  const title = (await firstCard.locator('.item-title').innerText()).trim();
  await firstCard.locator('button.edit-btn').click();

  const dateField = page.locator('.edit-form input[type=date]');
  await expect(dateField).toBeVisible();
  await expect(dateField).toHaveAttribute('min', '2026-11-12');   // the demo trip's dates
  await expect(dateField).toHaveAttribute('max', '2026-11-19');
  await dateField.fill('2026-11-18');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // The item now sits under Wed, Nov 18.
  const group = page.locator('.day-group', { has: page.locator('.day-date', { hasText: /Nov(ember)? 18/ }) });
  await expect(group.locator('.item-title', { hasText: title })).toBeVisible();
});
