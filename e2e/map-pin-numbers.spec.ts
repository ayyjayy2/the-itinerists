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

  for (const day of ['Nov. 14', 'Nov. 16']) {
    await page.getByRole('button', { name: day, exact: true }).click();
    const numbers = await page.locator('.map-container .leaflet-marker-pane svg text').evaluateAll(els => els.map(e => (e.textContent ?? '').trim()));
    const sorted = numbers.map(Number).sort((a, b) => a - b);
    expect(sorted.length, `${day} has numbered pins`).toBeGreaterThan(1);
    expect(sorted, `${day} counts from 1`).toEqual(sorted.map((_, i) => i + 1));
  }
});
