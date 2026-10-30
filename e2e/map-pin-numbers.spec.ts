import { test, expect } from '@playwright/test';

// #584: a day's pins are numbered 1, 2, 3… in the day's order, counting only the
// stops that are on the map: a place that can't be found doesn't use up a
// number. Demo Nov 14 starts with "Wat Chedi Luang & Wat Phra Singh".
test('a day\'s pins count from 1, skipping places that aren\'t on the map', async ({ page }) => {
  let n = 0;
  await page.route('https://nominatim.openstreetmap.org/**', r => {
    if (decodeURIComponent(r.request().url()).includes('Wat Chedi Luang')) {
      return r.fulfill({ contentType: 'application/json', body: '[]' });   // not found
    }
    n++;
    const lat = 18.75 + (n % 9) * 0.012, lng = 98.93 + ((n * 5) % 9) * 0.012;
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify([{ lat: String(lat), lon: String(lng) }]) });
  });
  await page.route('https://tiles.openfreemap.org/**', r => r.abort());
  await page.goto('/map');
  await expect(page.locator('.status-chip.status-done')).toBeVisible({ timeout: 60_000 });

  // Nov 14 has four plans, the first not on the map; Nov 16 has one plan
  // (its songthaew is a ride, shown with its own icon, not numbered).
  const expected: Record<string, number[]> = { 'Nov. 14': [1, 2, 3], 'Nov. 16': [1] };
  for (const [day, numbers] of Object.entries(expected)) {
    await page.getByRole('button', { name: day, exact: true }).click();
    const read = () => page.locator('.map-container .leaflet-marker-pane svg text')
      .evaluateAll(els => els.map(e => Number((e.textContent ?? '').trim())).sort((a, b) => a - b));
    // Wait for the map to redraw for this day, then it must count from 1.
    await expect.poll(read, { message: `${day} counts from 1` }).toEqual(numbers);
  }

});
