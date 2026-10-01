#!/usr/bin/env node
/**
 * mark-test-accounts.js
 *
 * Flags throwaway test accounts so their actions never reach other people's
 * feeds. For each tester uid it sets `isTest: true` on users/{uid} and on
 * every trips/{trip}/members/{uid} and removedMembers/{uid} record, and marks
 * `test: true` on every trips/{trip}/events doc that the tester did or that
 * was done to them (member events name them in the summary).
 *
 * Tester uids come from Pulse's hand-kept list (_pulse/prefs.testUsers) plus
 * any uids given on the command line. Pulse's test trips (_pulse/prefs.testTrips)
 * get `isTest: true` on the trip doc, so tester activity still shows there.
 *
 * Accounts whose display name starts with "Tester" (the create-test-member
 * convention) count too, found on users/, members/ and removedMembers/ — so a
 * tester whose profile was deleted after being removed is still recognised
 * from the name left on the trip.
 *
 * Dry run (default):  node scripts/mark-test-accounts.js [uid ...]
 * Apply:              node scripts/mark-test-accounts.js --run [uid ...]
 */
const NAME_PREFIX = /^Tester\b/i;
const admin = require('firebase-admin');
const key = require('./serviceAccountKey.json');
if (key.project_id !== 'trip-planner-ayyjayy2') throw new Error('wrong project: ' + key.project_id);
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

const args = process.argv.slice(2);
const RUN = args.includes('--run');
const extraUids = args.filter(a => !a.startsWith('--'));

(async () => {
  const prefs = await db.collection('_pulse').doc('prefs').get();
  const uids = new Set([...(prefs.exists ? prefs.data().testUsers ?? [] : []), ...extraUids]);
  const testTrips = new Set(prefs.exists ? prefs.data().testTrips ?? [] : []);
  if (!uids.size && !testTrips.size) { console.log('Nothing to do: Pulse prefs has no testUsers or testTrips and no uids were given.'); return; }

  // Names by uid, from profiles and from member / removed-member records (a
  // deleted tester lives on only there). Any "Tester …" name is a tester.
  const names = new Map();
  const noteName = (uid, name) => { if (name && !names.get(uid)) names.set(uid, name); };
  for (const uid of uids) {
    const u = await db.collection('users').doc(uid).get();
    if (u.exists) noteName(uid, u.data().displayName);
  }
  const allUsers = await db.collection('users').get();
  for (const u of allUsers.docs) if (NAME_PREFIX.test(u.data().displayName ?? '')) { uids.add(u.id); noteName(u.id, u.data().displayName); }
  const tripsForNames = await db.collection('trips').get();
  for (const t of tripsForNames.docs) {
    for (const sub of ['members', 'removedMembers']) {
      const col = await t.ref.collection(sub).get();
      for (const m of col.docs) if (NAME_PREFIX.test(m.data().displayName ?? '')) { uids.add(m.id); noteName(m.id, m.data().displayName); }
    }
  }
  console.log(`${RUN ? 'Applying to' : 'Would flag'} ${uids.size} tester account(s) and ${testTrips.size} test trip(s).`);
  for (const [uid, name] of names) console.log(`  tester ${uid}: ${name}`);

  let writes = 0;
  const batchWrite = async (ref, data) => {
    writes++;
    if (RUN) await ref.set(data, { merge: true });
  };

  for (const uid of uids) await batchWrite(db.collection('users').doc(uid), { isTest: true });

  const trips = await db.collection('trips').get();
  for (const t of trips.docs) {
    if (testTrips.has(t.id) && !t.data().isTest) { console.log(`  test trip ${t.id}: ${t.data().name}`); await batchWrite(t.ref, { isTest: true }); }
    for (const sub of ['members', 'removedMembers']) {
      for (const uid of uids) {
        const ref = t.ref.collection(sub).doc(uid);
        if ((await ref.get()).exists) await batchWrite(ref, { isTest: true });
      }
    }
    const events = await t.ref.collection('events').get();
    for (const e of events.docs) {
      const d = e.data();
      if (d.test) continue;
      const byTester = uids.has(d.actorUid);
      const toTester = d.targetUid ? uids.has(d.targetUid)
        : d.kind === 'member' && ([...names.values()].some(n => n && (d.summary ?? '').endsWith(n))
                                   || /\bTester\b/i.test(d.summary ?? ''));
      if (byTester || toTester) {
        console.log(`  event ${t.id}/${e.id}: "${d.actorName} ${d.summary}"`);
        await batchWrite(e.ref, { test: true });
      }
    }
  }
  console.log(`${RUN ? 'Wrote' : 'Would write'} ${writes} document(s).${RUN ? '' : ' Re-run with --run to apply.'}`);
})().catch(err => { console.error(err); process.exit(1); });
