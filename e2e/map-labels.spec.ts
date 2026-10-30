import { test, expect, Page } from '@playwright/test';

// The trip map's background comes from OpenFreeMap (drawn by MapLibre), with
// labels in the app's language by default and a "Local names" switch (#568).
async function stubMap(page: Page) {
  const seen = { style: 0, osmTiles: 0, worker: 0 };
  await page.route('https://nominatim.openstreetmap.org/**', r =>
    r.fulfill({ contentType: 'application/json', body: '[{"lat":"18.79","lon":"98.98"}]' }));
  await page.route('https://tiles.openfreemap.org/styles/**', r => {
    seen.style++;
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({
      version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#eee' } }],
    }) });
  });
  await page.route('https://*.tile.openstreetmap.org/**', r => { seen.osmTiles++; return r.abort(); });
  page.on('request', r => { if (r.url().includes('maplibre-gl-worker')) seen.worker++; });
  return seen;
}

test('the map draws OpenFreeMap with labels in the app\'s language, and remembers "Local names"', async ({ page }) => {
  const seen = await stubMap(page);
  await page.goto('/map');
  const local = page.getByRole('button', { name: 'Local names' });
  await expect(local).toHaveAttribute('aria-pressed', 'false');      // the app's language by default
  await expect.poll(() => seen.style).toBeGreaterThan(0);
  await expect.poll(() => seen.worker).toBeGreaterThan(0);           // the worker comes from our own site
  expect(seen.osmTiles).toBe(0);

  await local.click();
  await expect(local).toHaveAttribute('aria-pressed', 'true');
  // Leave the page and come back (the demo clears saved map settings on a full reload).
  await page.locator('.tab-bar').getByText('Home').click();
  await expect(page).toHaveURL(/\/home/);
  await page.goBack();
  await expect(page).toHaveURL(/\/map/);
  await expect(page.getByRole('button', { name: 'Local names' })).toHaveAttribute('aria-pressed', 'true');
});
