// API console (staging only). Signs in with a staging account, checks that the
// owner approved it (_apiConsoleAccess/{uid}), then loads the request list from
// _apiConsole/spec and hands it to Swagger UI. The spec never ships in this file:
// an account that isn't approved sees nothing but the sign-in form.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';

// The staging project's web config, as committed in src/environments/environment.staging.ts.
const firebaseConfig = {
  apiKey:            'AIzaSyDIn_Ds44FTB5YEEAx4rxL_M6Xztprn6GY',
  authDomain:        'the-itinerists-staging.firebaseapp.com',
  projectId:         'the-itinerists-staging',
  storageBucket:     'the-itinerists-staging.firebasestorage.app',
  messagingSenderId: '165808904063',
  appId:             '1:165808904063:web:fe6edff38122c02b96ac4a',
};
const STAGING_HOSTS = ['the-itinerists-staging.web.app', 'the-itinerists-staging.firebaseapp.com', 'localhost', '127.0.0.1'];
const FIRESTORE_HOST = 'firestore.googleapis.com';

const $ = id => document.getElementById(id);
const show = (id, on = true) => { $(id).hidden = !on; };

if (!STAGING_HOSTS.includes(location.hostname)) {
  show('wrongHost');
  throw new Error('API console: not on staging');
}

// Its own app name keeps this page's sign-in separate from the app's on the same origin.
const app = initializeApp(firebaseConfig, 'api-console');
const auth = getAuth(app);
const db = getFirestore(app);
let ui = null;

$('signIn').addEventListener('submit', async e => {
  e.preventDefault();
  const user = $('user').value.trim(), pass = $('pass').value;
  show('signInError', false);
  if (!user || !pass) return signInError('Enter your username or email and your password.');
  $('signInBtn').disabled = true; $('signInBtn').textContent = 'Signing in…';
  try {
    await signInWithEmailAndPassword(auth, await emailFor(user), pass);
  } catch (err) {
    signInError(err?.code === 'auth/too-many-requests'
      ? 'Too many attempts. Wait a few minutes and try again.'
      : "That username or password didn't match a staging account. Check both and try again.");
    $('signInBtn').disabled = false; $('signInBtn').textContent = 'Sign in';
  }
});
$('signOut').addEventListener('click', () => signOut(auth));

function signInError(text) { $('signInError').textContent = text; show('signInError'); }

/** A username is looked up in usernames/{username}, as the app does; an email is used as typed. */
async function emailFor(user) {
  if (user.includes('@')) return user;
  const snap = await getDoc(doc(db, 'usernames', user.toLowerCase()));
  return snap.exists() ? snap.data().authEmail : `${user.toLowerCase()}@the-itinerists.local`;
}

onAuthStateChanged(auth, async u => {
  for (const id of ['signIn', 'denied', 'loading', 'loadError', 'ready', 'swagger', 'who']) show(id, false);
  if (!u) {
    $('signInBtn').disabled = false; $('signInBtn').textContent = 'Sign in';
    return show('signIn');
  }
  $('whoName').textContent = u.email ?? u.uid;
  show('who');
  try {
    const access = await getDoc(doc(db, '_apiConsoleAccess', u.uid));
    if (!access.exists()) return show('denied');
    show('loading');
    const [specSnap, userSnap, tripsSnap] = await Promise.all([
      getDoc(doc(db, '_apiConsole', 'spec')),
      getDoc(doc(db, 'users', u.uid)).catch(() => null),
      getDoc(doc(db, 'userTrips', u.uid)).catch(() => null),
    ]);
    if (!specSnap.exists()) throw new Error('No request list has been published yet. The owner publishes it with node scripts/api-console.js publish.');
    const trips = tripsSnap?.exists() ? tripsSnap.data() : {};
    const values = {
      uid: u.uid,
      username: userSnap?.exists() ? userSnap.data().username ?? '' : '',
      tripId: trips.lastActiveTrip ?? trips.tripIds?.[0] ?? '',
      apiKey: firebaseConfig.apiKey,
      email: u.email ?? '',
    };
    const spec = JSON.parse(specSnap.data().openapi.replace(/\{\{(\w+)\}\}/g, (m, k) => k in values ? values[k] : m));
    show('loading', false);
    show('ready'); show('swagger');
    renderSwagger(spec);
  } catch (err) {
    show('loading', false);
    $('loadError').textContent = err?.code === 'permission-denied'
      ? "This account can't read the request list. Ask the owner to approve it again."
      : (err?.message || "Couldn't load the request list. Reload the page and try again.");
    show('loadError');
  }
});

function renderSwagger(spec) {
  ui = window.SwaggerUIBundle({
    spec,
    dom_id: '#swagger',
    deepLinking: true,
    docExpansion: 'none',
    defaultModelsExpandDepth: -1,
    tryItOutEnabled: false,
    displayRequestDuration: true,
    filter: true,
    persistAuthorization: false,
    // Every Firestore request goes out as the signed-in account, with a fresh ID token.
    requestInterceptor: async req => {
      if (new URL(req.url).host === FIRESTORE_HOST && auth.currentUser && !req.headers.Authorization) {
        req.headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
      }
      return req;
    },
  });
  return ui;
}
