#!/usr/bin/env node
/**
 * db-counts.js — how many documents each collection holds, and how many reads,
 * writes and deletes the project has used today. Counts only: no names, no
 * content (#595).
 *
 *   node scripts/db-counts.js              # production
 *   node scripts/db-counts.js --staging    # staging
 *
 * Cheap on purpose. Each count is a `count()` aggregation, billed as one read
 * per 1,000 documents counted (about 30 reads for the whole database today),
 * where reading every document cost ~1,600 a run and was most of production's
 * reads on Oct 30, 2026. Today's usage comes from Cloud Monitoring, which costs
 * no Firestore reads; it needs the owner's `gcloud` sign-in and is skipped
 * without it.
 */
const path = require('path');
const { execSync } = require('child_process');
const admin = require('firebase-admin');

const env = process.argv.includes('--staging') ? 'staging' : 'production';
const PROJECT = { production: 'trip-planner-ayyjayy2', staging: 'the-itinerists-staging' }[env];
const KEY = { production: 'serviceAccountKey.json', staging: 'serviceAccountKey.staging.json' }[env];

const key = require(path.join(__dirname, KEY));
if (key.project_id !== PROJECT) throw new Error(`wrong project for ${env}: ${key.project_id}`);
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

// Subcollections the app writes (src/app/services, firestore.rules). A count by
// collection id covers every collection with that id, at any depth.
const NESTED = [
  'members', 'invites', 'removedMembers', 'itinerary', 'finance', 'payments', 'events', 'activityLog',
  'stays', 'flights', 'cars', 'recs', 'pins', 'dayLabels', 'outfits', 'outfitPhotos', 'packing',
  'packingSuggestions', 'weather', 'geocache', 'private', 'kinds',
];

(async () => {
  const top = (await db.listCollections()).map(c => c.id);
  const ids = [...new Set([...top, ...NESTED])].sort();
  const rows = [];
  for (const id of ids) {
    const n = (await db.collectionGroup(id).count().get()).data().count;
    if (n) rows.push([id, n]);
  }
  const total = rows.reduce((s, [, n]) => s + n, 0);
  const cost = rows.reduce((s, [, n]) => s + Math.max(1, Math.ceil(n / 1000)), 0) + ids.length - rows.length;
  console.log(`${PROJECT}: ${total.toLocaleString('en-US')} documents (this count cost about ${cost} reads)\n`);
  for (const [id, n] of rows.sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(6)}  ${id}`);

  const usage = await usageToday().catch(e => `  (skipped: ${e.message})`);
  console.log(`\nToday since midnight Pacific (Cloud Monitoring, a few minutes behind):\n${usage}`);
  process.exit(0);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });

async function usageToday() {
  let token;
  try {
    token = execSync('gcloud auth print-access-token', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    throw new Error('sign in with `gcloud auth login` to see it');
  }
  const end = new Date();
  const start = pacificMidnight(end);
  const lines = [];
  for (const metric of ['read_count', 'write_count', 'delete_count']) {
    const query = new URLSearchParams({
      filter: `metric.type="firestore.googleapis.com/document/${metric}"`,
      'interval.startTime': start.toISOString(),
      'interval.endTime': end.toISOString(),
      'aggregation.alignmentPeriod': `${Math.max(60, Math.ceil((end - start) / 1000))}s`,
      'aggregation.perSeriesAligner': 'ALIGN_SUM',
      'aggregation.crossSeriesReducer': 'REDUCE_SUM',
    });
    const res = await fetch(`https://monitoring.googleapis.com/v3/projects/${PROJECT}/timeSeries?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error?.message ?? `Monitoring answered ${res.status}`);
    const n = (body.timeSeries ?? []).flatMap(s => s.points ?? []).reduce((s, p) => s + Number(p.value?.int64Value ?? 0), 0);
    lines.push(`  ${String(n).padStart(6)}  ${metric.replace('_count', 's')}`);
  }
  return lines.join('\n') + '\n  (free plan: 50,000 reads, 20,000 writes, 20,000 deletes a day)';
}

/** The last midnight in Pacific time (an hour out on the two clock-change days). */
function pacificMidnight(now) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hourCycle: 'h23', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(now).map(x => [x.type, Number(x.value)]));
  return new Date(now - (((p.hour * 60 + p.minute) * 60 + p.second) * 1000 + now.getMilliseconds()));
}
