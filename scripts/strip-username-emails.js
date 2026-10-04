#!/usr/bin/env node
/**
 * One-off for #352: the public username index (usernames/{username}, readable
 * by anyone who knows the name) must never hold a real email. Each entry keeps
 * its uid; a placeholder sign-in address (username@the-itinerists.local) stays,
 * because old username-only accounts still sign in with it. A real authEmail
 * and any pendingEmail are removed. The private copy in
 * users/{uid}/private/account is untouched, so nobody loses their address.
 *
 * Prints counts only, never addresses or usernames.
 *
 *   node scripts/strip-username-emails.js                 # dry run, production
 *   node scripts/strip-username-emails.js --run           # write, production
 *   node scripts/strip-username-emails.js --staging [--run]
 */
const admin = require('firebase-admin');
const path = require('path');
const STAGING = process.argv.includes('--staging');
const RUN = process.argv.includes('--run');
const key = require(path.join(__dirname, STAGING ? 'serviceAccountKey.staging.json' : 'serviceAccountKey.json'));
const expected = STAGING ? 'the-itinerists-staging' : 'trip-planner-ayyjayy2';
if (key.project_id !== expected) throw new Error(`wrong project: ${key.project_id} (expected ${expected})`);
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

const isPlaceholder = e => typeof e === 'string' && /@the-itinerists\.local$/i.test(e);

/** The entry with nothing but its uid and, for old accounts, the placeholder address. */
function cleaned(data) {
  const out = { uid: data.uid };
  if (isPlaceholder(data.authEmail)) out.authEmail = data.authEmail;
  return out;
}

(async () => {
  const snap = await db.collection('usernames').get();
  let changed = 0, placeholderKept = 0, alreadyClean = 0;
  let batch = db.batch(), pending = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const next = cleaned(data);
    const same = Object.keys(data).length === Object.keys(next).length && Object.keys(next).every(k => data[k] === next[k]);
    if (same) { alreadyClean++; continue; }
    if (next.authEmail) placeholderKept++;
    changed++;
    if (RUN) {
      batch.set(d.ref, next);
      if (++pending === 400) { await batch.commit(); batch = db.batch(); pending = 0; }
    }
  }
  if (RUN && pending) await batch.commit();
  console.log(`${key.project_id}: ${snap.size} entries, ${alreadyClean} already clean, ${changed} ${RUN ? 'cleaned' : 'to clean'} (${placeholderKept} of them keep a placeholder address).`);
  if (!RUN && changed) console.log('Dry run: nothing written. Add --run to write.');
})().catch(err => { console.error(err.message); process.exit(1); });
