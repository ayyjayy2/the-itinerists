import { test, expect } from '@playwright/test';

// #535: after the trip, Home called the last (finished) event "First up".
// The demo trip is in Chiang Mai, Nov 12 – 19, 2026.
test('after the trip, Home shows the last plan, never "First up"', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-22T12:00:00Z'));
  await page.goto('/');
  const card = page.locator('[data-widget="itinerary"]');
  await expect(card).toContainText('Last plan:');
  await expect(card).not.toContainText('First up');
});
