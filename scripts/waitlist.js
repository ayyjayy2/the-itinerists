#!/usr/bin/env node
/**
 * waitlist.js — the iPhone app launch list ("Notify me" on the welcome page).
 *
 * The app can only add to `_waitlist`; reading it needs this script (Admin SDK).
 * The privacy policy promises the list is used once, for the launch email,
 * then deleted.
 *
 *   node scripts/waitlist.js                       # how many unique emails (production)
 *   node scripts/waitlist.js export                # write scripts/waitlist.local.csv (gitignored)
 *   node scripts/waitlist.js clear                 # dry run: how many entries would be deleted
 *   node scripts/waitlist.js clear --run           # delete the whole list (after the launch email)
 *   add --staging to any of these for staging
 *
 * Never paste the export into chats, issues or pull requests.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const cmd = args.find(a => !a.startsWith('--')) ?? 'count';
const RUN = args.includes('--run');
const env = args.includes('--staging') ? 'staging' : 'production';
const PROJECT = { production: 'trip-planner-ayyjayy2', staging: 'the-itinerists-staging' }[env];
const KEY = { production: 'serviceAccountKey.json', staging: 'serviceAccountKey.staging.json' }[env];

const key = require(path.join(__dirname, KEY));
if (key.project_id !== PROJECT) throw new Error(`wrong project for ${env}: ${key.project_id}`);
admin.initializeApp({ credential: admin.credential.cert(key) });
const col = admin.firestore().collection('_waitlist');

(async () => {
  const snap = await col.get();
  const unique = new Map();   // email -> first time it was left
  for (const d of snap.docs) {
    const { email, at } = d.data();
    const when = at?.toDate?.() ?? null;
    if (!unique.has(email) || (when && when < unique.get(email))) unique.set(email, when);
  }

  if (cmd === 'count') {
    console.log(`${PROJECT}: ${unique.size} unique emails (${snap.size} entries).`);
  } else if (cmd === 'export') {
    const file = path.join(__dirname, 'waitlist.local.csv');
    const rows = [...unique].map(([email, when]) => `${email},${when ? when.toISOString() : ''}`);
    fs.writeFileSync(file, 'email,joined\n' + rows.join('\n') + '\n');
    console.log(`Wrote ${unique.size} emails to scripts/waitlist.local.csv (gitignored).`);
  } else if (cmd === 'clear') {
    console.log(`${PROJECT}: ${RUN ? 'deleting' : 'would delete'} ${snap.size} entries.`);
    if (RUN) {
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = admin.firestore().batch();
        snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } else console.log('Nothing deleted. Add --run to delete.');
  } else {
    throw new Error(`unknown command: ${cmd} (count, export, clear)`);
  }
})().catch(err => { console.error(err.message); process.exit(1); });
