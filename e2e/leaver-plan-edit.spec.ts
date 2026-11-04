import { test, expect } from '@playwright/test';

/**
 * #747: Edit on Finance's "<guest> left the trip" card opens a plan's own edit
 * form in Itinerary; Save goes back to Finance, which says it was saved.
 * (The demo's 6th plan is the Nimman coffee crawl, for Alayna and Maya.)
 */
test('a plan edited from the left-guest card goes back to Finance, saved', async ({ page }) => {
  await page.goto('/itinerary?focus=it-6&edit=1&review=someone');
  const form = page.locator('.edit-card, .item-edit, [class*="edit"]').filter({ has: page.getByRole('button', { name: 'Save', exact: true }) }).first();
  await expect(form).toBeVisible();
  await expect(form.getByRole('textbox').first()).toHaveValue(/\S/);
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/finance\?.*reviewed=Nimman/);
});
