import { test, expect } from '@playwright/test';

/** #722: every My expenses row has its title, date, tags and amount in the same places. */
test('My expenses rows line up, with the whole amount showing', async ({ page }) => {
  await page.goto('/expenses');
  const rows = page.locator('.expense-row');
  await expect(rows.first()).toBeVisible();
  const boxes = await rows.evaluateAll(rs => rs.map(r => {
    const at = (sel: string) => { const e = r.querySelector(sel) as HTMLElement | null; const b = e?.getBoundingClientRect(); return b ? { x: Math.round(b.left), r: Math.round(b.right), top: Math.round(b.top - r.getBoundingClientRect().top) } : null; };
    const amt = r.querySelector('.exp-amount') as HTMLElement;
    return { title: at('.exp-title'), date: at('.exp-date'), tags: at('.exp-tags'), amount: at('.exp-amount'), clipped: amt.scrollWidth > amt.clientWidth + 1 };
  }));
  expect(boxes.length).toBeGreaterThan(2);
  for (const b of boxes) {
    expect(b.title, 'every row has a title').not.toBeNull();
    expect(b.title, 'title').toEqual(jasmineLike(boxes[0].title));
    expect(b.date?.x, 'date left').toBe(boxes[0].date?.x);
    expect(b.tags?.x, 'tags left').toBe(boxes[0].tags?.x);
    expect(b.amount?.r, 'amount right').toBe(boxes[0].amount?.r);
    expect(b.amount?.top, 'amount top').toBe(boxes[0].amount?.top);
    expect(b.clipped, 'amount clipped').toBe(false);
  }
});

/** Same left edge and top for every title. */
function jasmineLike(t: { x: number; top: number } | null) { return t ? expect.objectContaining({ x: t.x, top: t.top }) : null; }
