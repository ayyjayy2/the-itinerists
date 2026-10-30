import { test, expect } from '@playwright/test';

// #556/#560: the chips read by date; each day's heading is the name you gave
// it, or else its stop's city, with the full date under it. The demo trip is
// in Chiang Mai, Nov 12 – 19, and Nov 14 is named "Old City".
test('chips go by date; each day leads with its name or city', async ({ page }) => {
  await page.goto('/itinerary');

  // The chips are dates, never a mix of names and "Day N".
  const dayChips = page.locator('.filter-chips .chip').filter({ hasNotText: /^\s*All/ });
  await expect(dayChips.filter({ hasText: 'Nov. 14' })).toHaveCount(1);
  for (const text of await dayChips.allInnerTexts()) expect(text.trim()).toMatch(/^Nov\. \d+$/);

  await page.getByRole('button', { name: 'All', exact: true }).first().click();
  // #560: the place leads, and the full date sits under it.
  const day = (date: string) => page.locator('.day-group', { has: page.locator('.day-date', { hasText: date }) });
  await expect(day('Friday, November 13').locator('h3.day-name')).toHaveText('Chiang Mai');
  await expect(day('Saturday, November 14').locator('h3.day-name')).toHaveText('Old City');

  // Naming a day makes it the heading; clearing it brings the city back.
  const fri = day('Friday, November 13');
  await fri.getByRole('button', { name: 'Name this day' }).click();
  const input = fri.locator('.day-label-input');
  await expect(input).toHaveAttribute('placeholder', 'Chiang Mai');
  await input.fill('Arrival');
  // Save and Cancel are full-size buttons, far enough apart not to hit the wrong one.
  const save = fri.getByRole('button', { name: 'Save' });
  const cancel = fri.getByRole('button', { name: 'Cancel' });
  for (const b of [save, cancel]) {
    const box = (await b.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
  const [s, c] = [(await save.boundingBox())!, (await cancel.boundingBox())!];
  expect(Math.max(c.x - (s.x + s.width), s.x - (c.x + c.width), c.y - (s.y + s.height), s.y - (c.y + c.height))).toBeGreaterThanOrEqual(8);
  await save.click();
  await expect(fri.locator('h3.day-name')).toHaveText('Arrival');

  await fri.getByRole('button', { name: 'Name this day' }).click();
  await fri.locator('.day-label-input').fill('');
  await fri.getByRole('button', { name: 'Save' }).click();
  await expect(fri.locator('h3.day-name')).toHaveText('Chiang Mai');
});

test('the Calendar and Outfits lead with the place too', async ({ page }) => {
  await page.goto('/itinerary');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  const cal = page.locator('.cal-day', { hasText: 'Saturday, November 14' });
  await expect(cal.locator('.cal-day-label')).toHaveText('Old City');

  await page.goto('/outfits');
  await expect(page.locator('.day-title').first()).toHaveText('Chiang Mai');
  await expect(page.locator('.day-date').first()).toHaveText(/^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day, November \d+$/);
});
