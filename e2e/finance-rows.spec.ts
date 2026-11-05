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

/** #781: the "Everyone" tag is light, so each expense's name and cost lead. */
test('the Everyone tag is a light tag, not a dark fill', async ({ page }) => {
  await page.goto('/finance');
  await page.getByRole('button', { name: /Expenses \(/ }).click();
  const tag = page.locator('.table-row', { hasText: 'Dash!' }).locator('.chip', { hasText: 'Everyone' });
  const lightness = await tag.evaluate(el => {
    const [r, g, b] = getComputedStyle(el).backgroundColor.match(/\d+/g)!.map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  });
  expect(lightness).toBeGreaterThan(0.75);
});
