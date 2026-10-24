import { test, expect } from '@playwright/test';

// A time and its zone code are separate words ("11:35 PM ICT"), in the text
// itself and not only by a CSS margin: copied text and screen readers ran them
// together as "11:35 PMICT" (#538).
for (const { page: path, selector, all } of [
  { page: '/itinerary', selector: '.flight-time, .item-time', all: true },
  { page: '/flights', selector: '.t-val', all: false },
]) {
  test(`${path} times keep a space before their zone code`, async ({ page }) => {
    await page.goto(path);
    if (all) await page.getByRole('button', { name: 'All', exact: true }).first().click();

    const times = page.locator(selector);
    await expect(times.first()).toBeVisible();
    const texts = await times.allTextContents();
    const zoned = texts.map(t => t.replace(/\s+/g, ' ').trim()).filter(t => /[AP]M\s*[A-Z]{2,5}$/.test(t));
    expect(zoned.length).toBeGreaterThan(0);
    for (const t of zoned) expect(t).toMatch(/[AP]M [A-Z]{2,5}$/);
  });
}
