/**
 * seed-admin-client.mjs
 *
 * Creates the Makaela admin user using the Firebase client SDK.
 * Run: node scripts/seed-admin-client.mjs
 */

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            'AIzaSyAWs9Dkhf1RlAQUgCAFarthHpuHHm01Xkc',
  authDomain:        'savannah-getaway.firebaseapp.com',
  projectId:         'savannah-getaway',
  storageBucket:     'savannah-getaway.firebasestorage.app',
  messagingSenderId: '383826917625',
  appId:             '1:383826917625:web:2502d195e539600e730a28',
};

const EMAIL    = 'makaela@savannah-getaway.local';
const PASSWORD = 'AdminMj96!';

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

  console.log('\n✓ Done! Login with:  makaela / AdminMj96!');
  process.exit(0);
}

main().catch(err => {
  console.error('ERROR:', err.code, err.message);
  process.exit(1);
});
