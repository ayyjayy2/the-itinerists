import { test, expect } from '@playwright/test';

// Every time on the Itinerary says its zone, not only flights: typed plans,
// transport and stay times too, in List and Calendar (#537, AGENTS.md 3.2).
const clean = (t: string) => t.replace(/\s+/g, ' ').trim();
const LAST_TIME_HAS_ZONE = /\d{1,2}:\d{2} [AP]M [A-Z]{2,5}(?!.*\d:\d{2})/;

test('list view: typed plans, transport and stay times carry a zone code', async ({ page }) => {
  await page.goto('/itinerary');
  await page.getByRole('button', { name: 'All', exact: true }).first().click();
  await expect(page.locator('.item-left .item-time').first()).toBeVisible();

  const plans = (await page.locator('.item-left').allTextContents()).map(clean).filter(t => /\d:\d{2}/.test(t));
  expect(plans.length).toBeGreaterThan(0);
  for (const t of plans) expect(t).toMatch(LAST_TIME_HAS_ZONE);

  const banners = (await page.locator('.tb-time, .sb-time').allTextContents()).map(clean).filter(Boolean);
  for (const t of banners) expect(t).toMatch(/[AP]M [A-Z]{2,5}$/);
});

test('calendar view: times read as 12-hour times with a zone code', async ({ page }) => {
  await page.goto('/itinerary');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  const times = page.locator('.cal-item-time');
  await expect(times.first()).toBeVisible();
  for (const t of (await times.allTextContents()).map(clean)) expect(t).toMatch(/^\d{1,2}:\d{2} [AP]M [A-Z]{2,5}$/);
});

// Someone else's flight plan (in All) has no Flights-page moment for you, so it
// takes the zone of the airport it names, never the trip's: ORD is CST, not ICT.
test("a flight plan shows its airport's zone, not the trip's, in List and Calendar", async ({ page }) => {
  await page.goto('/itinerary');
  await page.getByRole('button', { name: 'All', exact: true }).first().click();
  const card = page.locator('.itinerary-item', { has: page.locator('.item-title', { hasText: 'Depart Chicago' }) });
  await expect(card.locator('.item-time').first()).toHaveText(/CST$/);
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  const item = page.locator('.cal-item', { hasText: 'Depart Chicago' }).first();
  await expect(item.locator('.cal-item-time')).toHaveText(/CST$/);
});

test("someone else's flight plan keeps its own time, in its airport's zone", async ({ page }) => {
  await page.goto('/itinerary');
  await page.getByRole('button', { name: 'All', exact: true }).first().click();
  const card = page.locator('.itinerary-item', { has: page.locator('.item-title', { hasText: 'Depart San Francisco' }) });
  await expect(card.locator('.item-time').first()).toHaveText(/^11:10 PM\s+PST$/);
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.locator('.cal-item', { hasText: 'Depart San Francisco' }).first().locator('.cal-item-time')).toHaveText(/^11:10 PM\s+PST$/);
});
