#!/usr/bin/env node
/**
 * reset-password.js — admin fallback for accounts without a recovery email.
 *
 * Usage: node scripts/reset-password.js <username> <temp-password>
 *
 * Requires scripts/serviceAccountKey.json for THIS project
 * (trip-planner-ayyjayy2). The temp password must meet the server policy
 * (min 8, upper + lower + number) or Identity Platform rejects it.
 */
const admin = require('firebase-admin');
const path  = require('path');

const [username, tempPassword] = process.argv.slice(2);
if (!username || !tempPassword) {
  console.error('Usage: node scripts/reset-password.js <username> <temp-password>');
  process.exit(1);
}

const KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });

async function main() {
  const db   = admin.firestore();
  const snap = await db.collection('users')
    .where('username', '==', username.toLowerCase().trim()).limit(1).get();
  if (snap.empty) { console.error(`No user with username "${username}".`); process.exit(1); }

  const { uid, authEmail } = snap.docs[0].data();
  await admin.auth().updateUser(uid, { password: tempPassword });
  console.log(`✓ Password reset for ${username} (uid ${uid}, signs in via ${authEmail ?? 'synthetic email'}).`);
  console.log('  Share the temp password out-of-band; they should change it in Profile.');
  await admin.app().delete();
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
