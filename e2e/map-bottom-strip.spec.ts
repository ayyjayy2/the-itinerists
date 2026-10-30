import { test, expect } from '@playwright/test';

// #566: the Map page scrolls inside itself, so the page's 1.5rem bottom room never
// scrolled away: it sat as a tan strip between the legend and the tab bar,
// looking like a fixed bar and like the page didn't scroll. The map page's
// own scrolling area now reaches the tab bar.
test('the Map page leaves no strip above the tab bar', async ({ page }) => {
  await page.route('https://nominatim.openstreetmap.org/**', r =>
    r.fulfill({ contentType: 'application/json', body: '[{"lat":"18.79","lon":"98.98"}]' }));
  await page.goto('/map');
  await expect(page.locator('.map-legend')).toBeVisible();
  const scroller = (await page.locator('.map-page').boundingBox())!;
  const bar = (await page.locator('.tab-bar').boundingBox())!;
  expect(Math.abs(bar.y - (scroller.y + scroller.height))).toBeLessThanOrEqual(1);
});
