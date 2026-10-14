import { test, expect } from '@playwright/test';

// The demo trip is in Chiang Mai; a phone in Chicago is abroad there (#474).
test.use({ timezoneId: 'America/Chicago' });

test('partner offers: the eSIM card opens with its guide, and Hide sticks', async ({ page }) => {
  await page.goto('/recs');
  const card = page.locator('.offer-card', { hasText: 'Need data abroad?' });
  await expect(card).toBeVisible();
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

  await card.getByRole('button', { name: /Hide/ }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.offer-card', { hasText: 'Covered if plans change?' })).toBeVisible();
  await expect(page.locator('.offer-card', { hasText: 'Need data abroad?' })).toHaveCount(0);
});
