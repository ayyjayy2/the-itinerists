import { test, expect } from '@playwright/test';

// #601: each row in the list under the map shows the same mark as its pin:
// a plan its number, a stay the house, a custom pin the star, a ride the car
// pin, a flight the plane. A day's plans are listed in their numbered order.
test('the list under the map shows each pin\'s own mark', async ({ page }) => {
  let n = 0;
  await page.route('https://nominatim.openstreetmap.org/**', r => {
    n++;
    const lat = 18.75 + (n % 9) * 0.012, lng = 98.93 + ((n * 5) % 9) * 0.012;
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify([{ lat: String(lat), lon: String(lng) }]) });
  });
  await page.route('https://tiles.openfreemap.org/**', r => r.abort());
  await page.goto('/map');
  await expect(page.locator('.status-chip.status-done')).toBeVisible({ timeout: 60_000 });

  // Demo Nov 14: four plans, the stay the group is in that night, and the
  // trip's three custom pins (not tied to a day, so they show on every day).
  await page.getByRole('button', { name: 'Nov. 14', exact: true }).click();
  const marks = () => page.locator('.loc-row .loc-mark').evaluateAll(els =>
    els.map(e => e.getAttribute('data-mark') === 'num' ? (e.textContent ?? '').trim() : e.getAttribute('data-mark')));
  await expect.poll(marks).toEqual(['1', '2', '3', '4', 'stay', 'pin', 'pin', 'pin']);

  // The stay's row draws the house the map uses, not a plain dot.
  await expect(page.locator('.loc-row .loc-mark[data-mark="stay"] svg')).toHaveCount(1);
  // So does the legend.
  await expect(page.locator('.map-legend .loc-mark[data-mark="stay"] svg')).toHaveCount(1);
  await expect(page.locator('.map-legend .loc-mark[data-mark="pin"] svg')).toHaveCount(1);
});
