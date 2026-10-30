import { test, expect } from '@playwright/test';

// #580: picking a day frames every stop of that day (its plans, stay, rides and
// flight arrival), not just the first plan's pin. Custom pins aren't tied to
// a day, so they don't widen the view.
test('a day on the map shows all of that day\'s stops', async ({ page }) => {
  // Every place lands somewhere different around Chiang Mai, up to ~10 km apart.
  let n = 0;
  await page.route('https://nominatim.openstreetmap.org/**', r => {
    n++;
    const lat = 18.75 + (n % 9) * 0.012, lng = 98.93 + ((n * 5) % 9) * 0.012;
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify([{ lat: String(lat), lon: String(lng) }]) });
  });
  await page.route('https://tiles.openfreemap.org/**', r => r.abort());
  await page.goto('/map');
  await expect(page.locator('.status-chip.status-done')).toBeVisible({ timeout: 30_000 });   // every place found

  for (const day of ['Nov. 13', 'Nov. 14', 'Nov. 15']) {
    await page.getByRole('button', { name: day, exact: true }).click();
    await page.waitForTimeout(700);                                   // the view settles
    const box = (await page.locator('.map-container').boundingBox())!;
    const pins = page.locator('.map-container .leaflet-marker-pane > *:not(.custom-pin)');
    const count = await pins.count();
    expect(count, `${day} has pins`).toBeGreaterThan(1);
    for (let i = 0; i < count; i++) {
      const p = (await pins.nth(i).boundingBox())!;
      const cx = p.x + p.width / 2, cy = p.y + p.height / 2;
      expect(cx >= box.x && cx <= box.x + box.width && cy >= box.y && cy <= box.y + box.height,
        `${day}: pin ${i + 1} of ${count} is on screen`).toBe(true);
    }
  }
});
