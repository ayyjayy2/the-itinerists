#!/usr/bin/env node
/**
 * Create a throwaway account and add it to an existing trip as a plain member,
 * so a feature (e.g. Delete Account) can be tested with a real login.
 *
 *   node scripts/create-test-member.js <tripId> <username> "<Display Name>" [emoji]
 *
 * Writes the generated password to scripts/test-account.local.json (gitignored).
 * Uses scripts/serviceAccountKey.json; refuses to run against any other project.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

const [tripId, username, displayName, emoji = '🧪'] = process.argv.slice(2);
if (!tripId || !username || !displayName) {
  console.error('usage: node scripts/create-test-member.js <tripId> <username> "<Display Name>" [emoji]');
  process.exit(1);
}

const key = require('./serviceAccountKey.json');
if (key.project_id !== 'trip-planner-ayyjayy2') throw new Error('wrong project: ' + key.project_id);
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

function makePassword() {
  // Satisfies the app's rules: 8+ chars, upper, lower, digit.
  return 'Tt' + crypto.randomBytes(6).toString('base64url').replace(/[^A-Za-z0-9]/g, 'x') + '7';
}

(async () => {
  const uname = username.toLowerCase().trim();
  const tripRef = db.collection('trips').doc(tripId);
  const trip = await tripRef.get();
  if (!trip.exists) throw new Error('no such trip ' + tripId);
  if ((await db.collection('usernames').doc(uname).get()).exists) throw new Error('username already exists: ' + uname);

  const email = `${uname}@the-itinerists.local`;
  const password = makePassword();
  const user = await admin.auth().createUser({ email, password, displayName });
  const now = Date.now();
  const color = '#C8D5B9';

  await db.collection('users').doc(user.uid).set({
    uid: user.uid, displayName, username: uname, avatarEmoji: emoji, color,
    isAdmin: false, isDisabled: false, createdAt: now,
  });
  // Sign-in address lives in the private account doc and the username index, never on the profile.
  await db.collection('users').doc(user.uid).collection('private').doc('account').set({ authEmail: email });
  await db.collection('usernames').doc(uname).set({ uid: user.uid, authEmail: email });
  await tripRef.collection('members').doc(user.uid).set({
    uid: user.uid, role: 'member', displayName, avatarEmoji: emoji, color, joinedAt: now,
  });
  await db.collection('userTrips').doc(user.uid).set({ tripIds: [tripId], lastActiveTrip: tripId });
  await tripRef.update({ memberCount: admin.firestore.FieldValue.increment(1) });

  const out = path.join(__dirname, 'test-account.local.json');
  const existing = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : [];
  existing.push({ username: uname, password, uid: user.uid, tripId, trip: trip.data().name, createdAt: new Date(now).toISOString() });
  fs.writeFileSync(out, JSON.stringify(existing, null, 2) + '\n');

  console.log(`created @${uname} (${user.uid}) as a member of "${trip.data().name}"`);
  console.log(`password saved to ${path.relative(process.cwd(), out)}`);
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
