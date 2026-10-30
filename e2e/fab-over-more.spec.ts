import { test, expect } from '@playwright/test';

// #562: scrolled down Finance shows its round + button. It sat over the tab bar's
// More button, so tapping More opened a new expense instead of the menu.
test('Finance: tapping More with the + button showing opens the More menu', async ({ page }) => {
  await page.goto('/finance');
  await page.getByRole('button', { name: '+ Add' }).waitFor();
  // Scroll the page content until the + Add button is out of view and the round + appears.
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('*')))
      if (el.scrollHeight > el.clientHeight + 50 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) el.scrollTop = el.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
  });
  const fab = page.locator('button.fab');
  await expect(fab).toBeVisible();

  // Tap the middle of More, as a finger would.
  const more = page.locator('.tab-item', { hasText: 'More' });
  const box = (await more.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.locator('.more-sheet')).toBeVisible();
  await expect(page.locator('.modal-card')).toHaveCount(0);

  // And the + button sits clear of the tab bar.
  const f = (await fab.boundingBox())!;
  const bar = (await page.locator('.tab-bar').boundingBox())!;
  expect(f.y + f.height).toBeLessThanOrEqual(bar.y);
});
