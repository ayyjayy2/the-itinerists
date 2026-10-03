import { test, expect } from '@playwright/test';
import {
  addItineraryEvent, apiKey, itineraryCard, password, secondPerson, signIn, signOut, stamp, watchErrors,
} from './helpers';

/**
 * The after-deploy checklist, automated, against the real staging site.
 * Signed in as the seeded test accounts (alayna owns the Chiang Mai trip; maya
 * is on it). Everything a test adds is tagged "[check]" and removed again, by
 * the test itself or by cleanup.ts afterwards.
 */

const PAGES = ['home', 'itinerary', 'flights', 'accommodations', 'transportation', 'map', 'finance',
  'expenses', 'recs', 'packing', 'outfits', 'updates', 'trips', 'trip-settings', 'profile'];

test.describe('1. Sign-in', () => {
  test.use({ storageState: { cookies: [], origins: [] } });   // this one starts signed out
  // The email box takes a recovery email; the seeded accounts have none, so they sign in by username.
  test('sign in, stay signed in across a reload, sign out, and a readable wrong-password message', async ({ page }) => {
    await signIn(page, 'alayna');
    await page.reload();
    await expect(page).not.toHaveURL(/\/login/);              // reload keeps the session
    await signOut(page);

    await page.getByPlaceholder('Username or recovery email').fill('alayna');
    await page.getByPlaceholder('Enter your password').fill('Not-the-password-1');
    await page.locator('form button[type=submit]').click();
    await expect(page.getByText('Invalid username, email, or password.')).toBeVisible();   // a sentence, not a Firebase code
    await expect(page.getByText(/auth\//)).toHaveCount(0);
  });

  test('Profile shows the version line', async ({ browser, baseURL }) => {
    const { ctx, page } = await secondPerson(browser, 'alayna', baseURL!);
    await page.goto('/profile');
    await expect(page.getByText(/Version \d+\.\d+\.\d+ \(\d+\)/)).toBeVisible();
    await ctx.close();
  });
});

test.describe('2. Live updates between two people', () => {
  test('an item Maya adds, Alayna edits and deletes shows up live for both', async ({ page, browser, baseURL }) => {
    const title = `${stamp()} night market`;
    await page.goto('/home');
    await page.goto('/itinerary');

    const maya = await secondPerson(browser, 'maya', baseURL!);
    try {
      await addItineraryEvent(maya.page, title);
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });   // no reload

      await page.goto('/updates');                                                    // the bell's feed
      await expect(page.getByText(title).first()).toBeVisible();

      await page.goto('/itinerary');
      await itineraryCard(page, title).locator('.edit-btn').click();
      const card = page.locator('.itinerary-item').filter({ has: page.locator('.edit-actions') });   // the open edit form
      const fields = card.locator('input[type=text]');
      const values = await fields.evaluateAll(els => els.map(e => (e as HTMLInputElement).value));
      await fields.nth(values.indexOf(title)).fill(`${title} (moved)`);   // the activity field
      await card.getByRole('button', { name: 'Save' }).click();
      await expect(maya.page.getByText(`${title} (moved)`).first()).toBeVisible({ timeout: 20_000 });

      await itineraryCard(page, `${title} (moved)`).locator('.edit-btn').click();
      await page.locator('.itinerary-item .edit-actions').getByRole('button', { name: 'Delete' }).click();
      await expect(maya.page.getByText(`${title} (moved)`)).toHaveCount(0, { timeout: 20_000 });
    } finally {
      await maya.ctx.close();
    }
  });
});

test.describe('3. Every page', () => {
  test('loads without errors, finishes loading, and never scrolls sideways', async ({ page }) => {
    test.setTimeout(240_000);                               // 15 pages, a few seconds each
    const errors = watchErrors(page, [/apis\.google\.com\/js\/api\.js/]);   // known: issue #344
    await page.goto('/home');
    const problems: string[] = [];
    for (const p of PAGES) {
      const before = errors.length;
      await page.goto(`/${p}`);
      await page.waitForTimeout(2_500);
      if (await page.locator('app-loading .spinner').count()) problems.push(`${p}: still loading`);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (wide > 1) problems.push(`${p}: scrolls sideways by ${wide}px`);
      if (errors.length > before) problems.push(`${p}: ${errors.slice(before).join(' | ').slice(0, 200)}`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('Map draws its tiles when reached from another page', async ({ page }) => {
    test.fixme(true, 'Known bug #343: Map can stay on "Loading data…". Remove this line once it is fixed.');
    await page.goto('/home');
    await page.getByRole('navigation').getByRole('button', { name: 'More' }).click();
    await page.getByRole('link', { name: /^Map$|Trip Map/ }).first().click();
    await expect(page.locator('img.leaflet-tile-loaded').first()).toBeVisible({ timeout: 30_000 });
  });

  test('Map draws its tiles when opened directly (refresh or link)', async ({ page }) => {
    test.fixme(true, 'Known bug #343: Map can stay on "Loading data…". Remove this line once it is fixed.');
    await page.goto('/home');
    await page.goto('/map');
    await expect(page.locator('img.leaflet-tile-loaded').first()).toBeVisible({ timeout: 30_000 });
  });

  test('Finance: add a THB expense, see it, delete it', async ({ page }) => {
    const title = `${stamp()} songthaew`;
    await page.goto('/home');
    await page.goto('/finance');
    await page.getByRole('button', { name: '+ Add' }).click();
    await page.getByPlaceholder('e.g. The Grey').fill(title);
    await page.getByPlaceholder('0.00').first().fill('123');
    await page.getByRole('button', { name: 'Add Expense' }).click();
    await expect(page.getByText(title).first()).toBeVisible();

    const toggle = page.locator('.expenses-toggle');
    if (await toggle.count() && !(await page.locator('.table-row').filter({ hasText: title }).count())) await toggle.click();
    const row = page.locator('.table-row').filter({ hasText: title }).first();
    await row.locator('.edit-row-btn').click();
    page.once('dialog', d => d.accept());                     // "Delete …?" confirm
    await page.getByRole('button', { name: /Delete/ }).first().click();
    await expect(page.getByText(title)).toHaveCount(0);
  });
});

test.describe('4. Joining a trip', () => {
  test('the owner makes an invite, and its link opens the join page', async ({ page, browser, baseURL }) => {
    await page.goto('/home');
    await page.goto('/trip-settings');
    // Always make a fresh invite: the panel can first show an older one from the offline copy.
    const panel = page.locator('.invite-code');
    await page.waitForTimeout(1_500);
    const old = (await panel.count()) ? (await panel.innerText()).trim() : '';
    await page.getByRole('button', { name: /^\s*Invite\s*$/ }).first().click();
    await expect(panel).toHaveText(/^[A-Z0-9]{8}$/);
    await expect(panel).not.toHaveText(old || '-');
    const href = `/join?code=${(await panel.innerText()).trim()}`;

    const stranger = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });   // signed out
    try {
      const p = await stranger.newPage();
      await p.goto(href);
      // Signed out, the link lands on sign-up with the invite code filled in.
      await expect(p).toHaveURL(new RegExp(`/(join|signup)\\?code=${href.split('=')[1]}`));
      await expect(p.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    } finally {
      await stranger.close();
    }
  });
});

test.describe('5. Offline', () => {
  test('opened pages keep working offline, and an offline edit syncs when back online', async ({ page, context, browser, baseURL }) => {
    const title = `${stamp()} offline`;
    await page.goto('/home');
    await page.goto('/itinerary');
    await expect(page.locator('.itinerary-item').first()).toBeVisible();   // the trip has loaded

    await context.setOffline(true);
    const tab = (name: string) => page.getByRole('navigation').getByRole('link', { name });
    await tab('Finance').click();                                          // in-app, no reload
    await expect(page.getByRole('heading', { name: 'Finance' })).toBeVisible();
    await expect(page.getByText(/owed/i).first()).toBeVisible();           // trip data, not the no-trip screen
    await tab('Itinerary').click();
    await page.getByRole('button', { name: '+ Add event' }).first().click();
    await page.getByPlaceholder("What's happening?").fill(title);
    await page.getByRole('button', { name: 'Add Event', exact: true }).click();
    await expect(page.getByText(title).first()).toBeVisible();                          // saved on the device
    await context.setOffline(false);

    const maya = await secondPerson(browser, 'maya', baseURL!);
    try {
      await maya.page.goto('/itinerary');
      await expect(maya.page.getByText(title).first()).toBeVisible({ timeout: 30_000 });   // synced
    } finally {
      await maya.ctx.close();
    }
    // cleanup.ts removes the tagged item.
  });
});

test.describe('6. Caching', () => {
  test('a second visit loads the app code from the browser cache', async ({ page: first, context }) => {
    await first.goto('/login');
    await first.waitForTimeout(3_000);                       // let every page's code preload
    await first.close();
    const page = await context.newPage();                    // coming back later, in a new tab
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    const seen: Record<string, boolean> = {};
    cdp.on('Network.responseReceived', e => {
      const path = new URL(e.response.url).pathname;
      if (/^\/(main|chunk|polyfills|styles)-[A-Z0-9]+\.(js|css)$/.test(path)) seen[path] = !!(e.response.fromDiskCache || (e.response as { fromMemoryCache?: boolean }).fromMemoryCache);
    });
    await page.goto('/login');
    await page.waitForTimeout(3_000);
    const files = Object.keys(seen);
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter(f => !seen[f]), 'files fetched again instead of cached').toEqual([]);
  });
});

test.describe('7. API console', () => {
  test('opens for the approved account and answers a time zone code', async ({ page }) => {
    await page.goto('/api-console/index.html');
    await page.locator('#user').fill('alayna');
    await page.locator('#pass').fill(password('alayna'));
    await page.locator('#signInBtn').click();
    await expect(page.locator('#swagger .opblock-tag').first()).toBeVisible({ timeout: 30_000 });
    const est = await page.evaluate(() => fetch('/api-console/zone-codes/est.json').then(r => r.json()));
    expect(est.code).toBe('EST');
    expect(est.zones.map((z: { zone: string }) => z.zone)).toContain('America/New_York');
  });

  test('outside lookups answer (airport by city, time zone of a city)', async ({ request }) => {
    const airports = await request.get('https://nominatim.openstreetmap.org/search?q=Port%20Moresby%20airport&namedetails=1&format=json&limit=5', { headers: { 'User-Agent': 'TheItinerists-staging-check/1.0' } });
    expect((await airports.json()).some((r: { namedetails?: { iata?: string } }) => r.namedetails?.iata === 'POM')).toBe(true);
    const city = await request.get('https://geocoding-api.open-meteo.com/v1/search?name=Port%20Moresby&count=1');
    expect((await city.json()).results[0].timezone).toBe('Pacific/Port_Moresby');
  });
});

test.describe('8. Phone layout', () => {
  test('form fields are at least 16px, so iPhones never zoom in', async ({ page }) => {
    await page.goto('/home');
    await page.goto('/itinerary');
    await page.getByRole('button', { name: '+ Add event' }).first().click();
    const small = await page.evaluate(() => [...document.querySelectorAll('input, select, textarea')]
      .filter(el => (el as HTMLElement).offsetParent !== null)
      .map(el => parseFloat(getComputedStyle(el).fontSize))
      .filter(px => px < 16));
    expect(small).toEqual([]);
  });
});

// Keeps apiKey() exercised so a missing staging environment fails loudly here, not only in cleanup.
test('staging environment is readable', () => { expect(apiKey()).toMatch(/^AIza/); });
