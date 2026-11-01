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

// Actors. Every token carries auth_time (when the person last entered their
// password): sessions older than 90 days are refused (see isSignedIn()).
const NOW_S = Math.floor(Date.now() / 1000);
const FRESH = { auth_time: NOW_S - 60 };
const STALE = { auth_time: NOW_S - 91 * 24 * 60 * 60 };
const alice = testEnv.authenticatedContext('alice', FRESH).firestore(); // trip owner
const bob   = testEnv.authenticatedContext('bob', FRESH).firestore();   // trip member
const carol = testEnv.authenticatedContext('carol', FRESH).firestore(); // signed in, NOT a member
const dave  = testEnv.authenticatedContext('dave', { ...FRESH, email: 'dave@example.com' }).firestore();  // signed in, brand new
const noMail = testEnv.authenticatedContext('nomail', FRESH).firestore();                              // brand new, no email on the account
const placeholder = testEnv.authenticatedContext('ph', { ...FRESH, email: 'ph@the-itinerists.local' }).firestore(); // brand new, old placeholder address
const admin = testEnv.authenticatedContext('admin', FRESH).firestore(); // app admin (isAdmin), not a member
const owner = testEnv.authenticatedContext('appowner', { ...FRESH, owner: true }).firestore(); // app owner (the `owner` claim), not a member of T
const fakeOwner = testEnv.authenticatedContext('faker', { ...FRESH, email: 'faker@example.com' }).firestore(); // signed in, no owner claim
const anon  = testEnv.unauthenticatedContext().firestore();      // logged out
const ANON = { ...FRESH, firebase: { sign_in_provider: 'anonymous' } };
const gus  = testEnv.authenticatedContext('gus', ANON).firestore();   // a guest already on trip T (#610)
const gina = testEnv.authenticatedContext('gina', ANON).firestore();  // a guest opening T's invite link
const gusUpgraded = testEnv.authenticatedContext('gus', { ...FRESH, email: 'gus@example.com', firebase: { sign_in_provider: 'password' } }).firestore(); // gus after creating an account
const bobStale = testEnv.authenticatedContext('bob', STALE).firestore();  // bob, last signed in 91 days ago

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await Promise.all([
      setDoc(doc(db, 'users', 'alice'), { uid: 'alice', username: 'alice', isAdmin: false }),
      setDoc(doc(db, 'users', 'bob'),   { uid: 'bob',   username: 'bob',   isAdmin: false }),
      setDoc(doc(db, 'users', 'carol'), { uid: 'carol', username: 'carol', isAdmin: false }),
      setDoc(doc(db, 'users', 'admin'), { uid: 'admin', username: 'admin', isAdmin: true }),
      setDoc(doc(db, 'users', 'appowner'), { uid: 'appowner', username: 'appowner', isAdmin: true }),
      setDoc(doc(db, 'users', 'bob', 'private', 'account'), { authEmail: 'bob@example.com' }),
      setDoc(doc(db, 'usernames', 'alice'), { uid: 'alice' }),                                  // signs in with email
      setDoc(doc(db, 'usernames', 'bob'),   { uid: 'bob',   authEmail: 'bob@the-itinerists.local' }), // old username-only account
      setDoc(doc(db, 'trips', 'T'), { name: 'Trip', createdBy: 'alice', memberCount: 2 }),
      setDoc(doc(db, 'trips', 'T', 'members', 'alice'), { uid: 'alice', role: 'owner' }),
      setDoc(doc(db, 'trips', 'T', 'members', 'bob'),   { uid: 'bob',   role: 'member' }),
      setDoc(doc(db, 'trips', 'T', 'members', 'gus'),   { uid: 'gus',   role: 'member', inviteCode: 'CODE1' }),
      setDoc(doc(db, 'userTrips', 'gus'), { tripIds: ['T'] }),
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
      setDoc(doc(db, '_config', 'survey'), { id: 's1', active: true, url: 'https://example.com', title: 'Hi', body: 'b', bannerText: 't' }),
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
// The invite doc names the owner and everyone who joined (createdBy, usedBy):
// members only. Outsiders resolve a code through inviteIndex, which holds just
// the trip id and expiry (#404).
await t('anon reads invite by code', 'deny', () => getDoc(doc(anon, 'trips', 'T', 'invites', 'CODE1')));
await t('signed-in non-member reads invite by code', 'deny', () => getDoc(doc(carol, 'trips', 'T', 'invites', 'CODE1')));
await t('member reads the trip\'s invite', 'allow', () => getDoc(doc(bob, 'trips', 'T', 'invites', 'CODE1')));
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

console.log('\nusernames (single GET public, never listable, no new names, never a real email)');
await t('anon gets a username entry (sign-in lookup)', 'allow', () => getDoc(doc(anon, 'usernames', 'alice')));
await t('anon lists usernames', 'deny', () => getDocs(collection(anon, 'usernames')));
await t('signed-in lists usernames', 'deny', () => getDocs(collection(bob, 'usernames')));
await t('admin lists usernames', 'deny', () => getDocs(collection(admin, 'usernames')));
await t('new account claims a username (sign-up has none now)', 'deny', () => setDoc(doc(dave, 'usernames', 'dave'), { uid: 'dave' }));
await t('existing account claims a new username', 'deny', () => setDoc(doc(bob, 'usernames', 'bobby'), { uid: 'bob', authEmail: 'bob@the-itinerists.local' }));
await t('anon claims a username', 'deny', () => setDoc(doc(anon, 'usernames', 'zed'), { uid: 'zed' }));
await t('take over an existing username', 'deny', () => setDoc(doc(dave, 'usernames', 'alice'), { uid: 'dave' }));
await t('owner drops the placeholder address from own entry', 'allow', () => setDoc(doc(bob, 'usernames', 'bob'), { uid: 'bob' }));
await t('owner puts a real email in own entry', 'deny', () => updateDoc(doc(bob, 'usernames', 'bob'), { authEmail: 'bob@example.com' }));
await t('owner adds a pending email to own entry', 'deny', () => updateDoc(doc(bob, 'usernames', 'bob'), { pendingEmail: 'bob2@example.com' }));
await t('owner reassigns own entry to another uid', 'deny', () => updateDoc(doc(bob, 'usernames', 'bob'), { uid: 'alice' }));
await t('another user updates username entry', 'deny', () => setDoc(doc(alice, 'usernames', 'bob'), { uid: 'bob' }));
await t('admin strips a real email from an entry', 'allow', () => setDoc(doc(admin, 'usernames', 'alice'), { uid: 'alice' }));
await t('owner releases own username', 'allow', () => deleteDoc(doc(bob, 'usernames', 'bob')));
await t('another user releases a username', 'deny', () => deleteDoc(doc(alice, 'usernames', 'bob')));
await t('admin releases a username', 'allow', () => deleteDoc(doc(admin, 'usernames', 'bob')));
await t('create own user doc (no username)', 'allow', () => setDoc(doc(dave, 'users', 'dave'), { uid: 'dave', displayName: 'Dave', isAdmin: false }));
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
// A packing list is private to its owner (privacy policy), even from other members (#403).
await t('member reads own packing list', 'allow', () => getDoc(doc(bob, 'trips', 'T', 'packing', 'bob')));
await t('member writes own packing list', 'allow', () => setDoc(doc(bob, 'trips', 'T', 'packing', 'bob'), { items: [] }));
await t('member reads another member’s packing list', 'deny', () => getDoc(doc(alice, 'trips', 'T', 'packing', 'bob')));
await t('member changes another member’s packing list', 'deny', () => setDoc(doc(alice, 'trips', 'T', 'packing', 'bob'), { items: [] }));
await t('member lists everyone’s packing lists', 'deny', () => getDocs(collection(bob, 'trips', 'T', 'packing')));
await t('trip owner deletes a left-behind packing list (purge)', 'allow', () => deleteDoc(doc(alice, 'trips', 'T', 'packing', 'bob')));

console.log('\nShared/misc collections');
// #356: the old shared cache held every trip's place names; it is closed. Each trip keeps its own.
await t('signed-in reads the old shared geocache', 'deny', () => getDoc(doc(bob, 'geocache', 'g1')));
await t('signed-in lists the old shared geocache', 'deny', () => getDocs(collection(bob, 'geocache')));
await t('signed-in adds to the old shared geocache', 'deny', () => setDoc(doc(bob, 'geocache', 'g1'), { entries: { 'berlin|tv tower': { lat: 52.5, lng: 13.4 } } }, { merge: true }));
const tripGeo = (db) => doc(db, 'trips', 'T', 'geocache', 'places');
await t('member adds places to their trip cache', 'allow', () => setDoc(tripGeo(bob), { entries: { 'lisbon|alfama': { lat: 38.71, lng: -9.13 } } }, { merge: true }));
await t('member reads their trip cache', 'allow', async () => { await testEnv.withSecurityRulesDisabled(c => setDoc(tripGeo(c.firestore()), { entries: { 'lisbon|alfama': { lat: 38.71, lng: -9.13 } } })); return getDoc(tripGeo(bob)); });
await t('non-member reads a trip cache', 'deny', async () => { await testEnv.withSecurityRulesDisabled(c => setDoc(tripGeo(c.firestore()), { entries: { 'lisbon|alfama': { lat: 38.71, lng: -9.13 } } })); return getDoc(tripGeo(carol)); });
await t('non-member writes a trip cache', 'deny', () => setDoc(tripGeo(carol), { entries: { 'lisbon|x': { lat: 1, lng: 1 } } }, { merge: true }));
await t('member writes other fields to a trip cache', 'deny', () => setDoc(tripGeo(bob), { entries: {}, note: 'x' }));
await t('member deletes the trip cache (trip teardown)', 'allow', async () => { await testEnv.withSecurityRulesDisabled(c => setDoc(tripGeo(c.firestore()), { entries: {} })); return deleteDoc(tripGeo(bob)); });
const appLog = (extra = {}) => ({ timestamp: new Date().toISOString(), type: 'js_error', message: 'boom', url: '/home', sessionId: 's1', ...extra });
await t('anon creates _appLogs', 'allow', () => setDoc(doc(anon, '_appLogs', 'l2'), appLog({ stack: 'at x' })));
await t('a blocked request (CSP) is logged (#445)', 'allow', () => setDoc(doc(bob, '_appLogs', 'l3'), appLog({ type: 'csp_violation', message: 'connect-src blocked example.com' })));
await t('a diagnostic note is logged (#484, #485)', 'allow', () => setDoc(doc(bob, '_appLogs', 'l5'), appLog({ type: 'diagnostic', message: 'slow start: signed in after 1.2 s, trip ready after 9.8 s (iPhone app)' })));
await t('an unknown log type', 'deny', () => setDoc(doc(bob, '_appLogs', 'l4'), appLog({ type: 'anything' })));
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
// layoutPicker (the home layout picker) is granted by an admin script, never by the person
await t('self cannot set layoutPicker (update)', 'deny', () => updateDoc(doc(bob, 'users', 'bob'), { layoutPicker: true }));
await t('self cannot create own doc with layoutPicker', 'deny', () => setDoc(doc(dave, 'users', 'dave'), { uid: 'dave', username: 'dave', isAdmin: false, layoutPicker: true }));
await t('admin can set layoutPicker on another user', 'allow', () => updateDoc(doc(admin, 'users', 'bob'), { layoutPicker: true }));
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

console.log('\nApp settings (_config: the survey invitation)');
await t('signed-in person reads the survey settings', 'allow', () => getDoc(doc(bob, '_config', 'survey')));
await t('anon reads the survey settings', 'deny', () => getDoc(doc(anon, '_config', 'survey')));
await t('signed-in person lists app settings', 'deny', () => getDocs(collection(bob, '_config')));
await t('member changes the survey settings', 'deny', () => setDoc(doc(bob, '_config', 'survey'), { active: false }));
await t('admin changes the survey settings', 'deny', () => updateDoc(doc(admin, '_config', 'survey'), { url: 'https://evil.example' }));
await t('signed-in person reads the partner offers', 'allow', () => getDoc(doc(bob, '_config', 'partners')));
await t('anon reads the partner offers', 'deny', () => getDoc(doc(anon, '_config', 'partners')));
await t('member changes the partner offers', 'deny', () => setDoc(doc(bob, '_config', 'partners'), { active: true, esim: [], insurance: [] }));
await t('self records survey progress', 'allow', () => updateDoc(doc(bob, 'users', 'bob'), { 'surveys.s1.promptSeenAt': 1 }));
await t('someone else records your survey progress', 'deny', () => updateDoc(doc(alice, 'users', 'bob'), { 'surveys.s1.takenAt': 1 }));

console.log('\nApp launch list (_waitlist: "Notify me" on the welcome page)');
const wl = (o = {}) => ({ email: 'maya@example.com', list: 'ios', at: serverTimestamp(), ...o });
await t('anon joins the iPhone app list', 'allow', () => setDoc(doc(anon, '_waitlist', 'w1'), wl()));
await t('signed-in person joins the list', 'allow', () => setDoc(doc(bob, '_waitlist', 'w2'), wl()));
await t('join with a malformed email', 'deny', () => setDoc(doc(anon, '_waitlist', 'w3'), wl({ email: 'not-an-email' })));
await t('join with a huge email', 'deny', () => setDoc(doc(anon, '_waitlist', 'w3'), wl({ email: 'a'.repeat(250) + '@x.io' })));
await t('join an unknown list', 'deny', () => setDoc(doc(anon, '_waitlist', 'w3'), wl({ list: 'android' })));
await t('join with an extra field', 'deny', () => setDoc(doc(anon, '_waitlist', 'w3'), wl({ name: 'Maya' })));
await t('join with a client timestamp', 'deny', () => setDoc(doc(anon, '_waitlist', 'w3'), wl({ at: new Date(Date.now() - 60_000) })));
await t('anon reads the list', 'deny', () => getDoc(doc(anon, '_waitlist', 'w1')));
await t('member lists the list', 'deny', () => getDocs(collection(bob, '_waitlist')));
await t('admin lists the list', 'deny', () => getDocs(collection(admin, '_waitlist')));
await t('app owner lists the list (Pulse count)', 'allow', () => getDocs(collection(owner, '_waitlist')));
await t('signed in without the owner claim lists the list', 'deny', () => getDocs(collection(fakeOwner, '_waitlist')));
await t('app owner edits an entry', 'deny', () => updateDoc(doc(owner, '_waitlist', 'w1'), { email: 'x@y.io' }));
await t('app owner deletes an entry', 'deny', () => deleteDoc(doc(owner, '_waitlist', 'w1')));
await t('anon edits an entry', 'deny', () => updateDoc(doc(anon, '_waitlist', 'w1'), { email: 'x@y.io' }));
await t('anon deletes an entry', 'deny', () => deleteDoc(doc(anon, '_waitlist', 'w1')));

console.log('\nGuests (#610): read the trip from an invite link, change nothing until they make an account');
await t('guest reads the trip', 'allow', () => getDoc(doc(gus, 'trips', 'T')));
await t('guest reads the members', 'allow', () => getDocs(collection(gus, 'trips', 'T', 'members')));
await t('guest reads the itinerary', 'allow', () => getDocs(collection(gus, 'trips', 'T', 'itinerary')));
await t('guest reads the shared expenses', 'allow', () => getDocs(collection(gus, 'trips', 'T', 'finance')));
await t('guest adds an itinerary item', 'deny', () => setDoc(doc(gus, 'trips', 'T', 'itinerary', 'g1'), { title: 'Guest stop' }));
await t('guest edits an itinerary item', 'deny', () => updateDoc(doc(gus, 'trips', 'T', 'itinerary', 'i1'), { title: 'Changed' }));
await t('guest deletes an itinerary item', 'deny', () => deleteDoc(doc(gus, 'trips', 'T', 'itinerary', 'i1')));
await t('guest adds an expense', 'deny', () => setDoc(doc(gus, 'trips', 'T', 'finance', 'f1'), { amount: 10 }));
await t('guest ticks a payment', 'deny', () => setDoc(doc(gus, 'trips', 'T', 'payments', 'p1'), { from: 'gus', to: 'alice', itemId: 'f1', markedBy: 'gus', at: serverTimestamp() }));
await t('guest renames the trip', 'deny', () => updateDoc(doc(gus, 'trips', 'T'), { name: 'Guest trip' }));
await t('guest bumps the member count by one (joining)', 'allow', () => updateDoc(doc(gus, 'trips', 'T'), { memberCount: increment(1) }));
await t('guest sets the member count to anything', 'deny', () => updateDoc(doc(gus, 'trips', 'T'), { memberCount: 99 }));
await t('guest posts to the update feed (joined)', 'allow', () => setDoc(doc(gus, 'trips', 'T', 'events', 'gj1'), { action: 'joined' }));
await t('guest edits the update feed', 'deny', () => updateDoc(doc(gus, 'trips', 'T', 'events', 'gj1'), { action: 'changed' }));
await t('guest starts a packing list', 'deny', () => setDoc(doc(gus, 'trips', 'T', 'packing', 'gus'), { items: [] }));
await t('guest adds an outfit photo', 'deny', () => setDoc(doc(gus, 'trips', 'T', 'outfitPhotos', '2026-01-01_gus'), { dataUrl: 'data:image/jpeg;base64,x', ownerUid: 'gus', date: '2026-01-01' }));
await t('guest writes My Expenses', 'deny', () => setDoc(doc(gus, 'userExpenses', 'gus'), { items: [] }));
await t('guest creates a trip', 'deny', () => setDoc(doc(gus, 'trips', 'TG'), { name: 'Mine', createdBy: 'gus', memberCount: 0 }));
await t('guest creates a profile not marked as a guest', 'deny', () => setDoc(doc(gus, 'users', 'gus'), { uid: 'gus', displayName: 'Gus' }));
await t('guest creates their guest profile', 'allow', () => setDoc(doc(gus, 'users', 'gus'), { uid: 'gus', displayName: 'Gus', isGuest: true, isAdmin: false }));
await t('guest makes themselves an admin', 'deny', () => setDoc(doc(gina, 'users', 'gina'), { uid: 'gina', displayName: 'Gina', isGuest: true, isAdmin: true }));
await t('guest creates a profile for someone else', 'deny', () => setDoc(doc(gina, 'users', 'gus2'), { uid: 'gus2', displayName: 'X', isGuest: true }));
await t('guest fills the map place cache', 'allow', () => setDoc(doc(gus, 'trips', 'T', 'geocache', 'c1'), { entries: {} }));
await t('guest clears the map place cache', 'deny', () => deleteDoc(doc(gus, 'trips', 'T', 'geocache', 'c1')));
await t('guest changes their own name on the trip', 'allow', () => updateDoc(doc(gus, 'trips', 'T', 'members', 'gus'), { displayName: 'Gus' }));
await t('guest makes themselves owner', 'deny', () => updateDoc(doc(gus, 'trips', 'T', 'members', 'gus'), { role: 'owner' }));
await t('guest makes an invite', 'deny', () => setDoc(doc(gus, 'trips', 'T', 'invites', 'GUEST1'), { tripId: 'T', usedBy: [], expiresAt: 9999999999999 }));
await t('guest records a page view', 'allow', () => setDoc(doc(gus, '_activity', 'ge1'), { uid: 'gus', tripId: 'T', type: 'page', page: '/home', at: serverTimestamp(), localHour: 9, tz: 'Europe/Berlin', tzOffsetMin: 60, platform: 'web', sessionId: 's', appVersion: '1' }));
await t('new guest joins with a live invite', 'allow', () => setDoc(doc(gina, 'trips', 'T', 'members', 'gina'), { uid: 'gina', role: 'member', inviteCode: 'CODE1', displayName: 'Gina' }));
await t('new guest joins with an expired invite', 'deny', () => setDoc(doc(gina, 'trips', 'T', 'members', 'gina2'), { uid: 'gina', role: 'member', inviteCode: 'OLD1' }));
await t('new guest joins as owner', 'deny', () => setDoc(doc(gina, 'trips', 'TC', 'members', 'gina'), { uid: 'gina', role: 'owner', inviteCode: 'CODE1' }));
await t('outsider guest reads the trip', 'deny', () => getDoc(doc(testEnv.authenticatedContext('stranger', ANON).firestore(), 'trips', 'T')));
await t('guest, after making an account, adds an itinerary item', 'allow', () => setDoc(doc(gusUpgraded, 'trips', 'T', 'itinerary', 'g2'), { title: 'Now I can' }));
await t('guest, after making an account, starts a packing list', 'allow', () => setDoc(doc(gusUpgraded, 'trips', 'T', 'packing', 'gus'), { items: [] }));

console.log('\nPaying back (#532): payment handles and once-a-day reminders');
await t('member adds payment handles to their own member doc', 'allow', () => updateDoc(doc(bob, 'trips', 'T', 'members', 'bob'), { payHandles: { venmo: 'bob-b', paypal: 'BobB', cashapp: 'bobb' } }));
await t('member adds an unknown payment app', 'deny', () => updateDoc(doc(bob, 'trips', 'T', 'members', 'bob'), { payHandles: { zelle: 'bob' } }));
await t('member adds a handle with a space or a link', 'deny', () => updateDoc(doc(bob, 'trips', 'T', 'members', 'bob'), { payHandles: { venmo: 'javascript:alert(1)' } }));
await t('member sets someone else\'s payment handles', 'deny', () => updateDoc(doc(bob, 'trips', 'T', 'members', 'alice'), { payHandles: { venmo: 'bob-b' } }));
await t('person saves payment handles on their profile', 'allow', () => updateDoc(doc(bob, 'users', 'bob'), { payHandles: { paypal: 'BobB' } }));
await t('person saves a bad handle on their profile', 'deny', () => updateDoc(doc(bob, 'users', 'bob'), { payHandles: { paypal: 'Bob B' } }));
await t('owed member reminds the member who owes', 'allow', () => setDoc(doc(alice, 'trips', 'T', 'reminders', 'alice_bob'), { from: 'alice', to: 'bob', at: serverTimestamp() }));
const earlierReminder = hoursAgo => testEnv.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), 'trips', 'T', 'reminders', 'alice_bob'), { from: 'alice', to: 'bob', at: new Date(Date.now() - hoursAgo * 60 * 60 * 1000) }));
await t('reminding again the same day', 'deny', async () => { await earlierReminder(2); return setDoc(doc(alice, 'trips', 'T', 'reminders', 'alice_bob'), { from: 'alice', to: 'bob', at: serverTimestamp() }); });
await t('reminding again a day later', 'allow', async () => { await earlierReminder(21); return setDoc(doc(alice, 'trips', 'T', 'reminders', 'alice_bob'), { from: 'alice', to: 'bob', at: serverTimestamp() }); });
await t('reminder in someone else\'s name', 'deny', () => setDoc(doc(bob, 'trips', 'T', 'reminders', 'alice_carol'), { from: 'alice', to: 'carol', at: serverTimestamp() }));
await t('reminder stored under the wrong pair', 'deny', () => setDoc(doc(bob, 'trips', 'T', 'reminders', 'bob_x'), { from: 'bob', to: 'alice', at: serverTimestamp() }));
await t('reminder with a client time', 'deny', () => setDoc(doc(bob, 'trips', 'T', 'reminders', 'bob_alice'), { from: 'bob', to: 'alice', at: new Date(0) }));
await t('member reads when a reminder was sent', 'allow', async () => { await earlierReminder(2); return getDoc(doc(bob, 'trips', 'T', 'reminders', 'alice_bob')); });
await t('outsider sends a reminder', 'deny', () => setDoc(doc(carol, 'trips', 'T', 'reminders', 'carol_bob'), { from: 'carol', to: 'bob', at: serverTimestamp() }));
await t('guest sends a reminder', 'deny', () => setDoc(doc(gus, 'trips', 'T', 'reminders', 'gus_bob'), { from: 'gus', to: 'bob', at: serverTimestamp() }));

console.log('\nInvite opens (_inviteOpens: who reached an invite, for the invite-to-join rate, #609)');
const io = (o = {}) => ({ tripId: 'T', via: 'link', platform: 'web', visitor: '3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f', at: serverTimestamp(), ...o });
await t('anon opens an invite link', 'allow', () => setDoc(doc(anon, '_inviteOpens', 'i1'), io()));
await t('signed-in person types an invite code', 'allow', () => setDoc(doc(bob, '_inviteOpens', 'i2'), io({ via: 'code', platform: 'ios' })));
await t('record with an unknown route', 'deny', () => setDoc(doc(anon, '_inviteOpens', 'i3'), io({ via: 'email' })));
await t('record with the invite code in it', 'deny', () => setDoc(doc(anon, '_inviteOpens', 'i3'), io({ code: 'ABC123' })));
await t('record with a name for the visitor', 'deny', () => setDoc(doc(anon, '_inviteOpens', 'i3'), io({ visitor: 'Maya Lopez' })));
await t('record with a huge trip id', 'deny', () => setDoc(doc(anon, '_inviteOpens', 'i3'), io({ tripId: 'x'.repeat(65) })));
await t('record with a client timestamp', 'deny', () => setDoc(doc(anon, '_inviteOpens', 'i3'), io({ at: new Date(Date.now() - 60_000) })));
await t('anon reads an invite open', 'deny', () => getDoc(doc(anon, '_inviteOpens', 'i1')));
await t('member lists invite opens', 'deny', () => getDocs(collection(bob, '_inviteOpens')));
await t('admin lists invite opens', 'deny', () => getDocs(collection(admin, '_inviteOpens')));
await t('app owner lists invite opens (Pulse)', 'allow', () => getDocs(collection(owner, '_inviteOpens')));
await t('signed in without the owner claim lists invite opens', 'deny', () => getDocs(collection(fakeOwner, '_inviteOpens')));
await t('app owner edits an invite open', 'deny', () => updateDoc(doc(owner, '_inviteOpens', 'i1'), { via: 'code' }));
await t('anon deletes an invite open', 'deny', () => deleteDoc(doc(anon, '_inviteOpens', 'i1')));

console.log('\nShared paid ticks (trips/T/payments, #448)');
const paid = (db, id = 'Bob__Alice__e1') => doc(db, 'trips', 'T', 'payments', id);
const mark = (uid, extra = {}) => ({ from: 'Bob', to: 'Alice', itemId: 'e1', markedBy: uid, at: serverTimestamp(), ...extra });
await t('member marks a debt item paid', 'allow', () => setDoc(paid(bob), mark('bob')));
await t('member marks it paid in someone else\'s name', 'deny', () => setDoc(paid(bob), mark('alice')));
await t('mark with extra fields', 'deny', () => setDoc(paid(bob), mark('bob', { amount: 5 })));
await t('mark with a client timestamp', 'deny', () => setDoc(paid(bob), mark('bob', { at: new Date(Date.now() - 60_000) })));
await t('non-member marks a debt paid', 'deny', () => setDoc(paid(carol), mark('carol')));
await t('member reads the paid marks', 'allow', async () => { await testEnv.withSecurityRulesDisabled(c => setDoc(paid(c.firestore()), { ...mark('bob'), at: new Date() })); return getDocs(collection(alice, 'trips', 'T', 'payments')); });
await t('non-member reads the paid marks', 'deny', async () => { await testEnv.withSecurityRulesDisabled(c => setDoc(paid(c.firestore()), { ...mark('bob'), at: new Date() })); return getDocs(collection(carol, 'trips', 'T', 'payments')); });
await t('member unmarks (deletes) a paid mark', 'allow', async () => { await testEnv.withSecurityRulesDisabled(c => setDoc(paid(c.firestore()), { ...mark('alice'), at: new Date() })); return deleteDoc(paid(bob)); });
await t('member edits a paid mark', 'deny', async () => { await testEnv.withSecurityRulesDisabled(c => setDoc(paid(c.firestore()), { ...mark('bob'), at: new Date() })); return updateDoc(paid(bob), { to: 'Carol' }); });

console.log('\nWhat the weather was (trips/T/weather, #558)');
const wx = (db, date = '2026-01-10') => doc(db, 'trips', 'T', 'weather', date);
const day = (extra = {}) => ({ city: 'Chiang Mai', minF: 64, maxF: 88, code: 2, savedAt: serverTimestamp(), ...extra });
const savedWx = () => testEnv.withSecurityRulesDisabled(c => setDoc(wx(c.firestore()), { ...day(), savedAt: new Date() }));
await t('member saves a past day\'s weather', 'allow', () => setDoc(wx(bob), day()));
await t('member reads the saved weather', 'allow', async () => { await savedWx(); return getDocs(collection(bob, 'trips', 'T', 'weather')); });
await t('non-member reads the saved weather', 'deny', async () => { await savedWx(); return getDocs(collection(carol, 'trips', 'T', 'weather')); });
await t('non-member saves a day\'s weather', 'deny', () => setDoc(wx(carol), day()));
await t('member saves a day that is still to come', 'deny', () => setDoc(wx(bob, '2099-01-01'), day()));
await t('member saves a day from yesterday (not settled yet)', 'deny', () => setDoc(wx(bob, new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)), day()));
await t('saved under an id that is not a date', 'deny', () => setDoc(wx(bob, 'tomorrow'), day()));
await t('weather with extra fields', 'deny', () => setDoc(wx(bob), day({ note: 'hot' })));
await t('weather missing a field', 'deny', () => setDoc(wx(bob), { city: 'Chiang Mai', minF: 64, maxF: 88, savedAt: serverTimestamp() }));
await t('weather with a low above its high', 'deny', () => setDoc(wx(bob), day({ minF: 90, maxF: 80 })));
await t('weather with a temperature as text', 'deny', () => setDoc(wx(bob), day({ maxF: 'hot' })));
await t('weather with a client timestamp', 'deny', () => setDoc(wx(bob), day({ savedAt: new Date(Date.now() - 60_000) })));
await t('member changes a saved day', 'deny', async () => { await savedWx(); return updateDoc(wx(bob), { maxF: 120 }); });
await t('member overwrites a saved day', 'deny', async () => { await savedWx(); return setDoc(wx(bob), day({ maxF: 120 })); });
await t('member deletes a saved day (trip teardown)', 'allow', async () => { await savedWx(); return deleteDoc(wx(alice)); });
await t('non-member deletes a saved day', 'deny', async () => { await savedWx(); return deleteDoc(wx(carol)); });

console.log('\nAccount deletion records (_deletions, #452)');
const del = (uid, extra = {}) => ({ uid, at: serverTimestamp(), accountCreatedAt: 1_780_000_000_000, trips: 2, lastTripEnd: '2026-10-09', test: false, ...extra });
await t('person records their own deletion', 'allow', () => setDoc(doc(carol, '_deletions', 'carol'), del('carol')));
await t('record with no trip', 'allow', () => setDoc(doc(dave, '_deletions', 'dave'), del('dave', { trips: 0, lastTripEnd: null })));
await t("someone else's deletion", 'deny', () => setDoc(doc(bob, '_deletions', 'alice'), del('alice')));
await t('record under another id', 'deny', () => setDoc(doc(bob, '_deletions', 'x'), del('bob')));
await t('record with a name in it', 'deny', () => setDoc(doc(bob, '_deletions', 'bob'), del('bob', { displayName: 'Bob' })));
await t('record with a client timestamp', 'deny', () => setDoc(doc(bob, '_deletions', 'bob'), del('bob', { at: new Date(Date.now() - 60_000) })));
await t('record with a malformed trip date', 'deny', () => setDoc(doc(bob, '_deletions', 'bob'), del('bob', { lastTripEnd: 'soon' })));
await t('anon records a deletion', 'deny', () => setDoc(doc(anon, '_deletions', 'carol'), del('carol')));
const existingDeletion = () => testEnv.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), '_deletions', 'carol'), { ...del('carol'), at: new Date() }));
await t('overwrite a deletion record', 'deny', async () => { await existingDeletion(); return setDoc(doc(carol, '_deletions', 'carol'), del('carol', { trips: 9 })); });
await t('delete a deletion record', 'deny', async () => { await existingDeletion(); return deleteDoc(doc(carol, '_deletions', 'carol')); });
await t('owner lists deletions', 'allow', async () => { await existingDeletion(); return getDocs(collection(owner, '_deletions')); });
await t('person reads their own record', 'deny', async () => { await existingDeletion(); return getDoc(doc(carol, '_deletions', 'carol')); });
await t('admin lists deletions', 'deny', () => getDocs(collection(admin, '_deletions')));

console.log('\nWrite log (_writes)');
const wr = (uid, extra = {}) => ({ uid, tripId: 'T', kind: 'itinerary', action: 'added', at: serverTimestamp(), ...extra });
await t('member logs own write', 'allow', () => setDoc(doc(bob, '_writes', 'w1'), wr('bob')));
await t('write with spoofed uid', 'deny', () => setDoc(doc(bob, '_writes', 'w1'), wr('alice')));
await t('write with content field', 'deny', () => setDoc(doc(bob, '_writes', 'w1'), wr('bob', { summary: 'Dinner at Baixa' })));
await t('write with unknown kind', 'deny', () => setDoc(doc(bob, '_writes', 'w1'), wr('bob', { kind: 'photo' })));
await t('write with client timestamp', 'deny', () => setDoc(doc(bob, '_writes', 'w1'), wr('bob', { at: new Date(Date.now() - 60_000) })));
await t('anon logs a write', 'deny', () => setDoc(doc(anon, '_writes', 'w1'), wr('bob')));
await t('owner lists writes', 'allow', () => getDocs(collection(owner, '_writes')));
await t('member lists writes', 'deny', () => getDocs(collection(bob, '_writes')));
await t('admin (not the owner) lists writes', 'deny', () => getDocs(collection(admin, '_writes')));
await t('account without the owner claim lists writes', 'deny', () => getDocs(collection(fakeOwner, '_writes')));
await t('anon lists writes', 'deny', () => getDocs(collection(anon, '_writes')));


console.log('\nUsage events (_activity)');
const ev = (uid, extra = {}) => ({ uid, tripId: 'T', type: 'page', page: '/itinerary', at: serverTimestamp(), localHour: 10, tz: 'Europe/Berlin', tzOffsetMin: 120, platform: 'web', sessionId: 's2', appVersion: '0.9.0', ...extra });
await t('member creates own event', 'allow', () => setDoc(doc(bob, '_activity', 'e2'), ev('bob')));
await t('event with null tripId', 'allow', () => setDoc(doc(bob, '_activity', 'e2'), ev('bob', { tripId: null })));
await t('event type ping', 'allow', () => setDoc(doc(bob, '_activity', 'e2'), ev('bob', { type: 'ping' })));
await t('event with spoofed uid', 'deny', () => setDoc(doc(bob, '_activity', 'e2'), ev('alice')));
await t('event with extra field', 'deny', () => setDoc(doc(bob, '_activity', 'e2'), ev('bob', { email: 'x@y.z' })));
await t('event with unknown type', 'deny', () => setDoc(doc(bob, '_activity', 'e2'), ev('bob', { type: 'click' })));
await t('event with client timestamp', 'deny', () => setDoc(doc(bob, '_activity', 'e2'), ev('bob', { at: new Date(Date.now() - 60_000) })));
await t('event type offer with a partner id', 'allow', () => setDoc(doc(bob, '_activity', 'e3'), ev('bob', { type: 'offer', page: '/recs', offer: 'airalo' })));
await t('offer id on a page event', 'deny', () => setDoc(doc(bob, '_activity', 'e3'), ev('bob', { offer: 'airalo' })));
await t('offer event without an id', 'deny', () => setDoc(doc(bob, '_activity', 'e3'), ev('bob', { type: 'offer', page: '/recs' })));
await t('offer id too long', 'deny', () => setDoc(doc(bob, '_activity', 'e3'), ev('bob', { type: 'offer', page: '/recs', offer: 'x'.repeat(33) })));
await t('offer id with odd characters', 'deny', () => setDoc(doc(bob, '_activity', 'e3'), ev('bob', { type: 'offer', page: '/recs', offer: 'Airalo!' })));
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

console.log('\nSession age (90 days from the last password sign-in)');
await t('member with a fresh session reads the trip', 'allow', () => getDoc(doc(bob, 'trips', 'T')));
await t('member whose session is 91 days old reads the trip', 'deny', () => getDoc(doc(bobStale, 'trips', 'T')));
await t('stale session reads own trip index', 'deny', () => getDoc(doc(bobStale, 'userTrips', 'bob')));
await t('stale session reads own private account doc', 'deny', () => getDoc(doc(bobStale, 'users', 'bob', 'private', 'account')));
await t('stale session writes own expenses', 'deny', () => setDoc(doc(bobStale, 'userExpenses', 'bob'), { items: [] }));
await t('stale session leaves the trip (deletes own member doc)', 'deny', () => deleteDoc(doc(bobStale, 'trips', 'T', 'members', 'bob')));

await testEnv.cleanup();
console.log(`\n${fail === 0 ? '✅' : '❌'} rules tests: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
