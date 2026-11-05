import { test, expect, Page } from '@playwright/test';

/** #774: Group Summary and Expenses look alike: label left, arrow right, ◀ folded and ▼ open, no emoji. */
async function check(page: Page, name: RegExp, label: string) {
  const bar = page.getByRole('button', { name });
  await expect(bar).toHaveAttribute('aria-expanded', 'false');
  const parts = async () => bar.evaluate(b => {
    const caret = b.querySelector('.gs-caret') as HTMLElement;
    const box = b.getBoundingClientRect(), c = caret.getBoundingClientRect();
    return { text: b.textContent!.replace(caret.textContent!, '').replace(/\s+/g, ' ').trim(), caret: caret.textContent!.trim(), right: box.right - c.right, cls: b.className };
  });
  const folded = await parts();
  expect(folded.text).toMatch(new RegExp('^' + label));
  expect(folded.caret).toBe('◀');
  expect(folded.right).toBeLessThan(20);                    // the arrow sits at the right
  await bar.click();
  await expect(bar).toHaveAttribute('aria-expanded', 'true');
  expect((await parts()).caret).toBe('▼');
  return folded.cls;
}

test('Group Summary and Expenses bars match', async ({ page }) => {
  await page.goto('/finance');
  const a = await check(page, /Group Summary/, 'Group Summary');
  const b = await check(page, /Expenses \(/, 'Expenses \\(');
  expect(a.split(' ')).toContain('group-summary-toggle');
  expect(b.split(' ')).toContain('group-summary-toggle');   // the same look
});
