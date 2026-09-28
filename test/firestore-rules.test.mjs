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
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs,
} from 'firebase/firestore';

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-tripplanner',
  firestore: { rules: readFileSync('firestore.rules', 'utf8') },
});

// Actors
const alice = testEnv.authenticatedContext('alice').firestore(); // trip owner
const bob   = testEnv.authenticatedContext('bob').firestore();   // trip member
const carol = testEnv.authenticatedContext('carol').firestore(); // signed in, NOT a member
const dave  = testEnv.authenticatedContext('dave').firestore();  // signed in, brand new
const admin = testEnv.authenticatedContext('admin').firestore(); // app admin (isAdmin), not a member
const anon  = testEnv.unauthenticatedContext().firestore();      // logged out

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await Promise.all([
      setDoc(doc(db, 'users', 'alice'), { uid: 'alice', username: 'alice', isAdmin: false }),
      setDoc(doc(db, 'users', 'bob'),   { uid: 'bob',   username: 'bob',   isAdmin: false }),
      setDoc(doc(db, 'users', 'carol'), { uid: 'carol', username: 'carol', isAdmin: false }),
      setDoc(doc(db, 'users', 'admin'), { uid: 'admin', username: 'admin', isAdmin: true }),
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
      setDoc(doc(db, 'trips', 'T', 'invites', 'CODE1'), { tripId: 'T', usedBy: [] }),
      setDoc(doc(db, 'inviteIndex', 'CODE1'), { tripId: 'T', expiresAt: 9999999999999 }),
      setDoc(doc(db, 'userTrips', 'alice'), { tripIds: ['T'] }),
      setDoc(doc(db, 'userTrips', 'bob'),   { tripIds: ['T'] }),
      setDoc(doc(db, 'userExpenses', 'bob'), { items: [] }),
      // A trip carol created but hasn't added her member doc to yet (for the
      // legit "trip creator self-adds as owner" case).
      setDoc(doc(db, 'trips', 'TC'), { name: 'Carol Trip', createdBy: 'carol', memberCount: 0 }),
      setDoc(doc(db, 'geocache', 'g1'), { x: 1 }),
      setDoc(doc(db, '_appLogs', 'l1'), { m: 'hi' }),
    ]);
  });
}

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
await t('anon reads trip', 'deny', () => getDoc(doc(anon, 'trips', 'T')));
await t('member updates trip', 'allow', () => updateDoc(doc(bob, 'trips', 'T'), { memberCount: 3 }));
await t('non-member updates trip', 'deny', () => updateDoc(doc(carol, 'trips', 'T'), { memberCount: 3 }));
await t('create trip with own createdBy', 'allow', () => setDoc(doc(carol, 'trips', 'T2'), { name: 'n', createdBy: 'carol' }));
await t('create trip with foreign createdBy', 'deny', () => setDoc(doc(carol, 'trips', 'T3'), { name: 'n', createdBy: 'alice' }));
await t('member deletes trip (last-out purge)', 'allow', () => deleteDoc(doc(bob, 'trips', 'T')));
await t('non-member deletes trip', 'deny', () => deleteDoc(doc(carol, 'trips', 'T')));

console.log('\nMembers');
await t('member reads members', 'allow', () => getDoc(doc(bob, 'trips', 'T', 'members', 'alice')));
await t('non-member reads members', 'deny', () => getDoc(doc(carol, 'trips', 'T', 'members', 'alice')));
await t('self-join: create own member doc', 'allow', () => setDoc(doc(carol, 'trips', 'T', 'members', 'carol'), { uid: 'carol', role: 'member' }));
await t('create a member doc for someone else', 'deny', () => setDoc(doc(carol, 'trips', 'T', 'members', 'dave'), { uid: 'dave', role: 'member' }));
await t('owner changes another member role', 'allow', () => updateDoc(doc(alice, 'trips', 'T', 'members', 'bob'), { role: 'owner' }));
await t('non-owner edits another member', 'deny', () => updateDoc(doc(bob, 'trips', 'T', 'members', 'alice'), { role: 'member' }));
await t('member edits own member doc', 'allow', () => updateDoc(doc(bob, 'trips', 'T', 'members', 'bob'), { hiddenPages: ['recs'] }));
await t('member deletes own member doc (leave)', 'allow', () => deleteDoc(doc(bob, 'trips', 'T', 'members', 'bob')));
await t('non-owner removes another member', 'deny', () => deleteDoc(doc(bob, 'trips', 'T', 'members', 'alice')));
await t('admin removes a member', 'allow', () => deleteDoc(doc(admin, 'trips', 'T', 'members', 'bob')));

console.log('\nInvites (pre-auth join reads these)');
await t('anon reads invite by code', 'allow', () => getDoc(doc(anon, 'trips', 'T', 'invites', 'CODE1')));
await t('member creates an invite', 'allow', () => setDoc(doc(alice, 'trips', 'T', 'invites', 'CODE2'), { tripId: 'T', usedBy: [] }));
await t('non-member creates an invite', 'deny', () => setDoc(doc(carol, 'trips', 'T', 'invites', 'CODE3'), { tripId: 'T', usedBy: [] }));
await t('owner closes (deletes) an invite', 'allow', () => deleteDoc(doc(alice, 'trips', 'T', 'invites', 'CODE1')));
await t('plain member closes an invite', 'deny', () => deleteDoc(doc(bob, 'trips', 'T', 'invites', 'CODE1')));
await t('owner removes the invite index entry', 'allow', () => deleteDoc(doc(alice, 'inviteIndex', 'CODE1')));

console.log('\ninviteIndex (global, pre-auth)');
await t('anon reads inviteIndex', 'allow', () => getDoc(doc(anon, 'inviteIndex', 'CODE1')));
await t('signed-in writes inviteIndex', 'allow', () => setDoc(doc(carol, 'inviteIndex', 'CODE9'), { tripId: 'T', expiresAt: 1 }));
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
await t('take over an existing username', 'deny', () => setDoc(doc(dave, 'usernames', 'alice'), { uid: 'dave', authEmail: 'dave@example.com' }));
await t('owner updates own username entry', 'allow', () => updateDoc(doc(bob, 'usernames', 'bob'), { pendingEmail: 'bob2@example.com' }));
await t('owner reassigns own entry to another uid', 'deny', () => updateDoc(doc(bob, 'usernames', 'bob'), { uid: 'alice' }));
await t('another user updates username entry', 'deny', () => updateDoc(doc(alice, 'usernames', 'bob'), { authEmail: 'x' }));
await t('owner releases own username', 'allow', () => deleteDoc(doc(bob, 'usernames', 'bob')));
await t('another user releases a username', 'deny', () => deleteDoc(doc(alice, 'usernames', 'bob')));
await t('admin releases a username', 'allow', () => deleteDoc(doc(admin, 'usernames', 'bob')));
await t('create own user doc', 'allow', () => setDoc(doc(dave, 'users', 'dave'), { uid: 'dave', username: 'dave', isAdmin: false }));
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
await t('member reads packingSuggestions', 'allow', () => getDoc(doc(bob, 'trips', 'T', 'packingSuggestions', 's1')));
await t('member writes removedMembers snapshot', 'allow', () => setDoc(doc(alice, 'trips', 'T', 'removedMembers', 'bob'), { uid: 'bob', displayName: 'Bob' }));
await t('non-member reads removedMembers', 'deny', () => getDoc(doc(carol, 'trips', 'T', 'removedMembers', 'bob')));
await t('non-member writes packing', 'deny', () => setDoc(doc(carol, 'trips', 'T', 'packing', 'carol'), { items: [] }));

console.log('\nShared/misc collections');
await t('signed-in reads geocache', 'allow', () => getDoc(doc(bob, 'geocache', 'g1')));
await t('anon reads geocache', 'deny', () => getDoc(doc(anon, 'geocache', 'g1')));
await t('signed-in writes geocache', 'allow', () => setDoc(doc(bob, 'geocache', 'g2'), { x: 2 }));
await t('anon creates _appLogs', 'allow', () => setDoc(doc(anon, '_appLogs', 'l2'), { m: 'y' }));
await t('anon reads _appLogs', 'deny', () => getDoc(doc(anon, '_appLogs', 'l1')));

console.log('\nPrivilege-escalation locks');
// users: a user must not be able to grant themselves admin / un-disable themselves
await t('self cannot set isAdmin=true (update)', 'deny', () => updateDoc(doc(bob, 'users', 'bob'), { isAdmin: true }));
await t('self cannot create own doc as admin', 'deny', () => setDoc(doc(dave, 'users', 'dave'), { uid: 'dave', username: 'dave', isAdmin: true }));
await t('self can edit non-privileged profile fields', 'allow', () => updateDoc(doc(bob, 'users', 'bob'), { displayName: 'Bobby' }));
await t('self cannot change own isDisabled', 'deny', () => updateDoc(doc(bob, 'users', 'bob'), { isDisabled: true }));
await t('admin can set isAdmin on another user', 'allow', () => updateDoc(doc(admin, 'users', 'bob'), { isAdmin: true }));
// members: a self-joining member must not be able to make themselves owner
await t('self-join cannot self-assign owner role', 'deny', () => setDoc(doc(carol, 'trips', 'T', 'members', 'carol'), { uid: 'carol', role: 'owner' }));
await t('self-join creates as plain member', 'allow', () => setDoc(doc(carol, 'trips', 'T', 'members', 'carol'), { uid: 'carol', role: 'member' }));
await t('trip creator may self-add as owner', 'allow', () => setDoc(doc(carol, 'trips', 'TC', 'members', 'carol'), { uid: 'carol', role: 'owner' }));
await t('member cannot self-promote to owner', 'deny', () => updateDoc(doc(bob, 'trips', 'T', 'members', 'bob'), { role: 'owner' }));

console.log('\nOutfit photos (owner-private)');
await t('owner reads own outfit photo', 'allow', () => getDoc(doc(bob, 'trips', 'T', 'outfitPhotos', '2026-01-01_bob')));
await t('member reads another member photo', 'deny', () => getDoc(doc(alice, 'trips', 'T', 'outfitPhotos', '2026-01-01_bob')));
await t('non-member reads a photo', 'deny', () => getDoc(doc(carol, 'trips', 'T', 'outfitPhotos', '2026-01-01_bob')));
await t('anon reads a photo', 'deny', () => getDoc(doc(anon, 'trips', 'T', 'outfitPhotos', '2026-01-01_bob')));
await t('owner creates own photo', 'allow', () => setDoc(doc(alice, 'trips', 'T', 'outfitPhotos', '2026-01-02_alice'), { dataUrl: 'data:y', ownerUid: 'alice', date: '2026-01-02' }));
await t('create photo with spoofed ownerUid', 'deny', () => setDoc(doc(alice, 'trips', 'T', 'outfitPhotos', '2026-01-02_alice'), { dataUrl: 'data:y', ownerUid: 'bob', date: '2026-01-02' }));
await t('non-member creates a photo', 'deny', () => setDoc(doc(carol, 'trips', 'T', 'outfitPhotos', '2026-01-02_carol'), { dataUrl: 'data:z', ownerUid: 'carol', date: '2026-01-02' }));
await t('owner updates own photo', 'allow', () => updateDoc(doc(bob, 'trips', 'T', 'outfitPhotos', '2026-01-01_bob'), { dataUrl: 'data:new' }));
await t('member updates another member photo', 'deny', () => updateDoc(doc(alice, 'trips', 'T', 'outfitPhotos', '2026-01-01_bob'), { dataUrl: 'data:hack' }));
await t('owner deletes own photo', 'allow', () => deleteDoc(doc(bob, 'trips', 'T', 'outfitPhotos', '2026-01-01_bob')));
await t('non-member deletes a photo', 'deny', () => deleteDoc(doc(carol, 'trips', 'T', 'outfitPhotos', '2026-01-01_bob')));

await testEnv.cleanup();
console.log(`\n${fail === 0 ? '✅' : '❌'} rules tests: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
