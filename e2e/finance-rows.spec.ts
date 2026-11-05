import { test, expect } from '@playwright/test';

/** #762 (option A): on a phone, Finance's Expenses are two-line rows, with nothing off to the side. */
test('Expenses rows fit the screen, with the total and each share in sight', async ({ page }) => {
  await page.goto('/finance');
  await page.getByRole('button', { name: /Expenses \(/ }).click();
  const list = page.locator('.expenses-table');
  const { scroll, client } = await list.evaluate(t => ({ scroll: t.scrollWidth, client: t.clientWidth }));
  expect(scroll).toBeLessThanOrEqual(client + 1);

  const dash = page.locator('.table-row', { hasText: 'Dash!' });
  await expect(dash.locator('.x-sub')).toContainText('Nov 18 · Farewell dinner · paid by Theo');
  await expect(dash.locator('.x-amt')).toContainText('2,350.00');
  await expect(dash.locator('.x-amt')).toContainText('each');
  const box = (await dash.locator('.x-amt').boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await expect(page.locator('.expenses-table .table-header')).toHaveCount(0);
});
