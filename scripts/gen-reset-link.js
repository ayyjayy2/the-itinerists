#!/usr/bin/env node
/**
 * gen-reset-link.js — print a Firebase password-reset link for a username.
 *
 * Usage: node scripts/gen-reset-link.js <username>
 *
 * Looks up the username in Firestore (same as reset-password.js), then
 * generates a reset link for the account's auth email. The link is printed
 * here, not emailed — open it to choose a new password yourself.
 */
const admin = require('firebase-admin');
const path  = require('path');

const [username] = process.argv.slice(2);
if (!username) {
  console.error('Usage: node scripts/gen-reset-link.js <username>');
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
  const userRecord = await admin.auth().getUser(uid);
  const email = authEmail ?? userRecord.email;
  console.log(`Account: ${username} (uid ${uid}), auth email: ${email}`);

  const link = await admin.auth().generatePasswordResetLink(email);
  console.log('\nPassword reset link (open in browser, set a new password):\n');
  console.log(link);
  await admin.app().delete();
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
