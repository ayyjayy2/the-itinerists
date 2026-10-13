import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import * as admin from 'firebase-admin';

/**
 * #408: deleting an account removes everything the privacy policy promises.
 *
 * A throwaway staging account is given data in every place the app stores
 * things: a trip it is alone on (which must go entirely) and a trip it shares
 * with someone else (where its personal data must go and the shared items
 * stay). It then deletes itself through the real Profile screen, and the
 * Admin SDK lists anything left behind. Everything it made is removed after.
 */
const ROOT = join(__dirname, '..');
const key = JSON.parse(readFileSync(join(ROOT, 'scripts', 'serviceAccountKey.staging.json'), 'utf8'));
if (key.project_id !== 'the-itinerists-staging') throw new Error('not the staging project: ' + key.project_id);
const app = admin.apps.length ? admin.app() : admin.initializeApp({ credential: admin.credential.cert(key) });
const db = app.firestore();

const stamp = Date.now();
const NAME = `Deletion check ${stamp}`;
const OTHER = `Deletion other ${stamp}`;
const EMAIL = `deletion-check-${stamp}@example.com`;
const PASSWORD = 'Del-' + randomBytes(9).toString('base64url');
const SOLO = `deletion-solo-${stamp}`, SHARED = `deletion-shared-${stamp}`, CODE = `DL${String(stamp).slice(-6)}`;
let uid = '', otherUid = `deletion-other-${stamp}`;

/** Every sub-collection the app writes under a trip. */
const TRIP_SUBS = ['members', 'itinerary', 'finance', 'stays', 'recs', 'cars', 'pins', 'flights', 'outfits', 'dayLabels',
  'packing', 'packingSuggestions', 'invites', 'activityLog', 'events', 'removedMembers', 'outfitPhotos'];

async function leftovers(): Promise<string[]> {
  const left: string[] = [];
  const has = async (path: string) => { if ((await db.doc(path).get()).exists) left.push(path); };
  await admin.auth(app).getUser(uid).then(() => left.push('auth user'), () => {});
  for (const p of [`users/${uid}`, `users/${uid}/private/account`, `userTrips/${uid}`, `userExpenses/${uid}`,
    `_quotas/${uid}/kinds/photos`, `_quotas/${uid}/kinds/trips`, `inviteIndex/${CODE}`, `trips/${SOLO}`]) await has(p);
  for (const sub of TRIP_SUBS) {
    const n = (await db.collection(`trips/${SOLO}/${sub}`).get()).size;
    if (n) left.push(`trips/${SOLO}/${sub} (${n})`);
  }
  // The shared trip keeps its shared items but loses everything personal to the deleted account.
  for (const p of [`trips/${SHARED}/members/${uid}`, `trips/${SHARED}/dayLabels/${uid}`, `trips/${SHARED}/packing/${uid}`,
    `trips/${SHARED}/flights/mine`, `trips/${SHARED}/outfits/mine`, `trips/${SHARED}/packingSuggestions/mine`,
    `trips/${SHARED}/outfitPhotos/mine`]) await has(p);
  return left;
}

/** A document shaped like a real item, so every page can draw it. */
const ITEM = () => ({
  uid, user: NAME, from: NAME, to: NAME, addedBy: NAME, paidBy: NAME, forWho: 'All', splitAmong: 'All',
  title: 'check', name: 'check', activity: 'check', vendor: 'check', description: '', item: 'check', category: 'Other',
  notes: '', location: '', address: '', date: '2026-11-01', time: '', amount: 1, currency: 'EUR', kind: 'trip',
  lat: 38.72, lng: -9.14, createdAt: Date.now(), at: Date.now(), timestamp: Date.now(), audience: 'all', actorUid: 'check',
});

test.beforeAll(async () => {
  uid = (await admin.auth(app).createUser({ email: EMAIL, password: PASSWORD, displayName: NAME })).uid;
  const now = Date.now();
  const b = db.batch();
  b.set(db.doc(`users/${uid}`), { uid, displayName: NAME, name: NAME, email: EMAIL, avatarEmoji: '🧪', color: '#8BAF7C', createdAt: now, isTest: true });
  b.set(db.doc(`users/${uid}/private/account`), { email: EMAIL });
  b.set(db.doc(`userTrips/${uid}`), { tripIds: [SOLO, SHARED], lastActiveTrip: SOLO });
  b.set(db.doc(`userExpenses/${uid}`), { items: [{ id: 'e1', amount: 5 }] });
  b.set(db.doc(`_quotas/${uid}/kinds/photos`), { count: 1, windowStart: admin.firestore.Timestamp.fromMillis(now - 2 * 86_400_000), at: admin.firestore.Timestamp.fromMillis(now - 2 * 86_400_000) });   // a past window: deletable
  b.set(db.doc(`_quotas/${uid}/kinds/trips`), { count: 1, windowStart: admin.firestore.Timestamp.fromMillis(now - 2 * 86_400_000), at: admin.firestore.Timestamp.fromMillis(now - 2 * 86_400_000) });   // a past window: deletable
  const trip = (id: string, owner: string) => ({ id, name: `Deletion check ${id}`, destination: 'Lisbon, Portugal', startDate: '2026-11-01', endDate: '2026-11-05', currency: 'EUR', createdBy: owner, memberCount: id === SOLO ? 1 : 2, isTest: true });
  const member = (u: string, name: string, role: string) => ({ uid: u, displayName: name, role, joinedAt: now, color: '#8BAF7C', avatarEmoji: '🧪' });
  // A trip the account is alone on: one document in every sub-collection.
  b.set(db.doc(`trips/${SOLO}`), trip(SOLO, uid));
  b.set(db.doc(`trips/${SOLO}/members/${uid}`), member(uid, NAME, 'owner'));
  for (const sub of TRIP_SUBS.filter(s => !['members', 'packing', 'dayLabels', 'outfitPhotos', 'invites'].includes(s)))
    b.set(db.doc(`trips/${SOLO}/${sub}/x`), ITEM());
  b.set(db.doc(`trips/${SOLO}/packing/${uid}`), { items: [] });
  b.set(db.doc(`trips/${SOLO}/dayLabels/${uid}`), { labels: {} });
  b.set(db.doc(`trips/${SOLO}/outfitPhotos/x`), { ownerUid: uid, date: '2026-11-01', dataUrl: 'data:image/jpeg;base64,AA==' });
  b.set(db.doc(`trips/${SOLO}/invites/${CODE}`), { code: CODE, tripId: SOLO, createdBy: uid, expiresAt: now + 86_400_000, usedBy: [] });
  b.set(db.doc(`inviteIndex/${CODE}`), { tripId: SOLO, expiresAt: now + 86_400_000 });
  // A trip shared with someone else: personal data must go, shared items stay.
  b.set(db.doc(`trips/${SHARED}`), trip(SHARED, otherUid));
  b.set(db.doc(`trips/${SHARED}/members/${otherUid}`), member(otherUid, OTHER, 'owner'));
  b.set(db.doc(`trips/${SHARED}/members/${uid}`), member(uid, NAME, 'member'));
  b.set(db.doc(`trips/${SHARED}/flights/mine`), { uid, flightNumber: 'TP1' });
  b.set(db.doc(`trips/${SHARED}/outfits/mine`), { user: NAME, date: '2026-11-01' });
  b.set(db.doc(`trips/${SHARED}/packingSuggestions/mine`), { from: NAME, to: OTHER, item: 'Umbrella' });
  b.set(db.doc(`trips/${SHARED}/outfitPhotos/mine`), { ownerUid: uid, date: '2026-11-01', dataUrl: 'data:image/jpeg;base64,AA==' });
  b.set(db.doc(`trips/${SHARED}/dayLabels/${uid}`), { labels: {} });
  b.set(db.doc(`trips/${SHARED}/packing/${uid}`), { items: [] });
  b.set(db.doc(`trips/${SHARED}/itinerary/shared`), { title: 'Dinner for everyone', date: '2026-11-02' });
  await b.commit();
});

test.afterAll(async () => {
  await admin.auth(app).deleteUser(uid).catch(() => {});
  for (const t of [SOLO, SHARED]) {
    for (const sub of TRIP_SUBS) for (const d of (await db.collection(`trips/${t}/${sub}`).get()).docs) await d.ref.delete();
    await db.doc(`trips/${t}`).delete().catch(() => {});
  }
  for (const p of [`users/${uid}/private/account`, `users/${uid}`, `userTrips/${uid}`, `userExpenses/${uid}`,
    `_quotas/${uid}/kinds/photos`, `_quotas/${uid}/kinds/trips`, `inviteIndex/${CODE}`, `_deletions/${uid}`]) await db.doc(p).delete().catch(() => {});
});

test.use({ storageState: { cookies: [], origins: [] } });

test('deleting an account through Profile leaves nothing of it behind (#408)', async ({ page }) => {
  expect((await leftovers()).length, 'the setup wrote data to check').toBeGreaterThan(10);

  page.on('console', m => { if (m.type() === 'error' && !/recaptcha|requestStorageAccess|Content Security|403/.test(m.text())) console.log('[browser]', m.text().slice(0, 300)); });
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(EMAIL);
  await page.getByPlaceholder('Enter your password').fill(PASSWORD);
  await page.locator('form button[type=submit]').click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });

  await page.goto('/profile');
  await page.getByRole('button', { name: 'Delete Account' }).click();
  await page.getByPlaceholder('Enter current password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Delete account', exact: true }).click();
  await expect(page).toHaveURL(/\/(login|welcome)/, { timeout: 60_000 });

  expect(await leftovers()).toEqual([]);
  // The shared trip and its shared items are still there for the other member.
  expect((await db.doc(`trips/${SHARED}/members/${otherUid}`).get()).exists).toBe(true);
  expect((await db.doc(`trips/${SHARED}/itinerary/shared`).get()).exists).toBe(true);
  // Pulse's deletion record (#452): counts, dates and the test flag; nothing that names the person.
  const record = (await db.doc(`_deletions/${uid}`).get()).data();
  expect(record).toBeTruthy();
  expect(Object.keys(record!).sort()).toEqual(['accountCreatedAt', 'at', 'lastTripEnd', 'test', 'trips', 'uid']);
  expect(record).toMatchObject({ uid, trips: 2, lastTripEnd: '2026-11-05', test: true });
});
