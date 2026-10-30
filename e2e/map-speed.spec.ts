import { test, expect } from '@playwright/test';

// The map shows itself and its first pins while the rest are still being
// looked up, instead of a "Locating 3 / 20 pins…" screen until the last one.
test('the map and its first pins show while the rest are still being found', async ({ page }) => {
  let n = 0;
  await page.route('https://nominatim.openstreetmap.org/**', async route => {
    n++;
    await new Promise(r => setTimeout(r, 800));                 // a slow lookup
    const jitter = (n % 10) / 100;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ lat: String(18.79 + jitter), lon: String(98.98 + jitter) }]) });
  });

  await page.goto('/map');
  await expect(page.locator('.map-loading')).toHaveCount(0, { timeout: 3_000 });
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 3_000 });
  await expect(page.locator('.status-chip')).toContainText('Pinning');      // still working on the rest
});

test('switching days redraws the known pins at once, even while others are still being found', async ({ page }) => {
  await page.route('https://nominatim.openstreetmap.org/**', async route => {
    await new Promise(r => setTimeout(r, 800));
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ lat: '18.79', lon: '98.98' }]) });
  });
  await page.goto('/map');
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible({ timeout: 3_000 });

  const days = page.locator('.day-chip');
  for (const i of [2, 3, 0]) {
    await days.nth(i).click();
    await expect(days.nth(i)).toHaveClass(/active/, { timeout: 300 });
    await expect(page.locator('.map-loading')).toHaveCount(0);
  }
  await expect(page.locator('.status-chip')).toContainText('Pinning');   // lookups carried on behind
});
