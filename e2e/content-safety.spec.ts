import { test, expect } from '@playwright/test';

// #407: text people type is shown as text everywhere, never run as code, and
// typed-in links are only ever web, email or phone links. The demo server
// sends no Content-Security-Policy, like the iPhone app, so injected script
// would really run here if it got through.
const PAYLOAD = '<img src=x onerror="window.__pwned=1">Sneaky pin';

test('a map pin with script-like text shows the text in its pop-up, and nothing runs', async ({ page }) => {
  // Answer the address lookup locally: the test has no network.
  await page.route('https://nominatim.openstreetmap.org/**', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ lat: '18.79', lon: '98.98', display_name: 'Test place' }]) }));
  await page.goto('/map');
  await page.getByRole('button', { name: '+ Add Pin' }).click();
  await page.getByPlaceholder('e.g. a landmark, restaurant, or address').fill('Test place');
  await page.getByPlaceholder('What do you want to call this pin?').fill(PAYLOAD);
  await page.getByPlaceholder('Optional note…').fill('<b>not bold</b> & <script>window.__pwned=2</script>');
  await page.getByRole('button', { name: 'Save Pin' }).click();

  await page.locator('.loc-row', { hasText: 'Sneaky pin' }).click();
  const popup = page.locator('.leaflet-popup-content');
  await expect(popup).toContainText(PAYLOAD);                                  // shown as typed
  await expect(popup).toContainText('<b>not bold</b> & <script>window.__pwned=2</script>');
  await expect(popup.locator('img, b, script')).toHaveCount(0);                // nothing became markup
  expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined();  // and nothing ran
});

test('a stay link that is not a web link is never shown as a link; a bare address gets https://', async ({ page }) => {
  await page.goto('/accommodations');
  const add = async (name: string, link: string) => {
    await page.getByRole('button', { name: '+ Add Stay' }).click();
    await page.getByPlaceholder('e.g. The Alida Hotel').fill(name);
    await page.getByPlaceholder('https://…').fill(link);
    await page.getByRole('button', { name: 'Save Stay' }).click();
    await expect(page.locator('.stay-card', { hasText: name })).toBeVisible();
  };
  await add('Script link stay', 'javascript:window.__pwned=3');
  await add('Bare link stay', 'booking.com/hotel/th/example');

  const scriptCard = page.locator('.stay-card', { hasText: 'Script link stay' });
  await expect(scriptCard.locator('a.link-chip')).toHaveCount(0);
  const bareCard = page.locator('.stay-card', { hasText: 'Bare link stay' });
  await expect(bareCard.locator('a.link-chip')).toHaveAttribute('href', 'https://booking.com/hotel/th/example');
  expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined();
});
