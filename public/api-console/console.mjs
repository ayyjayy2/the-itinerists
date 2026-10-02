// API console (staging only). Signs in with a staging account, checks that the
// owner approved it (_apiConsoleAccess/{uid}), then loads the request list from
// _apiConsole/spec and hands it to Swagger UI. The spec never ships in this file:
// an account that isn't approved sees nothing but the sign-in form.
//
// Speed: Firestore is read with plain REST calls (one batch for your access,
// profile and trips, in parallel with the spec), so the page doesn't load the
// Firestore SDK or open its streaming connection. On a return visit the last
// request list shows at once from this browser, while access is checked again
// in the background; if access was taken away, it is cleared from the page and
// the browser.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js';

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
const DB = `projects/${firebaseConfig.projectId}/databases/(default)/documents`;
const REST = `https://${FIRESTORE_HOST}/v1/${DB}`;
const CACHE_KEY = uid => `apiConsole.spec.${uid}`;

const $ = id => document.getElementById(id);
const show = (id, on = true) => { $(id).hidden = !on; };

// Staging preview channels (the-itinerists-staging--<name>-<id>.web.app) count as staging too.
const onStaging = STAGING_HOSTS.includes(location.hostname) || /^the-itinerists-staging--[\w-]+\.web\.app$/.test(location.hostname);
if (!onStaging) {
  show('wrongHost');
  throw new Error('API console: not on staging');
}

// Its own app name keeps this page's sign-in separate from the app's on the same origin.
const app = initializeApp(firebaseConfig, 'api-console');
const auth = getAuth(app);
let shownSpec = null;   // the spec text Swagger is showing, so an unchanged refresh doesn't re-render

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

// ── Firestore over REST ────────────────────────────────────────────────────
/** Firestore's typed value → plain JS (only the types these docs use). */
function plain(v) {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(plain);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, plain(x)]));
  return null;
}
const fieldsOf = d => Object.fromEntries(Object.entries(d?.fields ?? {}).map(([k, v]) => [k, plain(v)]));

async function rest(path, init = {}, token) {
  const res = await fetch(REST + path, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (res.status === 403) { const e = new Error('permission-denied'); e.code = 'permission-denied'; throw e; }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore answered ${res.status}. Reload the page and try again.`);
  return res.json();
}
/** Several docs in one round trip: path → fields, or null when the doc doesn't exist. */
async function batchGet(paths, token) {
  const rows = await rest(':batchGet', { method: 'POST', body: JSON.stringify({ documents: paths.map(p => `${DB}/${p}`) }) }, token);
  const out = {};
  for (const r of rows ?? []) {
    const name = (r.found?.name ?? r.missing).slice(DB.length + 1);
    out[name] = r.found ? fieldsOf(r.found) : null;
  }
  return out;
}

/** A username is looked up in usernames/{username} (readable by anyone), as the app does. */
async function emailFor(user) {
  if (user.includes('@')) return user;
  const doc = await rest(`/usernames/${encodeURIComponent(user.toLowerCase())}`).catch(() => null);
  return doc ? fieldsOf(doc).authEmail : `${user.toLowerCase()}@the-itinerists.local`;
}

// ── page states ────────────────────────────────────────────────────────────
function resetViews() {
  for (const id of ['signIn', 'denied', 'loading', 'loadError', 'ready', 'swagger', 'who']) show(id, false);
}
function clearSwagger() { $('swagger').replaceChildren(); shownSpec = null; }
function readCache(uid) { try { return JSON.parse(localStorage.getItem(CACHE_KEY(uid)) ?? 'null'); } catch { return null; } }
function writeCache(uid, entry) { try { localStorage.setItem(CACHE_KEY(uid), JSON.stringify(entry)); } catch { /* storage full or blocked */ } }
function dropCache(uid) { try { localStorage.removeItem(CACHE_KEY(uid)); } catch { /* blocked */ } }

onAuthStateChanged(auth, async u => {
  resetViews();
  if (!u) {
    clearSwagger();
    $('signInBtn').disabled = false; $('signInBtn').textContent = 'Sign in';
    return show('signIn');
  }
  $('whoName').textContent = u.email ?? u.uid;
  show('who');

  // Return visit: show the last request list straight away, then check access again.
  const cached = readCache(u.uid);
  if (cached?.text) render(cached.text, cached.values);
  else show('loading');

  try {
    const token = await u.getIdToken();
    const [docs, spec] = await Promise.all([
      batchGet([`_apiConsoleAccess/${u.uid}`, `users/${u.uid}`, `userTrips/${u.uid}`], token),
      rest('/_apiConsole/spec', {}, token).catch(err => { if (err.code === 'permission-denied') return 'denied'; throw err; }),
    ]);
    if (auth.currentUser?.uid !== u.uid) return;   // signed out or switched while loading
    show('loading', false);
    if (!docs[`_apiConsoleAccess/${u.uid}`] || spec === 'denied') {
      dropCache(u.uid); clearSwagger(); show('ready', false); show('swagger', false);
      return show('denied');
    }
    if (!spec) throw new Error('No request list has been published yet. The owner publishes it with node scripts/api-console.js publish.');
    const trips = docs[`userTrips/${u.uid}`] ?? {};
    const values = {
      uid: u.uid,
      username: docs[`users/${u.uid}`]?.username ?? '',
      tripId: trips.lastActiveTrip ?? trips.tripIds?.[0] ?? '',
      apiKey: firebaseConfig.apiKey,
      email: u.email ?? '',
    };
    const text = fieldsOf(spec).openapi;
    writeCache(u.uid, { text, values });
    render(text, values);
  } catch (err) {
    show('loading', false);
    if (shownSpec) return;   // the cached list is still usable; a later visit refreshes it
    $('loadError').textContent = err?.message || "Couldn't load the request list. Reload the page and try again.";
    show('loadError');
  }
});

function render(text, values) {
  const filled = text.replace(/\{\{(\w+)\}\}/g, (m, k) => k in values ? values[k] : m);
  if (filled === shownSpec) return;
  shownSpec = filled;
  show('ready'); show('swagger');
  window.SwaggerUIBundle({
    spec: JSON.parse(filled),
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
}
