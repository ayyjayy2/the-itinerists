import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as admin from 'firebase-admin';
import { signIn, signOut } from './helpers';

/**
 * #406: one person logs out and another signs in on the same browser. The
 * second person must never see the first person's trips, not even for a
 * moment while the app loads. (The device keeps its offline copy on purpose,
 * so the same person signing back in stays fast.)
 *
 * Maya has trips; Sam is on none. Their trip names are read with the Admin SDK.
 */
const ROOT = join(__dirname, '..');
const accounts = JSON.parse(readFileSync(join(ROOT, 'scripts', 'staging-accounts.local.json'), 'utf8'));
const key = JSON.parse(readFileSync(join(ROOT, 'scripts', 'serviceAccountKey.staging.json'), 'utf8'));
if (key.project_id !== 'the-itinerists-staging') throw new Error('not the staging project: ' + key.project_id);
const adminApp = admin.apps.length ? admin.app() : admin.initializeApp({ credential: admin.credential.cert(key) });

async function tripWords(uid: string): Promise<string[]> {
  const db = adminApp.firestore();
  const ids: string[] = (await db.doc(`userTrips/${uid}`).get()).data()?.['tripIds'] ?? [];
  const trips = await Promise.all(ids.map(id => db.doc(`trips/${id}`).get()));
  const words = trips.flatMap(t => [t.data()?.['name'], String(t.data()?.['destination'] ?? '').split(',')[0]]);
  return [...new Set(words.map(w => String(w ?? '').trim()).filter(w => w.length >= 4))];
}

test.use({ storageState: { cookies: [], origins: [] } });

test("after Maya logs out, Sam signing in on the same browser never sees Maya's trips", async ({ page }) => {
  const mayaTrips = await tripWords(accounts.maya.uid);
  expect(mayaTrips.length, "Maya's trips").toBeGreaterThan(0);
  expect((await adminApp.firestore().doc(`userTrips/${accounts.sam.uid}`).get()).data()?.['tripIds'] ?? [], 'Sam is on no trip').toEqual([]);

  // Record every bit of text that appears on screen, frame by frame, on every page load.
  await page.addInitScript(() => {
    const seen = ((window as any).__seen = [] as string[]);
    new MutationObserver(() => seen.push(document.body?.innerText ?? '')).observe(document, { subtree: true, childList: true, characterData: true });
  });
  const seenSoFar = async () => (await page.evaluate(() => (window as any).__seen.join('\n'))) + '\n' + await page.locator('body').innerText();
  const mentionsMaya = (text: string) => mayaTrips.filter(w => text.includes(w));

  // Maya uses the app: Home and Finance load her open trip into the offline copy.
  // Control: the recorder must catch her trip here, or the check below proves nothing.
  await signIn(page, 'maya');
  await page.goto('/finance');
  await page.goto('/home');
  await page.waitForTimeout(2_500);
  expect(mentionsMaya(await seenSoFar()).length, 'the recorder catches Maya\'s trip while she is signed in').toBeGreaterThan(0);
  await signOut(page);

  await signIn(page, 'sam');
  await page.waitForTimeout(2_500);
  const atSignIn = await seenSoFar();                                  // the landing after signing in, before any other page
  expect(atSignIn.length, 'the recorder saw the screen').toBeGreaterThan(50);
  expect(mentionsMaya(atSignIn), "Maya's trips right after Sam signed in").toEqual([]);

  for (const path of ['/home', '/itinerary', '/finance', '/my-expenses', '/my-trips']) {
    await page.goto(path);
    await page.waitForTimeout(2_500);
    const seen = await seenSoFar();
    expect(mentionsMaya(seen), `Maya's trips on ${path}`).toEqual([]);
  }
  await expect(page.getByText(/set up a trip/i).first()).toBeVisible();   // Sam gets the no-trip state

  await signOut(page);
});
