#!/usr/bin/env node
/**
 * guests.js — guest accounts (#610, #654): people who opened an invite link
 * and joined a trip with just a name (anonymous sign-in, a profile marked
 * isGuest). A guest who never creates an account stays on their trips'
 * member lists; this lists them and removes the ones gone quiet.
 *
 *   node scripts/guests.js                          # list guests: joined, last seen, trips (production)
 *   node scripts/guests.js remove --older-than 90   # dry run: guests not seen for 90+ days
 *   node scripts/guests.js remove --older-than 90 --run
 *   add --staging to any of these for staging
 *
 * Removing a guest takes them off each trip (member doc, member count, the
 * trip's "joined" history stays), then deletes their trip index, profile and
 * sign-in. Only accounts still marked isGuest AND still anonymous in Auth are
 * touched; anyone who created an account is left alone. Real users' data:
 * run --run only with the owner's go-ahead.
 */
const path = require('path');
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const cmd = args.find(a => !a.startsWith('--') && !/^\d+$/.test(a)) ?? 'list';
const RUN = args.includes('--run');
const env = args.includes('--staging') ? 'staging' : 'production';
const PROJECT = { production: 'trip-planner-ayyjayy2', staging: 'the-itinerists-staging' }[env];
const KEY = { production: 'serviceAccountKey.json', staging: 'serviceAccountKey.staging.json' }[env];
const olderIdx = args.indexOf('--older-than');
const OLDER_DAYS = olderIdx >= 0 ? Number(args[olderIdx + 1]) : NaN;

const key = require(path.join(__dirname, KEY));
if (key.project_id !== PROJECT) throw new Error(`wrong project for ${env}: ${key.project_id}`);
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();
const DAY = 24 * 60 * 60 * 1000;
const day = ms => (ms ? new Date(ms).toISOString().slice(0, 10) : '—');

/** Every guest: profile, Auth record (null if the sign-in is already gone), trips, last seen. */
async function guests() {
  const snap = await db.collection('users').where('isGuest', '==', true).get();
  return Promise.all(snap.docs.map(async d => {
    const u = d.data();
    const auth = await admin.auth().getUser(d.id).catch(() => null);
    const trips = (await db.doc(`userTrips/${d.id}`).get()).data()?.tripIds ?? [];
    const lastSeen = Math.max(
      Date.parse(auth?.metadata.lastRefreshTime ?? '') || 0,
      Date.parse(auth?.metadata.lastSignInTime ?? '') || 0,
      u.createdAt ?? 0,
    );
    // Still a guest only if Auth agrees: no email or password linked.
    const anonymous = !!auth && auth.providerData.length === 0 && !auth.email;
    return { uid: d.id, createdAt: u.createdAt ?? 0, lastSeen, trips, anonymous, hasAuth: !!auth };
  }));
}

/** Take a guest off a trip: their member doc and one off the member count, if they were on it. */
async function leave(uid, tripId) {
  const member = db.doc(`trips/${tripId}/members/${uid}`);
  await db.runTransaction(async tx => {
    const [m, t] = await Promise.all([tx.get(member), tx.get(db.doc(`trips/${tripId}`))]);
    if (!m.exists) return;
    tx.delete(member);
    if (t.exists) tx.update(t.ref, { memberCount: admin.firestore.FieldValue.increment(-1) });
  });
}

(async () => {
  const all = (await guests()).sort((a, b) => b.lastSeen - a.lastSeen);
  if (cmd === 'list') {
    console.log(`${PROJECT}: ${all.length} ${all.length === 1 ? 'guest' : 'guests'}`);
    for (const g of all) {
      console.log(`  ${g.uid}  joined ${day(g.createdAt)}  last seen ${day(g.lastSeen)}  ${g.trips.length} ${g.trips.length === 1 ? 'trip' : 'trips'}${g.anonymous ? '' : g.hasAuth ? '  (has an account now: profile flag left over)' : '  (sign-in already deleted)'}`);
    }
  } else if (cmd === 'remove') {
    // 0 (everyone) only on staging, to try the removal on a guest made a minute ago.
    if (!(OLDER_DAYS >= (env === 'staging' ? 0 : 1))) throw new Error('say how quiet: --older-than <days> (at least 1)');
    const cutoff = Date.now() - OLDER_DAYS * DAY;
    const gone = all.filter(g => g.lastSeen < cutoff && (g.anonymous || !g.hasAuth));
    console.log(`${PROJECT}: ${gone.length} of ${all.length} guests not seen for ${OLDER_DAYS}+ days ${RUN ? '— removing' : '(dry run)'}`);
    for (const g of gone) {
      console.log(`  ${g.uid}  last seen ${day(g.lastSeen)}  ${g.trips.length} ${g.trips.length === 1 ? 'trip' : 'trips'}`);
      if (!RUN) continue;
      for (const tripId of g.trips) await leave(g.uid, tripId);
      await db.doc(`userTrips/${g.uid}`).delete();
      await db.doc(`users/${g.uid}`).delete();
      if (g.hasAuth) await admin.auth().deleteUser(g.uid);
    }
    if (!RUN && gone.length) console.log('Nothing removed. Add --run to remove them (only with the owner\'s go-ahead).');
  } else {
    throw new Error(`unknown command: ${cmd} (list, remove)`);
  }
})().catch(err => { console.error(err.message); process.exit(1); });
