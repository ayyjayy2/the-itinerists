import { test, expect } from '@playwright/test';

test('editing an itinerary item can move it to another day with a date picker', async ({ page }) => {
  await page.goto('/itinerary');
  await page.getByRole('button', { name: 'All', exact: true }).first().click();
  // Pick the card by its title, not its place: more items arrive a moment after
  // the first ones and can take the top spot, so "the first card" changed
  // between reading its title and tapping Edit (#374).
  const title = 'Land in Chiang Mai';                                   // a demo item on Nov 13
  const card = page.locator('.itinerary-item', { has: page.locator('.item-title', { hasText: title }) });
  await card.locator('button.edit-btn').click();

  const dateField = page.locator('.edit-form input[type=date]');
  await expect(dateField).toBeVisible();
  await expect(dateField).toHaveValue('2026-11-13');                     // editing that item
  await expect(dateField).toHaveAttribute('min', '2026-11-12');   // the demo trip's dates
  await expect(dateField).toHaveAttribute('max', '2026-11-19');
  await dateField.fill('2026-11-18');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // The item now sits under Wednesday, November 18.
  const group = page.locator('.day-group', { has: page.locator('.day-date', { hasText: 'November 18' }) });
  await expect(group.locator('.item-title', { hasText: title })).toBeVisible();
});
