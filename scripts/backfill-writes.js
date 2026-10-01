#!/usr/bin/env node
/**
 * Seeds the `_writes` log (what Pulse charts as "things written per day") from
 * the creation timestamps that already exist on trip content, for everything
 * written before the app started logging writes itself. Kind and action only,
 * never content. Idempotent: skips if any backfilled row exists.
 *
 *   node scripts/backfill-writes.js          # dry run
 *   node scripts/backfill-writes.js --run    # write
 */
const admin = require('firebase-admin');
const key = require(require('path').join(__dirname, 'serviceAccountKey.json'));
if (key.project_id !== 'trip-planner-ayyjayy2') throw new Error('wrong project: ' + key.project_id);
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();
const RUN = process.argv.includes('--run');
const KIND = { itinerary: 'itinerary', finance: 'finance', flights: 'flight', stays: 'stay', cars: 'transport', recs: 'rec', packingSuggestions: 'packing', members: 'member' };
const ms = v => v?.toDate ? v.toDate().getTime() : (typeof v === 'number' ? v : (typeof v === 'string' ? Date.parse(v) : NaN));
(async () => {
  const already = await db.collection('_writes').where('backfilled', '==', true).limit(1).get();
  if (!already.empty) { console.log('already backfilled; nothing to do'); process.exit(0); }
  const cutoff = Date.now();
  const rows = [];
  const trips = await db.collection('trips').get();
  for (const t of trips.docs) {
    const x = t.data();
    if (x.createdBy && !isNaN(ms(x.createdAt))) rows.push({ uid: x.createdBy, tripId: t.id, kind: 'trip', action: 'added', at: ms(x.createdAt) });
    for (const [sub, kind] of Object.entries(KIND)) {
      const snap = await t.ref.collection(sub).get();
      for (const d of snap.docs) {
        const y = d.data();
        const uid = y.addedByUid ?? y.uid ?? y.createdBy ?? y.fromUid ?? (sub === 'members' ? d.id : null);
        const at = ms(y.createdAt ?? y.joinedAt ?? y.sentAt);
        if (!uid || isNaN(at) || at > cutoff) continue;
        rows.push({ uid, tripId: t.id, kind, action: sub === 'members' ? 'joined' : sub === 'packingSuggestions' ? 'suggested' : 'added', at });
      }
    }
  }
  rows.sort((a, b) => a.at - b.at);
  console.log(`${rows.length} writes from ${new Date(rows[0]?.at).toISOString().slice(0, 10)} to ${new Date(rows.at(-1)?.at).toISOString().slice(0, 10)}`);
  const byKind = {}; for (const r of rows) byKind[r.kind] = (byKind[r.kind] || 0) + 1; console.log(byKind);
  if (!RUN) { console.log('dry run only'); process.exit(0); }
  let batch = db.batch(), n = 0;
  for (const r of rows) {
    batch.set(db.collection('_writes').doc(), { ...r, at: admin.firestore.Timestamp.fromMillis(r.at), backfilled: true });
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
  console.log(`written ${n}`);
  process.exit(0);
})().catch(e => { console.error('failed:', e.message); process.exit(1); });
