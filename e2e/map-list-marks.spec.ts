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

  const marks = () => page.locator('.loc-row .loc-mark').evaluateAll(els =>
    els.map(e => e.getAttribute('data-mark') === 'num' ? (e.textContent ?? '').trim() : e.getAttribute('data-mark')));

  // #603: a day's map shows what that day's Itinerary shows. Demo Nov 13 is
  // check-in day: the stay is on it, drawn as the house the map uses.
  await page.getByRole('button', { name: 'Nov. 13', exact: true }).click();
  await expect.poll(marks).toContain('stay');
  expect(await marks()).toContain('flight');   // and the flight that lands that night
  await expect(page.locator('.loc-row .loc-mark[data-mark="stay"] svg')).toHaveCount(1);

  // Nov 14 has four plans and nothing booked: a night mid-stay isn't on the
  // Itinerary, and custom pins aren't tied to a day.
  await page.getByRole('button', { name: 'Nov. 14', exact: true }).click();
  await expect.poll(marks).toEqual(['1', '2', '3', '4']);

  // Nov 12 is the day the flights in take off; the Itinerary has them on Nov 13, when they land.
  await page.getByRole('button', { name: 'Nov. 12', exact: true }).click();
  await expect.poll(marks).not.toContain('flight');

  // All Days still has the trip's three custom pins, as stars.
  await page.getByRole('button', { name: 'All Days', exact: true }).click();
  await expect.poll(async () => (await marks()).filter(m => m === 'pin').length).toBe(3);
  // So does the legend.
  await expect(page.locator('.map-legend .loc-mark[data-mark="stay"] svg')).toHaveCount(1);
  await expect(page.locator('.map-legend .loc-mark[data-mark="pin"] svg')).toHaveCount(1);
});
