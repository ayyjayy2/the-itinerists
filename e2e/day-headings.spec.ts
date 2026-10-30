import { test, expect } from '@playwright/test';

// #556: every day reads by its date, with the name you gave it, or else its
// stop's city, underneath. The demo trip is in Chiang Mai, Nov 12 – 19, and
// Nov 14 is named "Old City".
test('days go by their date, with their name or city under it', async ({ page }) => {
  await page.goto('/itinerary');

  // The chips are dates, never a mix of names and "Day N".
  const dayChips = page.locator('.filter-chips .chip').filter({ hasNotText: /^\s*All/ });
  await expect(dayChips.filter({ hasText: 'Nov. 14' })).toHaveCount(1);
  for (const text of await dayChips.allInnerTexts()) expect(text.trim()).toMatch(/^Nov\. \d+$/);

  await page.getByRole('button', { name: 'All', exact: true }).first().click();
  const day = (date: string) => page.locator('.day-group', { has: page.locator('h3.day-date', { hasText: date }) });
  await expect(day('Fri., Nov. 13').locator('.day-note')).toHaveText('Chiang Mai');
  await expect(day('Sat., Nov. 14').locator('.day-note')).toHaveText('Old City');

  // Naming a day puts the name under its date; clearing it brings the city back.
  const fri = day('Fri., Nov. 13');
  await fri.getByRole('button', { name: 'Name this day' }).click();
  const input = fri.locator('.day-label-input');
  await expect(input).toHaveAttribute('placeholder', 'Chiang Mai');
  await input.fill('Arrival');
  await fri.getByRole('button', { name: 'Save' }).click();
  await expect(fri.locator('.day-note')).toHaveText('Arrival');

  await fri.getByRole('button', { name: 'Name this day' }).click();
  await fri.locator('.day-label-input').fill('');
  await fri.getByRole('button', { name: 'Save' }).click();
  await expect(fri.locator('.day-note')).toHaveText('Chiang Mai');
});

test('the Calendar and Outfits read by date too', async ({ page }) => {
  await page.goto('/itinerary');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  const cal = page.locator('.cal-day', { hasText: 'Sat., Nov. 14' });
  await expect(cal.locator('.cal-day-date')).toHaveText('Old City');

  await page.goto('/outfits');
  await expect(page.locator('.day-title').first()).toHaveText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\., Nov\. \d+$/);
});
