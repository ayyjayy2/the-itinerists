import { test, expect } from '@playwright/test';

// Tips & Recs filters as one compact row of dropdowns, not rows of chips (#482).
test('recs filters: tick several categories from a dropdown that fits the phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('/recs');
  const button = page.getByRole('button', { name: /^Categories:/ });
  await expect(button).toHaveText(/Categories:\s*All/);
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  await button.click();
  const panel = page.getByRole('group', { name: 'Categories' });
  await expect(panel.getByRole('checkbox', { name: 'Coffee' })).toBeVisible();     // the group's own categories too
  await panel.getByRole('checkbox', { name: 'Food' }).check();
  await panel.getByRole('checkbox', { name: 'Coffee' }).check();
  await expect(button).toHaveText(/Categories:\s*Food, Coffee/);
  await expect(page.locator('.rec-title')).toHaveText(['Khao Soi Khun Yai', 'Ristr8to Lab']);

  const box = (await panel.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  await page.locator('.page-header h2').click();                                   // a tap elsewhere closes it
  await expect(panel).toHaveCount(0);
  await expect(page.locator('.rec-title')).toHaveCount(2);
});
