import { test, expect, Page } from '@playwright/test';

/** #742: a guest's Home and Profile push creating an account; Profile keeps only what a guest can use. */

/** Join the demo trip's standing invite as a guest. A page load resets the demo, so move in-app after this. */
async function joinAsGuest(page: Page) {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Log Out' }).click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page).toHaveURL(/\/login/);
  await go(page, '/join?code=DEMOJOIN');
  await page.getByRole('button', { name: 'See the trip' }).click();
  await page.getByLabel('What should the group call you?').fill('Robin');
  await page.getByRole('button', { name: 'See the trip' }).click();
  await expect(page).toHaveURL(/\/home/);
}

async function go(page: Page, route: string) {
  await page.evaluate(r => { history.pushState({}, '', r); dispatchEvent(new PopStateEvent('popstate', { state: {} })); }, route);
}

test.beforeEach(async ({ page }) => { await joinAsGuest(page); });

test('Home asks a guest to create an account, not to add a recovery email', async ({ page }) => {
  const nudge = page.locator('.recovery-nudge');
  await expect(nudge).toContainText("You're a guest on this trip.");
  await expect(page.getByText('Add a recovery email')).toHaveCount(0);
  await nudge.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
});

test('a guest\'s Profile leads with Create your account, then only what a guest can use', async ({ page }) => {
  await go(page, '/profile');
  const cards = page.locator('.card');
  await expect(cards.first()).toContainText('Create your account');
  await expect(cards.first()).toContainText("You're a guest on Chiang Mai, November.");
  await expect(page.getByRole('heading', { name: 'Display Info' })).toBeVisible();
  for (const gone of ['My currency', 'Payment apps']) await expect(page.getByRole('heading', { name: gone })).toHaveCount(0);
  for (const gone of ['Download my data', 'Change Password', 'Delete Account']) await expect(page.getByRole('button', { name: gone })).toHaveCount(0);

  await cards.first().getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('#account-sheet-title')).toHaveText('Create your account');
});

test('a guest\'s log-out pop-up: Create account, Log out, or ✕ to stay', async ({ page }) => {
  await go(page, '/profile');
  const open = async () => {
    await page.getByRole('button', { name: 'Log Out' }).click();
    const box = page.getByRole('dialog', { name: 'Log out as a guest?' });
    await expect(box).toContainText('open the invite link and enter your name again');
    return box;
  };

  let box = await open();
  await box.getByRole('button', { name: 'Stay as a guest' }).click();
  await expect(box).toBeHidden();
  await expect(page).toHaveURL(/\/profile/);

  box = await open();
  await box.getByRole('button', { name: 'Create account' }).click();
  await expect(box).toBeHidden();
  await expect(page.locator('#account-sheet-title')).toHaveText('Create your account');
  await page.getByRole('button', { name: 'Not now' }).last().click();

  box = await open();
  await box.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);
});

/** #782: the guest cards and pop-ups are centred: heading, words and buttons. */
test('the Create your account card, the guest log-out and the account pop-up are centred', async ({ page }) => {
  await go(page, '/profile');
  const centred = (sel: string, buttons: string) => page.locator(sel).first().evaluate((box, buttons) => {
    const b = box.getBoundingClientRect(), mid = b.left + b.width / 2;
    const row = box.querySelector(buttons)!.getBoundingClientRect();
    return { align: getComputedStyle(box.querySelector('h2')!).textAlign, off: Math.abs(row.left + row.width / 2 - mid) };
  }, buttons);

  let c = await centred('.guest-card', '.account-actions .btn');
  expect(c.align).toBe('center');
  expect(c.off).toBeLessThan(4);

  await page.getByRole('button', { name: 'Log Out' }).click();
  c = await centred('.guest-logout', '.modal-actions');
  expect(c.align).toBe('center');
  expect(c.off).toBeLessThan(4);
  await page.getByRole('dialog', { name: 'Log out as a guest?' }).getByRole('button', { name: 'Create account' }).click();

  c = await centred('.account-sheet', '.actions');
  expect(c.align).toBe('center');
  expect(c.off).toBeLessThan(4);
});
