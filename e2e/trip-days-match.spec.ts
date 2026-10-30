import { test, expect, Page } from '@playwright/test';

// #582: the Itinerary and the Map offer the same days, worded the same, in both
// My Trip and All, starting on the day you set off.
const chips = (page: Page, sel: string) =>
  page.locator(sel).allInnerTexts().then(t => t.map(s => s.trim()).filter(s => !/^All Days$/.test(s)));

test('the Itinerary and the Map list the same days', async ({ page }) => {
  await page.route('https://nominatim.openstreetmap.org/**', r =>
    r.fulfill({ contentType: 'application/json', body: '[{"lat":"18.79","lon":"98.98"}]' }));
  await page.route('https://tiles.openfreemap.org/**', r => r.abort());

  for (const scope of ['My Trip', 'All']) {
    await page.goto('/itinerary');
    await page.getByRole('button', { name: scope, exact: true }).first().click();
    const itinerary = await chips(page, '.filter-chips .chip');

    await page.goto('/map');
    await page.locator('.map-scope').getByRole('button', { name: scope, exact: true }).click();
    await expect(page.locator('.day-chip').nth(1)).toBeVisible();
    const map = await chips(page, '.day-chip');

    expect(map, `${scope}: Map days match the Itinerary`).toEqual(itinerary);
    expect(itinerary, `${scope}: starts on the day you set off`).toContain('Nov. 12');
  }
});

test('My Trip shows the day you set off, with its plans', async ({ page }) => {
  await page.goto('/itinerary');
  await page.getByRole('button', { name: 'My Trip', exact: true }).first().click();
  const nov12 = page.locator('.day-group', { has: page.locator('.day-date', { hasText: 'November 12' }) });
  await expect(nov12.locator('.item-title', { hasText: 'Depart Chicago' })).toBeVisible();
});
