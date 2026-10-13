import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, Firestore, doc, collection, getDocFromServer, getDocsFromServer,
  setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import * as admin from 'firebase-admin';

/**
 * #403 — authorization against the REAL staging project, with two real
 * signed-in accounts and the real Firebase client (staging has no App Check,
 * so these are exactly the requests a modified client could send).
 *
 *   Maya  owns a finished test trip (test-lisbon-past) and is a member of the demo trip.
 *   Sam   is on no trip: the outsider.
 *
 * Test data is added with the Admin SDK, tagged, and removed afterwards.
 * Run: npx playwright test -c playwright.staging.config.ts --project authorization
 */

const ROOT = join(__dirname, '..');
const accounts = JSON.parse(readFileSync(join(ROOT, 'scripts', 'staging-accounts.local.json'), 'utf8'));
const key = JSON.parse(readFileSync(join(ROOT, 'scripts', 'serviceAccountKey.staging.json'), 'utf8'));
if (key.project_id !== 'the-itinerists-staging') throw new Error('not the staging project: ' + key.project_id);

const env = readFileSync(join(ROOT, 'src', 'environments', 'environment.staging.ts'), 'utf8');
const pick = (k: string) => env.match(new RegExp(`${k}:\\s*'([^']*)'`))![1];
const firebaseConfig = {
  apiKey: pick('apiKey'), authDomain: pick('authDomain'), projectId: pick('projectId'),
  storageBucket: pick('storageBucket'), messagingSenderId: pick('messagingSenderId'), appId: pick('appId'),
};

const adminApp = admin.apps.length ? admin.app() : admin.initializeApp({ credential: admin.credential.cert(key) });
const adb = adminApp.firestore();

const LISBON = 'test-lisbon-past';   // Maya's own trip
const DEMO   = 'demo-chiang-mai';    // Maya, Theo, Jo and the demo owner
const TAG    = 'authz-check';

const maya = accounts.maya, sam = accounts.sam, theo = accounts.theo, jo = accounts.jo;

async function signIn(who: { uid: string; password: string }, name: string): Promise<{ app: FirebaseApp; db: Firestore }> {
  const email = (await adminApp.auth().getUser(who.uid)).email!;
  const app = initializeApp(firebaseConfig, `${name}-${Date.now()}`);
  await signInWithEmailAndPassword(getAuth(app), email, who.password);
  return { app, db: getFirestore(app) };
}

/** 'allowed' or 'denied' (permission-denied); anything else is a test error. */
async function attempt(fn: () => Promise<unknown>): Promise<'allowed' | 'denied'> {
  try { await fn(); return 'allowed'; }
  catch (e: any) { if (e?.code === 'permission-denied') return 'denied'; throw e; }
}

const results: { who: string; action: string; expected: string; got: string }[] = [];
async function check(who: string, action: string, expected: 'allowed' | 'denied', fn: () => Promise<unknown>) {
  const got = await attempt(fn);
  results.push({ who, action, expected, got });
  expect.soft(got, `${who}: ${action}`).toBe(expected);
}

// Child collections under a trip, and a harmless doc for each.
const CHILDREN = ['itinerary', 'finance', 'stays', 'recs', 'cars', 'pins', 'flights', 'outfits', 'dayLabels', 'packingSuggestions', 'activityLog', 'removedMembers', 'events'];

test.describe.configure({ mode: 'serial' });

let M: { app: FirebaseApp; db: Firestore };
let S: { app: FirebaseApp; db: Firestore };

test.beforeAll(async () => {
  // Fixtures: one doc in every child collection of Maya's trip, a private
  // packing list and outfit photo for Maya there, and for Theo on the demo trip.
  const batch = adb.batch();
  for (const sub of CHILDREN) batch.set(adb.doc(`trips/${LISBON}/${sub}/${TAG}`), { tag: TAG, note: 'authorization check' });
  batch.set(adb.doc(`trips/${LISBON}/packing/${maya.uid}`), { items: [{ label: 'Passport', packed: false }], tag: TAG });
  batch.set(adb.doc(`trips/${LISBON}/outfitPhotos/${TAG}`), { ownerUid: maya.uid, date: '2026-10-02', dataUrl: 'data:image/jpeg;base64,AA==' });
  batch.set(adb.doc(`trips/${LISBON}/invites/AUTHZ1`), { tripId: LISBON, usedBy: [], expiresAt: Date.now() + 3_600_000 });
  batch.set(adb.doc(`trips/${DEMO}/packing/${theo.uid}`), { items: [{ label: 'Theo’s private list', packed: false }], tag: TAG });
  batch.set(adb.doc(`trips/${DEMO}/outfitPhotos/${TAG}`), { ownerUid: theo.uid, date: '2026-11-13', dataUrl: 'data:image/jpeg;base64,AA==' });
  await batch.commit();
  M = await signIn(maya, 'maya');
  S = await signIn(sam, 'sam');
});

test.afterAll(async () => {
  const batch = adb.batch();
  for (const sub of CHILDREN) batch.delete(adb.doc(`trips/${LISBON}/${sub}/${TAG}`));
  batch.delete(adb.doc(`trips/${LISBON}/packing/${maya.uid}`));
  batch.delete(adb.doc(`trips/${LISBON}/outfitPhotos/${TAG}`));
  batch.delete(adb.doc(`trips/${LISBON}/invites/AUTHZ1`));
  batch.delete(adb.doc(`trips/${DEMO}/packing/${theo.uid}`));
  batch.delete(adb.doc(`trips/${DEMO}/outfitPhotos/${TAG}`));
  batch.delete(adb.doc(`trips/${LISBON}/members/${sam.uid}`));
  await batch.commit();
  // Undo anything a wrongly allowed write might have changed.
  await adb.doc(`trips/${LISBON}`).update({ createdBy: maya.uid, name: 'Lisbon (test, finished)' }).catch(() => {});
  await adb.doc(`userTrips/${sam.uid}`).set({ tripIds: admin.firestore.FieldValue.arrayRemove(LISBON) }, { merge: true });
  if (M) await deleteApp(M.app);
  if (S) await deleteApp(S.app);
  console.table(results);
});

test('the owner reaches her own trip (sanity)', async () => {
  await check('Maya (owner)', 'read her trip', 'allowed', () => getDocFromServer(doc(M.db, `trips/${LISBON}`)));
  await check('Maya (owner)', 'read her itinerary', 'allowed', () => getDocsFromServer(collection(M.db, `trips/${LISBON}/itinerary`)));
  await check('Maya (owner)', 'read her own packing list', 'allowed', () => getDocFromServer(doc(M.db, `trips/${LISBON}/packing/${maya.uid}`)));
});

test('an outsider can read nothing of a trip they are not on, even knowing the ids', async () => {
  await check('Sam (outsider)', 'read the trip', 'denied', () => getDocFromServer(doc(S.db, `trips/${LISBON}`)));
  await check('Sam (outsider)', 'list members', 'denied', () => getDocsFromServer(collection(S.db, `trips/${LISBON}/members`)));
  await check('Sam (outsider)', 'list invites', 'denied', () => getDocsFromServer(collection(S.db, `trips/${LISBON}/invites`)));
  for (const sub of CHILDREN) {
    await check('Sam (outsider)', `read ${sub} by id`, 'denied', () => getDocFromServer(doc(S.db, `trips/${LISBON}/${sub}/${TAG}`)));
    await check('Sam (outsider)', `list ${sub}`, 'denied', () => getDocsFromServer(collection(S.db, `trips/${LISBON}/${sub}`)));
  }
  await check('Sam (outsider)', 'read the owner’s packing list', 'denied', () => getDocFromServer(doc(S.db, `trips/${LISBON}/packing/${maya.uid}`)));
  await check('Sam (outsider)', 'read the owner’s outfit photo', 'denied', () => getDocFromServer(doc(S.db, `trips/${LISBON}/outfitPhotos/${TAG}`)));
});

test('an outsider can change nothing, and can’t join without a real invite', async () => {
  await check('Sam (outsider)', 'rename the trip', 'denied', () => updateDoc(doc(S.db, `trips/${LISBON}`), { name: 'hijacked' }));
  await check('Sam (outsider)', 'take ownership (createdBy)', 'denied', () => updateDoc(doc(S.db, `trips/${LISBON}`), { createdBy: sam.uid }));
  await check('Sam (outsider)', 'delete the trip', 'denied', () => deleteDoc(doc(S.db, `trips/${LISBON}`)));
  for (const sub of CHILDREN) {
    await check('Sam (outsider)', `write ${sub}`, 'denied', () => setDoc(doc(S.db, `trips/${LISBON}/${sub}/${TAG}-sam`), { x: 1 }));
  }
  await check('Sam (outsider)', 'join as member, no invite', 'denied', () => setDoc(doc(S.db, `trips/${LISBON}/members/${sam.uid}`), { uid: sam.uid, role: 'member' }));
  await check('Sam (outsider)', 'join with a made-up code', 'denied', () => setDoc(doc(S.db, `trips/${LISBON}/members/${sam.uid}`), { uid: sam.uid, role: 'member', inviteCode: 'GUESS1' }));
  await check('Sam (outsider)', 'join as owner', 'denied', () => setDoc(doc(S.db, `trips/${LISBON}/members/${sam.uid}`), { uid: sam.uid, role: 'owner' }));
  await check('Sam (outsider)', 'join as owner with a real invite', 'denied', () => setDoc(doc(S.db, `trips/${LISBON}/members/${sam.uid}`), { uid: sam.uid, role: 'owner', inviteCode: 'AUTHZ1' }));
  await check('Sam (outsider)', 'mint an invite', 'denied', () => setDoc(doc(S.db, `trips/${LISBON}/invites/SAM001`), { tripId: LISBON, usedBy: [], expiresAt: Date.now() + 1e9 }));
  await check('Sam (outsider)', 'extend a real invite', 'denied', () => updateDoc(doc(S.db, `trips/${LISBON}/invites/AUTHZ1`), { expiresAt: Date.now() + 1e10 }));
});

test('an outsider can’t reach another person’s account data', async () => {
  await check('Sam (outsider)', 'read Maya’s profile', 'denied', () => getDocFromServer(doc(S.db, `users/${maya.uid}`)));
  await check('Sam (outsider)', 'read Maya’s private account (email)', 'denied', () => getDocFromServer(doc(S.db, `users/${maya.uid}/private/account`)));
  await check('Sam (outsider)', 'read Maya’s trip list', 'denied', () => getDocFromServer(doc(S.db, `userTrips/${maya.uid}`)));
  await check('Sam (outsider)', 'add a trip to Maya’s list', 'denied', () => setDoc(doc(S.db, `userTrips/${maya.uid}`), { tripIds: ['x'] }, { merge: true }));
  await check('Sam (outsider)', 'read Maya’s My Expenses', 'denied', () => getDocFromServer(doc(S.db, `userExpenses/${maya.uid}`)));
  await check('Sam (outsider)', 'list all users', 'denied', () => getDocsFromServer(collection(S.db, 'users')));
  await check('Sam (outsider)', 'read usage events', 'denied', () => getDocsFromServer(collection(S.db, '_activity')));
  await check('Sam (outsider)', 'read the write log', 'denied', () => getDocsFromServer(collection(S.db, '_writes')));
  await check('Sam (outsider)', 'read Pulse settings', 'denied', () => getDocFromServer(doc(S.db, '_pulse/prefs')));
  await check('Sam (outsider)', 'read the iPhone launch list', 'denied', () => getDocsFromServer(collection(S.db, '_waitlist')));
});

test('a member can’t do owner-only things or see others’ private lists', async () => {
  await check('Maya (member)', 'read the demo trip (sanity)', 'allowed', () => getDocFromServer(doc(M.db, `trips/${DEMO}`)));
  await check('Maya (member)', 'take ownership (createdBy)', 'denied', () => updateDoc(doc(M.db, `trips/${DEMO}`), { createdBy: maya.uid }));
  await check('Maya (member)', 'delete the trip', 'denied', () => deleteDoc(doc(M.db, `trips/${DEMO}`)));
  await check('Maya (member)', 'make herself owner', 'denied', () => updateDoc(doc(M.db, `trips/${DEMO}/members/${maya.uid}`), { role: 'owner' }));
  await check('Maya (member)', 'remove another member', 'denied', () => deleteDoc(doc(M.db, `trips/${DEMO}/members/${jo.uid}`)));
  await check('Maya (member)', 'change another member’s role', 'denied', () => updateDoc(doc(M.db, `trips/${DEMO}/members/${jo.uid}`), { role: 'owner' }));
  await check('Maya (member)', 'mint an invite', 'denied', () => setDoc(doc(M.db, `trips/${DEMO}/invites/MAYA01`), { tripId: DEMO, usedBy: [], expiresAt: Date.now() + 1e9 }));
  await check('Maya (member)', 'read Theo’s outfit photo', 'denied', () => getDocFromServer(doc(M.db, `trips/${DEMO}/outfitPhotos/${TAG}`)));
  // The privacy policy says a packing list is visible only to its owner.
  await check('Maya (member)', 'read Theo’s packing list', 'denied', () => getDocFromServer(doc(M.db, `trips/${DEMO}/packing/${theo.uid}`)));
  await check('Maya (member)', 'change Theo’s packing list', 'denied', () => setDoc(doc(M.db, `trips/${DEMO}/packing/${theo.uid}`), { items: [] }));
});

test('a removed member loses access straight away, in the same session', async () => {
  await adb.doc(`trips/${LISBON}/members/${sam.uid}`).set({ uid: sam.uid, role: 'member', displayName: 'Sam', joinedAt: Date.now() });
  await check('Sam (member)', 'read the trip once added (sanity)', 'allowed', () => getDocFromServer(doc(S.db, `trips/${LISBON}`)));
  await check('Sam (member)', 'read the itinerary once added (sanity)', 'allowed', () => getDocsFromServer(collection(S.db, `trips/${LISBON}/itinerary`)));
  await adb.doc(`trips/${LISBON}/members/${sam.uid}`).delete();
  await check('Sam (removed)', 'read the trip after removal', 'denied', () => getDocFromServer(doc(S.db, `trips/${LISBON}`)));
  await check('Sam (removed)', 'read the itinerary after removal', 'denied', () => getDocsFromServer(collection(S.db, `trips/${LISBON}/itinerary`)));
  await check('Sam (removed)', 'write the itinerary after removal', 'denied', () => setDoc(doc(S.db, `trips/${LISBON}/itinerary/${TAG}-sam`), { x: 1 }));
  await check('Sam (removed)', 'rejoin without an invite', 'denied', () => setDoc(doc(S.db, `trips/${LISBON}/members/${sam.uid}`), { uid: sam.uid, role: 'member' }));
});

test('an owner tearing down a trip can delete everyone’s packing list without reading any', async () => {
  // A throwaway trip shaped like one whose last member is leaving: Maya owns
  // it, Theo was removed (his list is kept for a restore).
  const T = `${TAG}-teardown`;
  await adb.doc(`trips/${T}`).set({ id: T, name: 'Teardown check', createdBy: maya.uid, memberCount: 1, isTest: true });
  await adb.doc(`trips/${T}/members/${maya.uid}`).set({ uid: maya.uid, role: 'owner', joinedAt: 1 });
  await adb.doc(`trips/${T}/removedMembers/${theo.uid}`).set({ uid: theo.uid, displayName: 'Theo' });
  await adb.doc(`trips/${T}/packing/${maya.uid}`).set({ items: [] });
  await adb.doc(`trips/${T}/packing/${theo.uid}`).set({ items: [{ label: 'private', packed: false }] });
  try {
    await check('Maya (owner)', 'list everyone’s packing lists', 'denied', () => getDocsFromServer(collection(M.db, `trips/${T}/packing`)));
    await check('Maya (owner)', 'read the removed member’s packing list', 'denied', () => getDocFromServer(doc(M.db, `trips/${T}/packing/${theo.uid}`)));
    // What TripService.deletePackingLists does:
    await check('Maya (owner)', 'list removed members (teardown)', 'allowed', () => getDocsFromServer(collection(M.db, `trips/${T}/removedMembers`)));
    await check('Maya (owner)', 'delete her own packing list (teardown)', 'allowed', () => deleteDoc(doc(M.db, `trips/${T}/packing/${maya.uid}`)));
    await check('Maya (owner)', 'delete the removed member’s packing list (teardown)', 'allowed', () => deleteDoc(doc(M.db, `trips/${T}/packing/${theo.uid}`)));
    expect((await adb.collection(`trips/${T}/packing`).get()).size, 'no packing lists left').toBe(0);
  } finally {
    for (const p of [`trips/${T}/packing/${maya.uid}`, `trips/${T}/packing/${theo.uid}`, `trips/${T}/removedMembers/${theo.uid}`, `trips/${T}/members/${maya.uid}`, `trips/${T}`]) await adb.doc(p).delete();
  }
});
