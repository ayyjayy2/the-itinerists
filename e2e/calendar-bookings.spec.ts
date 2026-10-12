import { test, expect } from '@playwright/test';

// #410: the Calendar shows the same bookings the List does, so a day with a
// flight or a check-in never looks free.
test('the Calendar shows flights and check-ins, and counts them', async ({ page }) => {
  await page.goto('/itinerary');
  await page.getByRole('button', { name: 'All', exact: true }).first().click();

  // The List shows the arrival and the check-in on Friday, November 13.
  const listDay = page.locator('.day-group', { has: page.locator('.day-date', { hasText: 'November 13' }) });
  await expect(listDay.locator('.flight-banner')).toContainText('Arrive');
  await expect(listDay.locator('.stay-banner')).toContainText('Check in: Baan Nimman');

  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  const calDay = page.locator('.cal-day', { hasText: 'November 13' });
  await expect(calDay).toContainText('Check in: Baan Nimman');
  await expect(calDay).toContainText('Arrive');
  await expect(calDay.locator('.cal-booking[data-kind="flight"]')).toContainText('ICT');   // every time says its zone
  await expect(calDay.locator('.cal-count')).not.toHaveText(/^0 events/);
});
