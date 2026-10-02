import { test, expect } from '@playwright/test';

/** Picking a trip's start date moves straight on to the end date, opened on the start's month. */
test('new trip: picking the start date fills an empty end date and moves to it', async ({ page }) => {
  await page.goto('/trips/new');
  const start = page.locator('input[type=date]').nth(0);
  const end = page.locator('input[type=date]').nth(1);
  await start.fill('2027-03-14');
  await expect(end).toHaveValue('2027-03-14');
  await expect(end).toBeFocused();
});

test('trip settings: a later end date is kept, an earlier one follows the start', async ({ page }) => {
  await page.goto('/trip-settings');
  const start = page.locator('input[type=date]').nth(0);
  const end = page.locator('input[type=date]').nth(1);
  const endBefore = await end.inputValue();
  await start.fill('2026-11-10');                       // before the demo trip's end (Nov 19)
  await expect(end).toHaveValue(endBefore);
  await expect(end).toBeFocused();
  await start.fill('2026-12-01');                       // after it: the end moves up to the start
  await expect(end).toHaveValue('2026-12-01');
});
