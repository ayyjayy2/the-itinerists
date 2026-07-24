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
  apiKey:            'AIzaSyAhu_RR_cGScZm6GZ96tC_f_kn5Qhbgl3M',
  authDomain:        'trip-planner-ayyjayy2.firebaseapp.com',
  projectId:         'trip-planner-ayyjayy2',
  storageBucket:     'trip-planner-ayyjayy2.firebasestorage.app',
  messagingSenderId: '861993541272',
  appId:             '1:861993541272:web:e18a674f266db2ce543aed',
};

const EMAIL    = 'makaela@the-itinerists.local';
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
