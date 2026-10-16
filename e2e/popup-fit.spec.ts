import { test, expect, Page } from '@playwright/test';

/**
 * #470: "while inputting an expense on my phone the bottom of the screen gets
 * cut off"; #492: every pop-up with a text field. On an iPhone the keyboard covers the page without shrinking it;
 * only the visual viewport shrinks. Stand in for that: a visual viewport 330px
 * tall (a phone with its keyboard up), and check the whole form, save button
 * included, can be scrolled into that visible part.
 */
const VISIBLE = 330;

test.beforeEach(async ({ page }) => {
  await page.addInitScript((h: number) => {
    const fake = Object.assign(new EventTarget(), { height: h, offsetTop: 0, width: innerWidth, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true });
  }, VISIBLE);
});

async function expectFits(page: Page, saveName: string) {
  const card = page.locator('.modal-backdrop > *').first();
  await card.evaluate(el => (el.scrollTop = el.scrollHeight));          // scroll the form to its end
  const box = (await card.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(VISIBLE);
  const save = (await card.getByRole('button', { name: saveName, exact: true }).boundingBox())!;
  expect(save.y + save.height).toBeLessThanOrEqual(VISIBLE);
}

test('the add-expense form fits above the keyboard (Finance)', async ({ page }) => {
  await page.goto('/finance');
  await page.getByRole('button', { name: '+ Add' }).click();
  await expectFits(page, 'Add Expense');
});

test('the edit-expense form fits above the keyboard (Expenses)', async ({ page }) => {
  await page.goto('/expenses');
  await page.locator('.edit-btn').first().click();
  await expectFits(page, 'Save');
});

test('the add-flight form fits above the keyboard', async ({ page }) => {
  await page.goto('/flights');
  await page.getByRole('button', { name: '+ Add Flight' }).click();
  await expectFits(page, 'Add Flight');
});

test('the add-pin form fits above the keyboard (Map)', async ({ page }) => {
  await page.goto('/map');
  await page.getByRole('button', { name: '+ Add Pin' }).click();
  await expectFits(page, 'Save Pin');
});

test('the change-password form fits above the keyboard (Profile)', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Change Password' }).click();
  await expectFits(page, (await page.locator('.modal-box .btn-primary').first().innerText()).trim());
});
