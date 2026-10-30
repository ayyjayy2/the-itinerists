import { test, expect } from '@playwright/test';

// #558: once the trip is over, each day shows what the weather was, from
// Open-Meteo's history service; the forecast isn't asked for past days.
// The demo trip is in Chiang Mai, Nov 12 – 19, 2026.
test('after the trip, its days show what the weather was', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-03-01T12:00:00Z'));

  await page.route('https://nominatim.openstreetmap.org/**', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ lat: '18.79', lon: '98.98' }]) }));
  const forecastAsked: string[] = [];
  await page.route('https://api.open-meteo.com/**', route => { forecastAsked.push(route.request().url()); return route.abort(); });
  let historyUrl = '';
  await page.route('https://archive-api.open-meteo.com/**', route => {
    historyUrl = route.request().url();
    const time = ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'];
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ daily: {
      time,
      temperature_2m_min: time.map(() => 66.4),
      temperature_2m_max: time.map(() => 87.6),
      weather_code: time.map(() => 1),
    } }) });
  });

  await page.goto('/outfits');
  await page.getByRole('button', { name: 'All Days' }).click();
  await expect(page.locator('.weather-mini', { hasText: '66–88°F' }).first()).toBeVisible();
  expect(historyUrl).toContain('start_date=2026-11-12');
  expect(historyUrl).toContain('end_date=2026-11-19');
  expect(forecastAsked).toEqual([]);
});
