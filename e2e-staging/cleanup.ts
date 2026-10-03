import { apiKey, password, TAG } from './helpers';

/**
 * Runs after every staging check, pass or fail: deletes whatever the checks
 * created on the seeded trip (anything whose title or update text carries
 * "[check]"), over Firestore's REST API as the test account. Only the seeded
 * trip is touched, and only tagged documents.
 */
export default async function cleanup() {
  const key = apiKey();
  const signIn = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alayna@the-itinerists.local', password: password('alayna'), returnSecureToken: true }),
  }).then(r => r.json());
  if (!signIn.idToken) { console.warn('[cleanup] could not sign in; nothing removed'); return; }
  const base = 'https://firestore.googleapis.com/v1/projects/the-itinerists-staging/databases/(default)/documents';
  const headers = { Authorization: `Bearer ${signIn.idToken}` };
  const trips = await fetch(`${base}/userTrips/${signIn.localId}`, { headers }).then(r => r.json());
  const tripId = trips.fields?.lastActiveTrip?.stringValue;
  if (!tripId) return;
  let removed = 0;
  for (const col of ['itinerary', 'finance', 'events', 'activityLog']) {
    const list = await fetch(`${base}/trips/${tripId}/${col}?pageSize=300`, { headers }).then(r => r.json());
    for (const doc of list.documents ?? []) {
      if (!JSON.stringify(doc.fields ?? {}).includes(TAG)) continue;
      await fetch(`https://firestore.googleapis.com/v1/${doc.name}`, { method: 'DELETE', headers });
      removed++;
    }
  }
  console.log(`[cleanup] removed ${removed} test document(s) from the seeded trip`);
}
