import { test, expect } from '@playwright/test';

/**
 * #753: on a phone the Expenses table scrolls sideways. Scrolled across to reach ✏️, part of the
 * background turned white (the cells were wider than the rows), and the edit form opened inside the
 * table, off to the left. Editing now opens a pop-up, like adding one.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/finance');
  await page.getByRole('button', { name: /Expenses \(/ }).click();
});

test('every row of the Expenses table is as wide as the table scrolls', async ({ page }) => {
  const table = page.locator('.expenses-table');
  const { scrollWidth, widths } = await table.evaluate(t => ({
    scrollWidth: t.scrollWidth,
    widths: [...t.children].map(c => Math.round((c as HTMLElement).getBoundingClientRect().width)),
  }));
  for (const w of widths) expect(w).toBeGreaterThanOrEqual(scrollWidth - 1);
});

test('editing an expense opens a pop-up, not a form inside the table', async ({ page }) => {
  await page.locator('.table-row', { hasText: 'Dash!' }).getByTitle('Edit').click();
  const dialog = page.getByRole('dialog', { name: 'Edit expense' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/^Vendor/)).toHaveValue('Dash!');
  await expect(page.locator('.expenses-table form, .expenses-table input')).toHaveCount(0);

  await dialog.getByLabel(/^Description/).fill('Farewell dinner, all in');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.table-row', { hasText: 'Dash!' })).toContainText('Farewell dinner, all in');
});

test('closing the edit pop-up keeps the expense as it was', async ({ page }) => {
  await page.locator('.table-row', { hasText: 'Dash!' }).getByTitle('Edit').click();
  const dialog = page.getByRole('dialog', { name: 'Edit expense' });
  await dialog.getByLabel(/^Description/).fill('Changed my mind');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.table-row', { hasText: 'Dash!' })).toContainText('Farewell dinner');
  await expect(page.locator('.table-row', { hasText: 'Dash!' })).not.toContainText('Changed my mind');
});
