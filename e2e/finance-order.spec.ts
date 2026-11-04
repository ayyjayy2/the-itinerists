import { test, expect } from '@playwright/test';

/** #754: the Expenses list sits right below Group Summary, where it's easy to find. */
test('Finance shows Expenses right below Group Summary', async ({ page }) => {
  await page.goto('/finance');
  const summary = page.getByRole('button', { name: /Group Summary/ });
  const expenses = page.getByRole('button', { name: /Expenses \(/ });
  await expect(expenses).toBeVisible();
  const s = (await summary.boundingBox())!, e = (await expenses.boundingBox())!;
  const scope = (await page.getByRole('button', { name: 'My Trip', exact: true }).boundingBox())!;
  expect(e.y).toBeGreaterThan(s.y);
  expect(e.y).toBeLessThan(scope.y);
});
