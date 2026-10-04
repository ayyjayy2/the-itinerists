/**
 * Firestore security-rules test suite (TP-9).
 *
 * Runs against the local Firestore emulator — no production impact. Asserts
 * both ALLOW and DENY outcomes for every collection/actor combination, which
 * happy-path E2E tests can't do (they'd never surface an over-permissive rule).
 *
 * Run with:  npm run test:rules   (requires a JDK for the emulator)
 * which wraps:  firebase emulators:exec --only firestore "node test/firestore-rules.test.mjs"
 */
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp, writeBatch, arrayUnion, increment,
} from 'firebase/firestore';

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-tripplanner',
  firestore: { rules: readFileSync('firestore.rules', 'utf8') },
});

// Actors
const alice = testEnv.authenticatedContext('alice').firestore(); // trip owner
const bob   = testEnv.authenticatedContext('bob').firestore();   // trip member
const carol = testEnv.authenticatedContext('carol').firestore(); // signed in, NOT a member
const dave  = testEnv.authenticatedContext('dave', { email: 'dave@example.com' }).firestore();  // signed in, brand new
const noMail = testEnv.authenticatedContext('nomail').firestore();                              // brand new, no email on the account
const placeholder = testEnv.authenticatedContext('ph', { email: 'ph@the-itinerists.local' }).firestore(); // brand new, old placeholder address
const admin = testEnv.authenticatedContext('admin').firestore(); // app admin (isAdmin), not a member
const OWNER_UID = 'qdhJLMDxSdVdILg2CTCcIhZyBDz2';                           // the app owner's account (Alayna)
const owner = testEnv.authenticatedContext(OWNER_UID).firestore(); // app owner, not a member of T
const anon  = testEnv.unauthenticatedContext().firestore();      // logged out

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await Promise.all([
      setDoc(doc(db, 'users', 'alice'), { uid: 'alice', username: 'alice', isAdmin: false }),
      setDoc(doc(db, 'users', 'bob'),   { uid: 'bob',   username: 'bob',   isAdmin: false }),
      setDoc(doc(db, 'users', 'carol'), { uid: 'carol', username: 'carol', isAdmin: false }),
      setDoc(doc(db, 'users', 'admin'), { uid: 'admin', username: 'admin', isAdmin: true }),
      setDoc(doc(db, 'users', OWNER_UID), { uid: OWNER_UID, username: 'alayna', isAdmin: true }),
      setDoc(doc(db, 'users', 'bob', 'private', 'account'), { authEmail: 'bob@example.com' }),
      setDoc(doc(db, 'usernames', 'alice'), { uid: 'alice', authEmail: 'alice@example.com' }),
      setDoc(doc(db, 'usernames', 'bob'),   { uid: 'bob',   authEmail: 'bob@example.com' }),
      setDoc(doc(db, 'trips', 'T'), { name: 'Trip', createdBy: 'alice', memberCount: 2 }),
      setDoc(doc(db, 'trips', 'T', 'members', 'alice'), { uid: 'alice', role: 'owner' }),
      setDoc(doc(db, 'trips', 'T', 'members', 'bob'),   { uid: 'bob',   role: 'member' }),
      setDoc(doc(db, 'trips', 'T', 'itinerary', 'i1'), { title: 'Day 1' }),
      setDoc(doc(db, 'trips', 'T', 'packing', 'bob'),  { items: [] }),
      setDoc(doc(db, 'trips', 'T', 'packingSuggestions', 's1'), { from: 'bob', to: 'alice' }),
      setDoc(doc(db, 'trips', 'T', 'outfitPhotos', '2026-01-01_bob'), { dataUrl: 'data:x', ownerUid: 'bob', date: '2026-01-01' }),
      setDoc(doc(db, 'trips', 'T', 'invites', 'CODE1'), { tripId: 'T', usedBy: [], expiresAt: 9999999999999 }),
      setDoc(doc(db, 'trips', 'T', 'invites', 'OLD1'),  { tripId: 'T', usedBy: [], expiresAt: 1 }),
      setDoc(doc(db, 'inviteIndex', 'CODE1'), { tripId: 'T', expiresAt: 9999999999999 }),
      setDoc(doc(db, 'userTrips', 'alice'), { tripIds: ['T'] }),
      setDoc(doc(db, 'userTrips', 'bob'),   { tripIds: ['T'] }),
      setDoc(doc(db, 'userExpenses', 'bob'), { items: [] }),
      // A trip carol created but hasn't added her member doc to yet (for the
      // legit "trip creator self-adds as owner" case).
      setDoc(doc(db, 'trips', 'TC'), { name: 'Carol Trip', createdBy: 'carol', memberCount: 0 }),
      setDoc(doc(db, 'geocache', 'g1'), { entries: { 'berlin|alex': { lat: 52.52, lng: 13.41 } } }),
      setDoc(doc(db, '_appLogs', 'l1'), { m: 'hi' }),
      setDoc(doc(db, '_pulse', 'prefs'), { hiddenTrips: ['TC'] }),
      setDoc(doc(db, '_activity', 'e1'), { uid: 'bob', tripId: 'T', type: 'page', page: '/home', at: new Date(), localHour: 9, tz: 'Europe/Berlin', tzOffsetMin: 120, platform: 'web', sessionId: 's1', appVersion: '0.9.0' }),
    ]);
  });
}

// Per-account limits: a limited write goes in one batch with its counter.
const DAY = 24 * 60 * 60 * 1000;
const quotaStart = (db, who, kind) => [doc(db, '_quotas', who, 'kinds', kind), { windowStart: serverTimestamp(), count: 1, at: serverTimestamp() }];
const quotaAdd   = (db, who, kind) => [doc(db, '_quotas', who, 'kinds', kind), { count: increment(1), at: serverTimestamp() }, { merge: true }];
function counted(db, quota, ref, data) {
  const b = writeBatch(db);
  b.set(ref, data);
  b.set(...quota);
  return b.commit();
}
async function seedCounter(who, kind, count, windowStart) {
  await testEnv.withSecurityRulesDisabled(ctx =>
    setDoc(doc(ctx.firestore(), '_quotas', who, 'kinds', kind), { windowStart, count, at: windowStart }));
}
const JPEG = 'data:image/jpeg;base64,/9j/4AAQ';

let pass = 0, fail = 0;
async function t(name, expect, op) {
  await testEnv.clearFirestore();
  await seed();
  try {
    await (expect === 'allow' ? assertSucceeds(op()) : assertFails(op()));
    pass++; console.log(`  ✓ [${expect}] ${name}`);
  } catch (e) {
    fail++; console.log(`  ✗ [${expect}] ${name} — ${String(e.message).split('\n')[0]}`);
  }
}

console.log('\nTrips');
await t('member reads trip', 'allow', () => getDoc(doc(alice, 'trips', 'T')));
await t('member(bob) reads trip', 'allow', () => getDoc(doc(bob, 'trips', 'T')));
await t('non-member reads trip', 'deny', () => getDoc(doc(carol, 'trips', 'T')));
await t('owner reads a trip they are not on (dashboard)', 'allow', () => getDoc(doc(owner, 'trips', 'T')));
await t('owner lists all trips (dashboard)', 'allow', () => getDocs(collection(owner, 'trips')));
await t('admin lists all trips', 'deny', () => getDocs(collection(admin, 'trips')));
await t('owner updates a trip they are not on', 'deny', () => updateDoc(doc(owner, 'trips', 'T'), { name: 'x' }));
await t('owner reads members of a trip they are not on (dashboard)', 'allow', () => getDoc(doc(owner, 'trips', 'T', 'members', 'bob')));
await t('owner lists members of a trip they are not on (dashboard)', 'allow', () => getDocs(collection(owner, 'trips', 'T', 'members')));
await t('owner reads itinerary of a trip they are not on', 'deny', () => getDoc(doc(owner, 'trips', 'T', 'itinerary', 'i1')));
await t('anon reads trip', 'deny', () => getDoc(doc(anon, 'trips', 'T')));
await t('member updates trip', 'allow', () => updateDoc(doc(bob, 'trips', 'T'), { memberCount: 3 }));
await t('non-member updates trip', 'deny', () => updateDoc(doc(carol, 'trips', 'T'), { memberCount: 3 }));
await t('create trip with own createdBy, counted', 'allow', () => counted(carol, quotaStart(carol, 'carol', 'trips'), doc(carol, 'trips', 'T2'), { name: 'n', createdBy: 'carol' }));
await t('create trip without counting it', 'deny', () => setDoc(doc(carol, 'trips', 'T2'), { name: 'n', createdBy: 'carol' }));
await t('create trip, adding to a counter under the limit', 'allow', async () => {
  await seedCounter('carol', 'trips', 19, new Date());
  return counted(carol, quotaAdd(carol, 'carol', 'trips'), doc(carol, 'trips', 'T2'), { name: 'n', createdBy: 'carol' });
});
await t('create trip past the daily limit (20)', 'deny', async () => {
  await seedCounter('carol', 'trips', 20, new Date());
  return counted(carol, quotaAdd(carol, 'carol', 'trips'), doc(carol, 'trips', 'T2'), { name: 'n', createdBy: 'carol' });
});
await t('create trip at the limit once the window has passed', 'allow', async () => {
  await seedCounter('carol', 'trips', 20, new Date(Date.now() - 2 * DAY));
  return counted(carol, quotaStart(carol, 'carol', 'trips'), doc(carol, 'trips', 'T2'), { name: 'n', createdBy: 'carol' });
});
await t('create trip with foreign createdBy', 'deny', () => counted(carol, quotaStart(carol, 'carol', 'trips'), doc(carol, 'trips', 'T3'), { name: 'n', createdBy: 'alice' }));
await t('member sets the trip createdBy to themselves', 'deny', () => updateDoc(doc(bob, 'trips', 'T'), { createdBy: 'bob' }));
await t('owner hands the trip over (createdBy)', 'allow', () => updateDoc(doc(alice, 'trips', 'T'), { createdBy: 'bob' }));
await t('member renames the trip', 'allow', () => updateDoc(doc(bob, 'trips', 'T'), { name: 'Renamed' }));
await t('owner deletes trip (last-out purge)', 'allow', () => deleteDoc(doc(alice, 'trips', 'T')));
await t('plain member deletes the whole trip', 'deny', () => deleteDoc(doc(bob, 'trips', 'T')));
await t('non-member deletes trip', 'deny', () => deleteDoc(doc(carol, 'trips', 'T')));

console.log('\nMembers');
await t('member reads members', 'allow', () => getDoc(doc(bob, 'trips', 'T', 'members', 'alice')));
await t('non-member reads members', 'deny', () => getDoc(doc(carol, 'trips', 'T', 'members', 'alice')));
await t('self-join with a live invite code', 'allow', () => setDoc(doc(carol, 'trips', 'T', 'members', 'carol'), { uid: 'carol', role: 'member', inviteCode: 'CODE1' }));
await t('self-join with no invite code', 'deny', () => setDoc(doc(carol, 'trips', 'T', 'members', 'carol'), { uid: 'carol', role: 'member' }));
await t('self-join with an unknown invite code', 'deny', () => setDoc(doc(carol, 'trips', 'T', 'members', 'carol'), { uid: 'carol', role: 'member', inviteCode: 'NOPE' }));
await t('self-join with an expired invite code', 'deny', () => setDoc(doc(carol, 'trips', 'T', 'members', 'carol'), { uid: 'carol', role: 'member', inviteCode: 'OLD1' }));
await t('owner adds a member without a code', 'allow', () => setDoc(doc(alice, 'trips', 'T', 'members', 'dave'), { uid: 'dave', role: 'member' }));
await t('create a member doc for someone else', 'deny', () => setDoc(doc(carol, 'trips', 'T', 'members', 'dave'), { uid: 'dave', role: 'member' }));
await t('owner changes another member role', 'allow', () => updateDoc(doc(alice, 'trips', 'T', 'members', 'bob'), { role: 'owner' }));
await t('non-owner edits another member', 'deny', () => updateDoc(doc(bob, 'trips', 'T', 'members', 'alice'), { role: 'member' }));
await t('member edits own member doc', 'allow', () => updateDoc(doc(bob, 'trips', 'T', 'members', 'bob'), { hiddenPages: ['recs'] }));
await t('member deletes own member doc (leave)', 'allow', () => deleteDoc(doc(bob, 'trips', 'T', 'members', 'bob')));
await t('non-owner removes another member', 'deny', () => deleteDoc(doc(bob, 'trips', 'T', 'members', 'alice')));
await t('admin removes a member', 'allow', () => deleteDoc(doc(admin, 'trips', 'T', 'members', 'bob')));

console.log('\nInvites (pre-auth join reads these)');
await t('anon reads invite by code', 'allow', () => getDoc(doc(anon, 'trips', 'T', 'invites', 'CODE1')));
await t('anon lists a trip\'s invites', 'deny', () => getDocs(collection(anon, 'trips', 'T', 'invites')));
await t('member lists the trip\'s invites', 'allow', () => getDocs(collection(bob, 'trips', 'T', 'invites')));
await t('member adds themselves to usedBy', 'allow', () => updateDoc(doc(bob, 'trips', 'T', 'invites', 'CODE1'), { usedBy: arrayUnion('bob') }));
await t('member adds someone else to usedBy', 'deny', () => updateDoc(doc(bob, 'trips', 'T', 'invites', 'CODE1'), { usedBy: ['alice'] }));
await t('member extends an invite\'s expiry', 'deny', () => updateDoc(doc(bob, 'trips', 'T', 'invites', 'OLD1'), { expiresAt: 9999999999999 }));
await t('member creates an invite', 'allow', () => setDoc(doc(alice, 'trips', 'T', 'invites', 'CODE2'), { tripId: 'T', usedBy: [] }));
await t('non-member creates an invite', 'deny', () => setDoc(doc(carol, 'trips', 'T', 'invites', 'CODE3'), { tripId: 'T', usedBy: [] }));
await t('owner closes (deletes) an invite', 'allow', () => deleteDoc(doc(alice, 'trips', 'T', 'invites', 'CODE1')));
await t('plain member closes an invite', 'deny', () => deleteDoc(doc(bob, 'trips', 'T', 'invites', 'CODE1')));
await t('owner removes the invite index entry', 'allow', () => deleteDoc(doc(alice, 'inviteIndex', 'CODE1')));

console.log('\ninviteIndex (global, pre-auth)');
await t('anon reads inviteIndex', 'allow', () => getDoc(doc(anon, 'inviteIndex', 'CODE1')));
await t('anon lists inviteIndex', 'deny', () => getDocs(collection(anon, 'inviteIndex')));
await t('signed-in lists inviteIndex', 'deny', () => getDocs(collection(carol, 'inviteIndex')));
await t('owner publishes an existing invite to the index', 'allow', () => setDoc(doc(alice, 'inviteIndex', 'OLD1'), { tripId: 'T', expiresAt: 1 }));
await t('owner publishes a code with no invite behind it', 'deny', () => setDoc(doc(alice, 'inviteIndex', 'CODE9'), { tripId: 'T', expiresAt: 1 }));
await t('plain member publishes to the index', 'deny', () => setDoc(doc(bob, 'inviteIndex', 'OLD1'), { tripId: 'T', expiresAt: 1 }));
await t('non-member writes inviteIndex', 'deny', () => setDoc(doc(carol, 'inviteIndex', 'CODE9'), { tripId: 'T', expiresAt: 1 }));
await t('non-member repoints someone\'s code', 'deny', () => setDoc(doc(carol, 'inviteIndex', 'CODE1'), { tripId: 'TC', expiresAt: 9999999999999 }));
await t('non-member deletes someone\'s code', 'deny', () => deleteDoc(doc(carol, 'inviteIndex', 'CODE1')));
await t('anon writes inviteIndex', 'deny', () => setDoc(doc(anon, 'inviteIndex', 'CODE9'), { tripId: 'T' }));

console.log('\\nUsers (profiles: self + admin only, never listable)');
await t('anon reads a user', 'deny', () => getDoc(doc(anon, 'users', 'alice')));
await t('self reads own profile', 'allow', () => getDoc(doc(bob, 'users', 'bob')));
await t('trip-mate reads another member profile', 'deny', () => getDoc(doc(bob, 'users', 'alice')));
await t('signed-in reads a stranger profile', 'deny', () => getDoc(doc(carol, 'users', 'alice')));
await t('admin reads another profile', 'allow', () => getDoc(doc(admin, 'users', 'alice')));
await t('signed-in lists users', 'deny', () => getDocs(collection(bob, 'users')));
await t('anon lists users', 'deny', () => getDocs(collection(anon, 'users')));
await t('admin lists users', 'allow', () => getDocs(collection(admin, 'users')));
await t('create own user doc with an email field', 'deny', () => setDoc(doc(dave, 'users', 'dave'), { uid: 'dave', username: 'dave', isAdmin: false, authEmail: 'd@x' }));
await t('update own user doc adding an email field', 'deny', () => updateDoc(doc(bob, 'users', 'bob'), { pendingEmail: 'b@x' }));

console.log('\nusers/{uid}/private (self + admin only)');
await t('self reads own private account', 'allow', () => getDoc(doc(bob, 'users', 'bob', 'private', 'account')));
await t('self writes own private account', 'allow', () => setDoc(doc(bob, 'users', 'bob', 'private', 'account'), { authEmail: 'new@example.com' }));
await t('another user reads private account', 'deny', () => getDoc(doc(alice, 'users', 'bob', 'private', 'account')));
await t('another user writes private account', 'deny', () => setDoc(doc(alice, 'users', 'bob', 'private', 'account'), { authEmail: 'x' }));
await t('anon reads private account', 'deny', () => getDoc(doc(anon, 'users', 'bob', 'private', 'account')));
await t('admin reads private account', 'allow', () => getDoc(doc(admin, 'users', 'bob', 'private', 'account')));

console.log('\nusernames (single GET public, never listable, owner-claimed)');
await t('anon gets a username entry (sign-in lookup)', 'allow', () => getDoc(doc(anon, 'usernames', 'alice')));
await t('anon lists usernames', 'deny', () => getDocs(collection(anon, 'usernames')));
await t('signed-in lists usernames', 'deny', () => getDocs(collection(bob, 'usernames')));
await t('admin lists usernames', 'deny', () => getDocs(collection(admin, 'usernames')));
await t('claim a free username for self', 'allow', () => setDoc(doc(dave, 'usernames', 'dave'), { uid: 'dave', authEmail: 'dave@example.com' }));
await t('claim a username for someone else', 'deny', () => setDoc(doc(dave, 'usernames', 'erin'), { uid: 'erin', authEmail: 'e@x' }));
await t('anon claims a username', 'deny', () => setDoc(doc(anon, 'usernames', 'zed'), { uid: 'zed', authEmail: 'z@x' }));
await t('new account claims a username without an email on the account', 'deny', () => setDoc(doc(noMail, 'usernames', 'nomail'), { uid: 'nomail', authEmail: '' }));
await t('new account claims a username with a placeholder email', 'deny', () => setDoc(doc(placeholder, 'usernames', 'ph'), { uid: 'ph', authEmail: 'ph@the-itinerists.local' }));
await t("new account's username entry names a different email", 'deny', () => setDoc(doc(dave, 'usernames', 'dave2'), { uid: 'dave', authEmail: 'someone@else.com' }));
await t('existing account claims a new username (rename)', 'allow', () => setDoc(doc(bob, 'usernames', 'bobby'), { uid: 'bob', authEmail: 'bob@the-itinerists.local' }));
await t('take over an existing username', 'deny', () => setDoc(doc(dave, 'usernames', 'alice'), { uid: 'dave', authEmail: 'dave@example.com' }));
await t('owner updates own username entry', 'allow', () => updateDoc(doc(bob, 'usernames', 'bob'), { pendingEmail: 'bob2@example.com' }));
await t('owner reassigns own entry to another uid', 'deny', () => updateDoc(doc(bob, 'usernames', 'bob'), { uid: 'alice' }));
await t('another user updates username entry', 'deny', () => updateDoc(doc(alice, 'usernames', 'bob'), { authEmail: 'x' }));
await t('owner releases own username', 'allow', () => deleteDoc(doc(bob, 'usernames', 'bob')));
await t('another user releases a username', 'deny', () => deleteDoc(doc(alice, 'usernames', 'bob')));
await t('admin releases a username', 'allow', () => deleteDoc(doc(admin, 'usernames', 'bob')));
await t('create own user doc', 'allow', () => setDoc(doc(dave, 'users', 'dave'), { uid: 'dave', username: 'dave', isAdmin: false }));
await t('create own user doc with no email on the account', 'deny', () => setDoc(doc(noMail, 'users', 'nomail'), { uid: 'nomail', username: 'nomail', isAdmin: false }));
await t('create own user doc on a placeholder address', 'deny', () => setDoc(doc(placeholder, 'users', 'ph'), { uid: 'ph', username: 'ph', isAdmin: false }));
await t('create a user doc for someone else', 'deny', () => setDoc(doc(dave, 'users', 'erin'), { uid: 'erin', username: 'erin' }));
await t('update own user doc', 'allow', () => updateDoc(doc(bob, 'users', 'bob'), { displayName: 'B' }));
await t('update another user doc', 'deny', () => updateDoc(doc(bob, 'users', 'alice'), { displayName: 'X' }));
await t('admin disables another user', 'allow', () => updateDoc(doc(admin, 'users', 'bob'), { isDisabled: true }));

console.log('\nuserTrips');
await t('read own userTrips', 'allow', () => getDoc(doc(bob, 'userTrips', 'bob')));
await t('read another userTrips', 'deny', () => getDoc(doc(carol, 'userTrips', 'bob')));
await t('write own userTrips', 'allow', () => setDoc(doc(bob, 'userTrips', 'bob'), { tripIds: ['T'] }));
await t('write another userTrips', 'deny', () => updateDoc(doc(carol, 'userTrips', 'bob'), { tripIds: [] }));
await t('admin writes another userTrips (member removal)', 'allow', () => updateDoc(doc(admin, 'userTrips', 'bob'), { tripIds: [] }));

console.log('\nuserExpenses (owner-private)');
await t('owner reads own expenses', 'allow', () => getDoc(doc(bob, 'userExpenses', 'bob')));
await t('read another users expenses', 'deny', () => getDoc(doc(alice, 'userExpenses', 'bob')));
await t('owner writes own expenses', 'allow', () => setDoc(doc(bob, 'userExpenses', 'bob'), { items: [] }));
await t('write another users expenses', 'deny', () => setDoc(doc(alice, 'userExpenses', 'bob'), { items: [] }));
await t('admin reads another users expenses', 'deny', () => getDoc(doc(admin, 'userExpenses', 'bob')));
await t('anon reads expenses', 'deny', () => getDoc(doc(anon, 'userExpenses', 'bob')));

console.log('\nData sub-collections');
await t('member reads itinerary', 'allow', () => getDoc(doc(bob, 'trips', 'T', 'itinerary', 'i1')));
await t('non-member reads itinerary', 'deny', () => getDoc(doc(carol, 'trips', 'T', 'itinerary', 'i1')));
await t('member writes itinerary', 'allow', () => setDoc(doc(bob, 'trips', 'T', 'itinerary', 'i2'), { title: 'Day 2' }));
await t('non-member writes itinerary', 'deny', () => setDoc(doc(carol, 'trips', 'T', 'itinerary', 'i2'), { title: 'Day 2' }));
await t('member writes events',     'allow', () => setDoc(doc(bob,   'trips', 'T', 'events', 'e1'), { kind: 'itinerary', action: 'added', actorUid: 'bob', summary: 'x', path: '/itinerary', audience: 'all', timestamp: 1 }));
await t('member reads events',      'allow', () => getDoc(doc(bob,   'trips', 'T', 'events', 'e1')));
await t('non-member reads events',  'deny',  () => getDoc(doc(carol, 'trips', 'T', 'events', 'e1')));
await t('non-member writes events', 'deny',  () => setDoc(doc(carol, 'trips', 'T', 'events', 'e2'), { kind: 'rec', action: 'added' }));
await t('member reads packingSuggestions', 'allow', () => getDoc(doc(bob, 'trips', 'T', 'packingSuggestions', 's1')));
await t('member writes removedMembers snapshot', 'allow', () => setDoc(doc(alice, 'trips', 'T', 'removedMembers', 'bob'), { uid: 'bob', displayName: 'Bob' }));
await t('non-member reads removedMembers', 'deny', () => getDoc(doc(carol, 'trips', 'T', 'removedMembers', 'bob')));
await t('non-member writes packing', 'deny', () => setDoc(doc(carol, 'trips', 'T', 'packing', 'carol'), { items: [] }));

console.log('\nShared/misc collections');
await t('signed-in reads geocache', 'allow', () => getDoc(doc(bob, 'geocache', 'g1')));
await t('anon reads geocache', 'deny', () => getDoc(doc(anon, 'geocache', 'g1')));
await t('signed-in adds a place to the geocache', 'allow', () => setDoc(doc(bob, 'geocache', 'g1'), { entries: { 'berlin|tv tower': { lat: 52.5, lng: 13.4 } } }, { merge: true }));
await t('signed-in changes a cached place', 'deny', () => setDoc(doc(bob, 'geocache', 'g1'), { entries: { 'berlin|alex': { lat: 0, lng: 0 } } }, { merge: true }));
await t('signed-in wipes the geocache', 'deny', () => setDoc(doc(bob, 'geocache', 'g1'), { entries: {} }));
await t('signed-in writes arbitrary data to geocache', 'deny', () => setDoc(doc(bob, 'geocache', 'g2'), { x: 2 }));
const appLog = (extra = {}) => ({ timestamp: new Date().toISOString(), type: 'js_error', message: 'boom', url: '/home', sessionId: 's1', ...extra });
await t('anon creates _appLogs', 'allow', () => setDoc(doc(anon, '_appLogs', 'l2'), appLog({ stack: 'at x' })));
await t('_appLogs with an extra field', 'deny', () => setDoc(doc(anon, '_appLogs', 'l2'), appLog({ data: 'x' })));
await t('_appLogs with a huge message', 'deny', () => setDoc(doc(anon, '_appLogs', 'l2'), appLog({ message: 'x'.repeat(5000) })));
await t('_appLogs in another shape', 'deny', () => setDoc(doc(anon, '_appLogs', 'l2'), { m: 'y' }));
await t('anon reads _appLogs', 'deny', () => getDoc(doc(anon, '_appLogs', 'l1')));

console.log('\nPrivilege-escalation locks');
// users: a user must not be able to grant themselves admin / un-disable themselves
await t('self cannot set isAdmin=true (update)', 'deny', () => updateDoc(doc(bob, 'users', 'bob'), { isAdmin: true }));
await t('self cannot create own doc as admin', 'deny', () => setDoc(doc(dave, 'users', 'dave'), { uid: 'dave', username: 'dave', isAdmin: true }));
await t('self can edit non-privileged profile fields', 'allow', () => updateDoc(doc(bob, 'users', 'bob'), { displayName: 'Bobby' }));
await t('self cannot change own isDisabled', 'deny', () => updateDoc(doc(bob, 'users', 'bob'), { isDisabled: true }));
await t('admin can set isAdmin on another user', 'allow', () => updateDoc(doc(admin, 'users', 'bob'), { isAdmin: true }));
// members: a self-joining member must not be able to make themselves owner
await t('self-join cannot self-assign owner role', 'deny', () => setDoc(doc(carol, 'trips', 'T', 'members', 'carol'), { uid: 'carol', role: 'owner', inviteCode: 'CODE1' }));
await t('self-join creates as plain member', 'allow', () => setDoc(doc(carol, 'trips', 'T', 'members', 'carol'), { uid: 'carol', role: 'member', inviteCode: 'CODE1' }));
await t('trip creator may self-add as owner', 'allow', () => setDoc(doc(carol, 'trips', 'TC', 'members', 'carol'), { uid: 'carol', role: 'owner' }));
await t('member cannot self-promote to owner', 'deny', () => updateDoc(doc(bob, 'trips', 'T', 'members', 'bob'), { role: 'owner' }));

console.log('\nOutfit photos (owner-private)');
await t('owner reads own outfit photo', 'allow', () => getDoc(doc(bob, 'trips', 'T', 'outfitPhotos', '2026-01-01_bob')));
await t('member reads another member photo', 'deny', () => getDoc(doc(alice, 'trips', 'T', 'outfitPhotos', '2026-01-01_bob')));
await t('non-member reads a photo', 'deny', () => getDoc(doc(carol, 'trips', 'T', 'outfitPhotos', '2026-01-01_bob')));
await t('anon reads a photo', 'deny', () => getDoc(doc(anon, 'trips', 'T', 'outfitPhotos', '2026-01-01_bob')));
const photoRef = (db) => doc(db, 'trips', 'T', 'outfitPhotos', '2026-01-02_alice');
await t('owner creates own photo, counted', 'allow', () => counted(alice, quotaStart(alice, 'alice', 'photos'), photoRef(alice), { dataUrl: JPEG, ownerUid: 'alice', date: '2026-01-02' }));
await t('create photo without counting it', 'deny', () => setDoc(photoRef(alice), { dataUrl: JPEG, ownerUid: 'alice', date: '2026-01-02' }));
await t('create photo past the daily limit (50)', 'deny', async () => {
  await seedCounter('alice', 'photos', 50, new Date());
  return counted(alice, quotaAdd(alice, 'alice', 'photos'), photoRef(alice), { dataUrl: JPEG, ownerUid: 'alice', date: '2026-01-02' });
});
await t('create photo that is not a JPEG', 'deny', () => counted(alice, quotaStart(alice, 'alice', 'photos'), photoRef(alice), { dataUrl: 'data:text/html;base64,PHNjcmlwdD4=', ownerUid: 'alice', date: '2026-01-02' }));
await t('create photo with extra fields', 'deny', () => counted(alice, quotaStart(alice, 'alice', 'photos'), photoRef(alice), { dataUrl: JPEG, ownerUid: 'alice', date: '2026-01-02', note: 'x' }));
await t('create a large (700 KB) photo, counted', 'allow', () => counted(alice, quotaStart(alice, 'alice', 'photos'), photoRef(alice), { dataUrl: JPEG + 'A'.repeat(700_000), ownerUid: 'alice', date: '2026-01-02' }));
await t('create photo with spoofed ownerUid', 'deny', () => setDoc(doc(alice, 'trips', 'T', 'outfitPhotos', '2026-01-02_alice'), { dataUrl: 'data:y', ownerUid: 'bob', date: '2026-01-02' }));
await t('non-member creates a photo', 'deny', () => setDoc(doc(carol, 'trips', 'T', 'outfitPhotos', '2026-01-02_carol'), { dataUrl: 'data:z', ownerUid: 'carol', date: '2026-01-02' }));
await t('owner updates own photo', 'allow', () => updateDoc(doc(bob, 'trips', 'T', 'outfitPhotos', '2026-01-01_bob'), { dataUrl: JPEG }));
await t('member updates another member photo', 'deny', () => updateDoc(doc(alice, 'trips', 'T', 'outfitPhotos', '2026-01-01_bob'), { dataUrl: 'data:hack' }));
await t('owner deletes own photo', 'allow', () => deleteDoc(doc(bob, 'trips', 'T', 'outfitPhotos', '2026-01-01_bob')));
await t('non-member deletes a photo', 'deny', () => deleteDoc(doc(carol, 'trips', 'T', 'outfitPhotos', '2026-01-01_bob')));

console.log('\nWrite log (_writes)');
const wr = (uid, extra = {}) => ({ uid, tripId: 'T', kind: 'itinerary', action: 'added', at: serverTimestamp(), ...extra });
await t('member logs own write', 'allow', () => setDoc(doc(bob, '_writes', 'w1'), wr('bob')));
await t('write with spoofed uid', 'deny', () => setDoc(doc(bob, '_writes', 'w1'), wr('alice')));
await t('write with content field', 'deny', () => setDoc(doc(bob, '_writes', 'w1'), wr('bob', { summary: 'Dinner at Baixa' })));
await t('write with unknown kind', 'deny', () => setDoc(doc(bob, '_writes', 'w1'), wr('bob', { kind: 'photo' })));
await t('write with client timestamp', 'deny', () => setDoc(doc(bob, '_writes', 'w1'), wr('bob', { at: new Date() })));
await t('anon logs a write', 'deny', () => setDoc(doc(anon, '_writes', 'w1'), wr('bob')));
await t('owner lists writes', 'allow', () => getDocs(collection(owner, '_writes')));
await t('member lists writes', 'deny', () => getDocs(collection(bob, '_writes')));
await t('admin (not the owner) lists writes', 'deny', () => getDocs(collection(admin, '_writes')));
await t('anon lists writes', 'deny', () => getDocs(collection(anon, '_writes')));


console.log('\nUsage events (_activity)');
const ev = (uid, extra = {}) => ({ uid, tripId: 'T', type: 'page', page: '/itinerary', at: serverTimestamp(), localHour: 10, tz: 'Europe/Berlin', tzOffsetMin: 120, platform: 'web', sessionId: 's2', appVersion: '0.9.0', ...extra });
await t('member creates own event', 'allow', () => setDoc(doc(bob, '_activity', 'e2'), ev('bob')));
await t('event with null tripId', 'allow', () => setDoc(doc(bob, '_activity', 'e2'), ev('bob', { tripId: null })));
await t('event type ping', 'allow', () => setDoc(doc(bob, '_activity', 'e2'), ev('bob', { type: 'ping' })));
await t('event with spoofed uid', 'deny', () => setDoc(doc(bob, '_activity', 'e2'), ev('alice')));
await t('event with extra field', 'deny', () => setDoc(doc(bob, '_activity', 'e2'), ev('bob', { email: 'x@y.z' })));
await t('event with unknown type', 'deny', () => setDoc(doc(bob, '_activity', 'e2'), ev('bob', { type: 'click' })));
await t('event with client timestamp', 'deny', () => setDoc(doc(bob, '_activity', 'e2'), ev('bob', { at: new Date() })));
await t('anon creates event', 'deny', () => setDoc(doc(anon, '_activity', 'e2'), ev('bob')));
await t('owner reads an event', 'allow', () => getDoc(doc(owner, '_activity', 'e1')));
await t('owner lists events', 'allow', () => getDocs(collection(owner, '_activity')));
await t('admin reads an event', 'deny', () => getDoc(doc(admin, '_activity', 'e1')));
await t('admin lists events', 'deny', () => getDocs(collection(admin, '_activity')));
await t('member reads own event', 'deny', () => getDoc(doc(bob, '_activity', 'e1')));
await t('member lists events', 'deny', () => getDocs(collection(bob, '_activity')));
await t('anon lists events', 'deny', () => getDocs(collection(anon, '_activity')));
await t('owner updates an event', 'deny', () => updateDoc(doc(owner, '_activity', 'e1'), { page: '/x' }));
await t('owner deletes an event', 'deny', () => deleteDoc(doc(owner, '_activity', 'e1')));
await t('owner deletes own event', 'deny', () => deleteDoc(doc(bob, '_activity', 'e1')));

console.log('\nPulse dashboard prefs (_pulse)');
await t('owner reads prefs', 'allow', () => getDoc(doc(owner, '_pulse', 'prefs')));
await t('owner writes prefs', 'allow', () => setDoc(doc(owner, '_pulse', 'prefs'), { hiddenTrips: ['TC', 'T'] }, { merge: true }));
await t('admin reads prefs', 'deny', () => getDoc(doc(admin, '_pulse', 'prefs')));
await t('member writes prefs', 'deny', () => setDoc(doc(bob, '_pulse', 'prefs'), { hiddenTrips: [] }));
await t('anon reads prefs', 'deny', () => getDoc(doc(anon, '_pulse', 'prefs')));
// Pulse is the owner's alone: an admin who is not the owner can't change it, nor can a member read it.
await t('admin (not the owner) writes prefs', 'deny', () => setDoc(doc(admin, '_pulse', 'prefs'), { hiddenTrips: [] }));
await t('member reads prefs', 'deny', () => getDoc(doc(bob, '_pulse', 'prefs')));

console.log('\nAPI console (_apiConsoleAccess, _apiConsole)');
const approve = (uid) => testEnv.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), '_apiConsoleAccess', uid), { grantedAt: 1 }));
const spec = () => testEnv.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), '_apiConsole', 'spec'), { openapi: '{}' }));
await t('approved account reads its own access doc', 'allow', async () => { await approve('bob'); return getDoc(doc(bob, '_apiConsoleAccess', 'bob')); });
await t('signed-in account checks its own (missing) access doc', 'allow', () => getDoc(doc(carol, '_apiConsoleAccess', 'carol')));
await t("reads someone else's access doc", 'deny', async () => { await approve('bob'); return getDoc(doc(carol, '_apiConsoleAccess', 'bob')); });
await t('lists who is approved', 'deny', () => getDocs(collection(alice, '_apiConsoleAccess')));
await t('approves themselves', 'deny', () => setDoc(doc(carol, '_apiConsoleAccess', 'carol'), { grantedAt: 1 }));
await t('admin approves someone', 'deny', () => setDoc(doc(admin, '_apiConsoleAccess', 'carol'), { grantedAt: 1 }));
await t('approved account reads the spec', 'allow', async () => { await approve('bob'); await spec(); return getDoc(doc(bob, '_apiConsole', 'spec')); });
await t('unapproved account reads the spec', 'deny', async () => { await spec(); return getDoc(doc(carol, '_apiConsole', 'spec')); });
await t('logged out reads the spec', 'deny', async () => { await spec(); return getDoc(doc(anon, '_apiConsole', 'spec')); });
await t('approved account writes the spec', 'deny', async () => { await approve('bob'); return setDoc(doc(bob, '_apiConsole', 'spec'), { openapi: 'x' }); });

console.log('\nPer-account limits (_quotas)');
await t('start your own counter', 'allow', () => setDoc(...quotaStart(carol, 'carol', 'photos')));
await t('start a counter for someone else', 'deny', () => setDoc(...quotaStart(carol, 'bob', 'photos')));
await t('start a counter of an unknown kind', 'deny', () => setDoc(...quotaStart(carol, 'carol', 'messages')));
await t('start a counter at zero', 'deny', () => setDoc(doc(carol, '_quotas', 'carol', 'kinds', 'photos'), { windowStart: serverTimestamp(), count: 0, at: serverTimestamp() }));
await t('reset your counter before the window ends', 'deny', async () => {
  await seedCounter('carol', 'photos', 30, new Date());
  return setDoc(...quotaStart(carol, 'carol', 'photos'));
});
await t('add two at once', 'deny', async () => {
  await seedCounter('carol', 'photos', 3, new Date());
  return setDoc(doc(carol, '_quotas', 'carol', 'kinds', 'photos'), { count: increment(2), at: serverTimestamp() }, { merge: true });
});
await t('read your own counter', 'allow', () => getDoc(doc(carol, '_quotas', 'carol', 'kinds', 'photos')));
await t('read someone else\'s counter', 'deny', () => getDoc(doc(carol, '_quotas', 'bob', 'kinds', 'photos')));
await t('delete a counter still in its window', 'deny', async () => {
  await seedCounter('carol', 'photos', 3, new Date());
  return deleteDoc(doc(carol, '_quotas', 'carol', 'kinds', 'photos'));
});
await t('delete a counter whose window has passed', 'allow', async () => {
  await seedCounter('carol', 'photos', 3, new Date(Date.now() - 2 * DAY));
  return deleteDoc(doc(carol, '_quotas', 'carol', 'kinds', 'photos'));
});

console.log('\nLog sizes');
await t('usage event with a huge page', 'deny', () => setDoc(doc(bob, '_activity', 'e2'), { uid: 'bob', tripId: 'T', type: 'page', page: '/'.repeat(500), at: serverTimestamp() }));
await t('write log with a huge action', 'deny', () => setDoc(doc(bob, '_writes', 'w2'), { uid: 'bob', tripId: 'T', kind: 'trip', action: 'x'.repeat(100), at: serverTimestamp() }));

await testEnv.cleanup();
console.log(`\n${fail === 0 ? '✅' : '❌'} rules tests: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
