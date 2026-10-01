#!/usr/bin/env node
/**
 * Gives every trip leg a time zone (and coordinates) by geocoding its
 * destination with Nominatim and looking the point up in tz-lookup. Writes
 * `destinations[i].timeZone` / `destinationCoords` and the top-level
 * `timeZone` (primary leg). Skips legs that already have a zone.
 *
 *   node scripts/backfill-trip-zones.js          # dry run
 *   node scripts/backfill-trip-zones.js --run    # write
 */
const admin = require('firebase-admin');
const key = require(require('path').join(__dirname, 'serviceAccountKey.json'));
if (key.project_id !== 'trip-planner-ayyjayy2') throw new Error('wrong project: ' + key.project_id);
const tzLookup = require('tz-lookup');
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();
const RUN = process.argv.includes('--run');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function locate(q) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
    { headers: { 'User-Agent': 'the-itinerists backfill (admin script)', 'Accept-Language': 'en' } });
  if (!res.ok) return null;
  const hit = (await res.json())[0];
  if (!hit) return null;
  const lat = Number(hit.lat), lng = Number(hit.lon);
  return { lat, lng, timeZone: tzLookup(lat, lng), label: hit.display_name };
}

(async () => {
  const trips = await db.collection('trips').get();
  for (const t of trips.docs) {
    const d = t.data();
    const legs = Array.isArray(d.destinations) && d.destinations.length ? d.destinations.map(l => ({ ...l })) : null;
    const targets = legs ?? [{ destination: d.destination, timeZone: d.timeZone, destinationCoords: d.destinationCoords }];
    let changed = false;
    for (const leg of targets) {
      if (leg.timeZone || !leg.destination) continue;
      await sleep(1100);
      const hit = await locate(leg.destination);
      if (!hit) { console.log(`  ${d.name}: "${leg.destination}" → no result`); continue; }
      leg.timeZone = hit.timeZone;
      if (!leg.destinationCoords) leg.destinationCoords = { lat: hit.lat, lng: hit.lng };
      changed = true;
      console.log(`  ${d.name}: "${leg.destination}" → ${hit.timeZone}  (${hit.label.slice(0, 60)})`);
    }
    if (!changed) { console.log(`${d.name}: nothing to do`); continue; }
    const patch = legs ? { destinations: targets, timeZone: targets[0].timeZone ?? null } : { timeZone: targets[0].timeZone ?? null, destinationCoords: targets[0].destinationCoords ?? null };
    if (patch.timeZone === null) delete patch.timeZone;
    if (patch.destinationCoords === null) delete patch.destinationCoords;
    if (RUN) { await t.ref.update(patch); console.log(`${d.name}: written`); } else console.log(`${d.name}: would write ${JSON.stringify(Object.keys(patch))}`);
  }
  process.exit(0);
})().catch(e => { console.error('failed:', e.message); process.exit(1); });
