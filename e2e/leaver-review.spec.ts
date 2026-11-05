import { test, expect, Page } from '@playwright/test';

/**
 * #747: a guest who logs out stays on the trip, marked left. Back as the
 * planner, Finance lists the expenses they're still in; Edit takes one off the
 * list once saved, and Looks right clears the rest.
 * Logging out reloads the page, which would reset the demo, so the reload is
 * stopped and the test carries on in the same page.
 */
async function go(page: Page, route: string) {
  await page.evaluate(r => { history.pushState({}, '', r); dispatchEvent(new PopStateEvent('popstate', { state: {} })); }, route);
}

test('a guest logs out; the planner checks what they were in', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Log Out' }).click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page).toHaveURL(/\/login/);
  await go(page, '/join?code=DEMOJOIN');
  await page.getByRole('button', { name: 'See the trip' }).click();
  await page.getByLabel('What should the group call you?').fill('Robin');
  await page.getByRole('button', { name: 'See the trip' }).click();
  await expect(page).toHaveURL(/\/home/);

  // Robin logs out. Keep the page (and the demo's data) instead of reloading it.
  await page.route('**/login', route => route.fulfill({ status: 204 }));   // 204: the browser stays on this page
  await go(page, '/profile');
  await page.getByRole('button', { name: 'Log Out' }).click();
  await page.getByRole('dialog', { name: 'Log out as a guest?' }).getByRole('button', { name: 'Log out' }).click();
  await page.unroute('**/login');

  // The planner signs back in.
  await go(page, '/login');
  await page.getByLabel(/^Email/).fill('alayna@example.com');
  await page.getByLabel(/^Password/).fill('Sunshine2026');
  await page.getByRole('button', { name: /^Sign in|^Log in/ }).click();
  await expect(page).toHaveURL(/\/home/);

  // The group hears it on the bell (#788).
  await page.getByRole('button', { name: 'Group updates' }).click();
  await expect(page.locator('.bell-dropdown')).toContainText('Robin left the trip');
  await page.locator('.bell-scrim').click();

  await go(page, '/finance');
  const card = page.locator('.leaver-review');
  await expect(card.getByRole('heading')).toHaveText('Robin (guest) left the trip');
  await expect(card).toContainText('Robin is still in');
  // The list is in a pop-up (#789).
  await card.getByRole('button', { name: 'Review' }).click();
  const sheet = page.getByRole('dialog', { name: 'What Robin is still in' });
  const rows = sheet.locator('li');
  await expect(rows.first()).toBeVisible();
  const before = await rows.count();
  expect(before).toBeGreaterThan(1);
  await expect(sheet).not.toContainText('Expense ·');
  const first = (await rows.first().locator('b').textContent())!.trim();

  await rows.first().getByRole('button', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit expense' });
  await expect(edit).toContainText('Robin (guest) left the trip');
  await edit.getByRole('button', { name: /Robin/ }).click();   // take Robin out of the split
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  // Back to the list, saying so, one fewer.
  await expect(sheet).toContainText(`Saved: ${first}`);
  await expect(rows).toHaveCount(before - 1);

  await sheet.getByRole('button', { name: 'Looks right' }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByText('That’s everything Robin was in, checked.')).toBeVisible();

  await go(page, '/trip-settings');
  await expect(page.locator('.member-row', { hasText: 'Robin' })).toContainText('Left');
});
