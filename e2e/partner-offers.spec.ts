import { test, expect } from '@playwright/test';

// The demo trip is in Chiang Mai; a phone in Chicago is abroad there (#474).
test.use({ timezoneId: 'America/Chicago' });

test('partner offers: the eSIM card opens with its guide, and the cards stay like other tips', async ({ page }) => {
  await page.goto('/recs');
  // With the rest of the recs: at the end of the Tips group, for the whole trip (#476).
  const tips = page.locator('.rec-group', { has: page.locator('.rec-group-title', { hasText: 'Tips' }) });
  const card = tips.locator('.offer-card', { hasText: 'Need data abroad?' });
  await expect(card).toBeVisible();
  await expect(tips.locator('.rec-card').last()).toContainText('Covered if plans change?');
  await page.locator('.filter-chips .chip', { hasText: 'Food' }).click();
  await expect(page.locator('.offer-card')).toHaveCount(0);
  await page.locator('.filter-chips .chip', { hasText: 'All' }).first().click();
  await expect(card).toContainText('Thailand');
  await expect(page.locator('.offer-card', { hasText: 'Covered if plans change?' })).toBeVisible();

  await card.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Sample eSIM A')).toBeVisible();
  await expect(dialog.locator('a.offer-open').first()).toHaveAttribute('href', 'https://example.com/esim-a');
  await dialog.getByRole('tab', { name: "What's an eSIM?" }).click();
  await expect(dialog.getByText('Pick a plan before you go')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await expect(card.getByRole('button', { name: /Hide/ })).toHaveCount(0);       // no Hide (#480)
  await page.reload();
  await expect(tips.locator('.offer-card', { hasText: 'Need data abroad?' })).toBeVisible();
});

test('the offer pop-up fits between the header and the tab bar, with the same gap at both ends', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 600 });     // a short phone screen: the pop-up must scroll, not run under the tab bar
  await page.goto('/recs');
  await page.locator('.offer-card', { hasText: 'Need data abroad?' }).click();
  await page.getByRole('tab', { name: "What's an eSIM?" }).click();   // the longest content
  const sheet = await page.locator('.offer-sheet').boundingBox();
  const header = await page.locator('.app-header, header').first().boundingBox();
  const tabs = await page.locator('nav.tab-bar').boundingBox();
  expect(sheet && header && tabs).toBeTruthy();
  const gapTop = sheet!.y - (header!.y + header!.height);
  const gapBottom = tabs!.y - (sheet!.y + sheet!.height);
  expect(gapTop).toBeGreaterThanOrEqual(8);
  expect(gapBottom).toBeGreaterThanOrEqual(8);
  expect(Math.abs(gapTop - gapBottom)).toBeLessThanOrEqual(2);

  // Only the content scrolls: the title and ✕ stay where they are.
  const closeBefore = await page.locator('.offer-close').boundingBox();
  await page.locator('.offer-body').evaluate(el => el.scrollTo(0, el.scrollHeight));
  await expect(page.locator('.offer-disclosure')).toBeInViewport();          // the end of the pop-up
  expect((await page.locator('.offer-close').boundingBox())!.y).toBe(closeBefore!.y);
  await expect(page.locator('#offer-title')).toBeInViewport();
});
