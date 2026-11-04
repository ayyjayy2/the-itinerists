#!/usr/bin/env node
/**
 * waitlist.js — the iPhone app launch list ("Notify me" on the welcome page).
 *
 * The app can only add to `_waitlist`; reading it needs this script (Admin SDK).
 * The privacy policy promises the list is used only for the launch email and
 * occasional updates, every email has an unsubscribe link, and an address is
 * deleted when its person unsubscribes or asks (#526).
 *
 *   node scripts/waitlist.js                       # how many people, per source (production)
 *   node scripts/waitlist.js export                # write scripts/waitlist.local.csv (gitignored)
 *   node scripts/waitlist.js import <file>         # dry run: what a gitignored JSON file would add (#763)
 *   node scripts/waitlist.js import <file> --run   # add them (people already on the list are skipped)
 *   node scripts/waitlist.js clear                 # dry run: how many entries would be deleted
 *   node scripts/waitlist.js clear --run           # delete the whole list (e.g. once it moves to a mailing service)
 *   add --staging to any of these for staging
 *
 * Never paste the export into chats, issues or pull requests.
 *
 * Each entry has a `source` (#763): website (the welcome page), instagram or
 * linkedin (the page opened from a post link), or survey (added here). An
 * import file is `{ "entries": [{ "email" | "phone", "source", "at"? }] }`,
 * kept as scripts/*.local.json so it stays out of the repository.
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

const SOURCES = ['website', 'instagram', 'linkedin', 'survey'];
/** One person per email (lower case) or phone (digits and +). */
const keyOf = ({ email, phone }) =>
  email ? 'e:' + String(email).trim().toLowerCase() : phone ? 'p:' + String(phone).replace(/[^\d+]/g, '') : null;

(async () => {
  const snap = await col.get();
  const unique = new Map();   // key -> { email, phone, source, at } at its first sign-up
  for (const d of snap.docs) {
    const { email, phone, source, at } = d.data();
    const key = keyOf({ email, phone });
    if (!key) continue;
    const when = at?.toDate?.() ?? null;
    if (!unique.has(key) || (when && when < unique.get(key).at)) unique.set(key, { email, phone, source: source ?? 'website', at: when });
  }

  if (cmd === 'count') {
    const per = {};
    for (const r of unique.values()) per[r.source] = (per[r.source] ?? 0) + 1;
    console.log(`${PROJECT}: ${unique.size} people (${snap.size} entries).`, Object.entries(per).map(([k, n]) => `${k} ${n}`).join(', '));
  } else if (cmd === 'export') {
    const file = path.join(__dirname, 'waitlist.local.csv');
    const rows = [...unique.values()].map(r => [r.email ?? '', r.phone ?? '', r.source, r.at ? r.at.toISOString() : ''].join(','));
    fs.writeFileSync(file, 'email,phone,source,joined\n' + rows.join('\n') + '\n');
    console.log(`Wrote ${unique.size} people to scripts/waitlist.local.csv (gitignored).`);
  } else if (cmd === 'import') {
    const file = args.filter(a => !a.startsWith('--'))[1];
    if (!file || !/\.local\./.test(path.basename(file))) throw new Error('import needs a gitignored *.local.json file');
    const { entries = [] } = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
    const add = [], skip = [];
    for (const e of entries) {
      const email = e.email ? String(e.email).trim().toLowerCase() : undefined;
      const phone = e.phone ? String(e.phone).replace(/[^\d+]/g, '') : undefined;
      if (!email && !phone) throw new Error('an entry has neither email nor phone');
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('an entry has a malformed email');
      if (!SOURCES.includes(e.source)) throw new Error(`unknown source: ${e.source} (${SOURCES.join(', ')})`);
      const key = keyOf({ email, phone });
      (unique.has(key) || add.some(a => keyOf(a) === key) ? skip : add).push({ email, phone, source: e.source, at: e.at });
    }
    // Counts only: the contacts themselves are never printed.
    console.log(`${PROJECT}: ${RUN ? 'adding' : 'would add'} ${add.length} (${add.filter(a => a.email).length} emails, ${add.filter(a => a.phone && !a.email).length} phones); ${skip.length} already on the list.`);
    if (RUN) {
      for (const a of add) {
        await col.add({
          ...(a.email ? { email: a.email } : {}), ...(a.phone ? { phone: a.phone } : {}),
          list: 'ios', source: a.source,
          at: a.at ? admin.firestore.Timestamp.fromDate(new Date(a.at)) : admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } else console.log('Nothing added. Add --run to add them.');
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
    throw new Error(`unknown command: ${cmd} (count, export, import, clear)`);
  }
})().catch(err => { console.error(err.message); process.exit(1); });
