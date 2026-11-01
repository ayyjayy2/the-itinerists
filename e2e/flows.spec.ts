import { test, expect, Page } from '@playwright/test';

/**
 * The flows a beta tester will hit, on the DEMO build: Firebase is replaced by
 * in-memory stand-ins, the app starts signed in as a seeded traveller on the
 * Chiang Mai trip, and nothing touches the network. Each test gets a fresh
 * tab, so nothing from a previous test is left behind.
 *
 * Selectors use what a person sees (placeholders, button text, aria labels):
 * the form labels are not wired to their inputs, so getByLabel would not work.
 */

const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

async function signOut(page: Page) {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Log Out' }).click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page).toHaveURL(/\/login/);
}

test('home shows the active trip and the bottom bar', async ({ page }) => {
  await page.goto('/home');
  await expect(page.getByText(/ready for chiang mai/i)).toBeVisible();
  for (const tab of ['Home', 'Itinerary', 'Finance', 'Packing', 'More']) {
    await expect(page.getByRole('navigation').getByText(tab, { exact: true })).toBeVisible();
  }
});

test('log out, then sign up with a name, email and password (no username)', async ({ page }) => {
  await signOut(page);
  await page.goto('/signup');
  await expect(page.getByPlaceholder(/3–20 letters/)).toHaveCount(0);
  await page.getByPlaceholder('e.g. Maya').fill('Test Person');
  await page.getByPlaceholder('you@example.com').fill('test@example.com');
  await page.getByPlaceholder('At least 8 characters').fill('Sunshine2026');
  await page.getByPlaceholder('Re-enter password').fill('Sunshine2026');
  await page.locator('form button[type=submit]').click();
  await expect(page).toHaveURL(/get-started|home/);
});

test('sign-up links to the terms and the privacy policy, and each links to the other', async ({ page }) => {
  await signOut(page);
  await page.goto('/signup');
  await page.getByRole('link', { name: 'terms of service' }).click();
  await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();
  await page.getByRole('link', { name: 'Privacy policy', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
  await page.getByRole('link', { name: 'Terms of service', exact: true }).click();
  await expect(page).toHaveURL(/\/terms/);
});

test('create a trip and land on Home with it active', async ({ page }) => {
  await page.goto('/trips/new');
  await page.getByPlaceholder('e.g. Bali Girls Trip 2026').fill('Lisbon Long Weekend');
  await page.getByPlaceholder('e.g. Bali, Indonesia').fill('Lisbon, Portugal');
  const dates = page.locator('input[type=date]');
  await dates.nth(0).fill(plusDays(30));
  await dates.nth(1).fill(plusDays(34));
  await page.getByRole('button', { name: 'Create Trip' }).click();
  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByText(/ready for lisbon/i)).toBeVisible();   // the banner names the destination
});

test('add an expense and see it in the log', async ({ page }) => {
  await page.goto('/finance');
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByPlaceholder('e.g. The Grey').fill('Night market');
  await page.getByPlaceholder('0.00').first().fill('120');
  await page.getByRole('button', { name: 'Add Expense' }).click();
  await expect(page.getByText('Night market').first()).toBeVisible();
});

test('each balance shows its working, and a tap folds it away (#519)', async ({ page }) => {
  await page.goto('/finance');
  const maya = page.locator('.banner-positive .banner-person').filter({ hasText: 'Maya' });
  const jo = page.locator('.banner-positive .banner-person').filter({ hasText: 'Jo' });
  await expect(maya.locator('.banner-person-amounts')).toHaveText('3,840.00');
  // Open from the start, so the total's maths is in sight (survey feedback).
  await expect(maya.locator('.net-working')).toHaveText('(they owe ฿4,000 − you owe ฿160)');
  await expect(jo.locator('.net-working')).toHaveText('(they owe ฿4,000 − you owe ฿1,600)');
  await expect(maya).toHaveAttribute('aria-expanded', 'true');

  const name = maya.locator('.banner-person-name');
  const openTop = (await name.boundingBox())!.y;
  await maya.click();
  await expect(maya.locator('.net-working')).toHaveCount(0);
  await expect(jo.locator('.net-working')).toHaveCount(1);              // only that row folds
  // Folding and opening happen below the row: the name and total stay put.
  expect(Math.abs((await name.boundingBox())!.y - openTop)).toBeLessThan(1);
  await maya.click();
  await expect(maya.locator('.net-working')).toHaveText('(they owe ฿4,000 − you owe ฿160)');

  // The group summary shows totals only, opened or not.
  await page.getByRole('button', { name: /Group Summary/ }).click();
  await page.locator('.gs-row').filter({ hasText: 'Maya' }).click();
  await expect(page.locator('.group-summary .net-working')).toHaveCount(0);
});

test('add an itinerary event', async ({ page }) => {
  await page.goto('/itinerary');
  await page.getByRole('button', { name: '+ Add event' }).first().click();
  await page.getByPlaceholder("What's happening?").fill('Morning temple walk');
  await page.getByRole('button', { name: 'Add Event', exact: true }).click();
  await expect(page.getByText('Morning temple walk')).toBeVisible();
});

test('generate an invite code and link from Admin', async ({ page }) => {
  await page.goto('/admin');
  await page.getByRole('button', { name: /generate a new invite|generate invite/i }).click();
  await expect(page.getByText(/^[A-Z0-9]{8}$/)).toBeVisible();                 // the code itself
  await expect(page.getByText(/\/join\?code=[A-Z0-9]{8}/)).toBeVisible();   // and the link
});

/** #610: an invite link opens the trip without an account; changing something asks for one. */
test('join from an invite link as a guest, then create an account to add something', async ({ page }) => {
  // The demo trip has a standing invite, DEMOJOIN.
  await signOut(page);
  await page.goto('/join?code=DEMOJOIN');
  await expect(page.getByRole('heading', { name: "You're invited" })).toBeVisible();
  await page.getByRole('button', { name: 'See the trip' }).click();
  await expect(page.getByText('Enter your name so the group knows who you are.')).toBeVisible();
  await page.getByLabel('What should the group call you?').fill('Robin');
  await page.getByRole('button', { name: 'See the trip' }).click();
  await expect(page).toHaveURL(/\/home/);

  // Reading works; adding asks for an account first.
  await page.getByRole('navigation').getByText('Itinerary', { exact: true }).first().click();
  await page.getByRole('button', { name: '+ Add event' }).first().click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.getByPlaceholder("What's happening?")).toHaveCount(0);
  await page.getByLabel('Email').fill('robin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('Sunshine2026');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: "You're all set" })).toBeVisible();
  await page.getByRole('button', { name: 'Back to the trip' }).click();

  // Now the same button opens the form.
  await page.getByRole('button', { name: '+ Add event' }).first().click();
  await expect(page.getByPlaceholder("What's happening?")).toBeVisible();
});
