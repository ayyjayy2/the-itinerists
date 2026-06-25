#!/usr/bin/env node
/**
 * seed-admin.js
 *
 * Creates the Makaela admin user in Firebase Auth + Firestore.
 * Safe to re-run — skips creation if the user already exists.
 *
 * Run: node scripts/seed-admin.js
 */

const admin = require('firebase-admin');
const path  = require('path');

const KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(require(KEY_PATH)),
});

const auth = admin.auth();
const db   = admin.firestore();

const EMAIL    = 'makaela@trip-planner.local';
const PASSWORD = 'AdminMj96!';

async function main() {
  let uid;

  // Create or find Auth user
  try {
    const existing = await auth.getUserByEmail(EMAIL);
    console.log(`Auth user already exists: ${existing.uid}`);
    uid = existing.uid;
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const newUser = await auth.createUser({ email: EMAIL, password: PASSWORD });
      console.log(`Created Auth user: ${newUser.uid}`);
      uid = newUser.uid;
    } else {
      throw err;
    }
  }

  // Create or update Firestore profile
  const userRef  = db.doc(`users/${uid}`);
  const existing = await userRef.get();

  if (existing.exists) {
    console.log('Firestore profile already exists — ensuring isAdmin=true');
    await userRef.update({ isAdmin: true });
  } else {
    await userRef.set({
      uid,
      displayName:  'Makaela',
      username:     'makaela',
      avatarEmoji:  '🌸',
      color:        '#F5B5D4',
      isAdmin:      true,
      isDisabled:   false,
      createdAt:    Date.now(),
    });
    console.log('Firestore profile created.');
  }

  console.log('\n✓ Admin user ready — login with: makaela / AdminMj96!');
  await admin.app().delete();
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
