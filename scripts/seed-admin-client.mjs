/**
 * seed-admin-client.mjs
 *
 * Creates the Makaela admin user using the Firebase client SDK.
 * Run: node scripts/seed-admin-client.mjs
 */

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { readEnv } from './read-env.js';

const env = readEnv();
const firebaseConfig = {
  apiKey:            env.FIREBASE_API_KEY,
  authDomain:        env.FIREBASE_AUTH_DOMAIN,
  projectId:         env.FIREBASE_PROJECT_ID,
  storageBucket:     env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.FIREBASE_APP_ID,
};

const EMAIL    = env.SEED_ADMIN_EMAIL;
const PASSWORD = env.SEED_ADMIN_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('ERROR: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env');
  process.exit(1);
}

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

async function main() {
  let uid;

  // Try to sign in first (user may already exist in Auth)
  try {
    const cred = await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
    uid = cred.user.uid;
    console.log(`Auth user already exists: ${uid}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-email') {
      // Create new
      const cred = await createUserWithEmailAndPassword(auth, EMAIL, PASSWORD);
      uid = cred.user.uid;
      console.log(`Created Auth user: ${uid}`);
    } else {
      throw err;
    }
  }

  // Write Firestore profile
  const userRef  = doc(db, 'users', uid);
  const existing = await getDoc(userRef);

  if (existing.exists()) {
    console.log('Firestore profile already exists.');
    // Make sure isAdmin is set
    await setDoc(userRef, { isAdmin: true }, { merge: true });
    console.log('Ensured isAdmin=true');
  } else {
    await setDoc(userRef, {
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

  console.log('\n✓ Done! Login with the credentials from .env');
  process.exit(0);
}

main().catch(err => {
  console.error('ERROR:', err.code, err.message);
  process.exit(1);
});
