#!/usr/bin/env node
/**
 * set-account-flags.js
 *
 * Grants the two account-level privileges that used to be hard-coded uids:
 *   - `owner` custom claim: the app owner. firestore.rules (isAppOwner) and
 *     Pulse check it. Never give it to another account without the owner's
 *     explicit permission.
 *   - `layoutPicker: true` on users/{uid}: may pick a home layout (Profile).
 *
 * Which accounts get them lives in scripts/account-flags.local.json, which is
 * gitignored so real account ids stay out of the repository:
 *
 *   {
 *     "production": { "owner": "<uid>", "layoutPickers": ["<uid>", "<uid>"] },
 *     "staging":    { "owner": "<uid>", "layoutPickers": [] }
 *   }
 *
 * Dry run (default):  node scripts/set-account-flags.js [--staging]
 * Apply:              node scripts/set-account-flags.js [--staging] --run
 *
 * The owner's Pulse picks up a new claim at its next sign-in (it refreshes
 * the token); the app picks up layoutPicker live.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const RUN = args.includes('--run');
const env = args.includes('--staging') ? 'staging' : 'production';
const PROJECT = { production: 'trip-planner-ayyjayy2', staging: 'the-itinerists-staging' }[env];
const KEY = { production: 'serviceAccountKey.json', staging: 'serviceAccountKey.staging.json' }[env];

const key = require(path.join(__dirname, KEY));
if (key.project_id !== PROJECT) throw new Error(`wrong project for ${env}: ${key.project_id}`);

const flagsFile = path.join(__dirname, 'account-flags.local.json');
if (!fs.existsSync(flagsFile)) throw new Error('missing scripts/account-flags.local.json (see the comment at the top of this script)');
const flags = JSON.parse(fs.readFileSync(flagsFile, 'utf8'))[env];
if (!flags) throw new Error(`account-flags.local.json has no "${env}" section`);

admin.initializeApp({ credential: admin.credential.cert(key) });
const auth = admin.auth();
const db = admin.firestore();

(async () => {
  console.log(`${RUN ? 'Applying' : 'Dry run'} on ${PROJECT}`);

  if (flags.owner) {
    const user = await auth.getUser(flags.owner);
    const claims = user.customClaims ?? {};
    if (claims.owner === true) console.log(`owner claim: already on ${flags.owner}`);
    else {
      console.log(`owner claim: set on ${flags.owner}`);
      if (RUN) await auth.setCustomUserClaims(flags.owner, { ...claims, owner: true });
    }
  }

  for (const uid of flags.layoutPickers ?? []) {
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) { console.log(`layoutPicker: no users/${uid}, skipped`); continue; }
    if (snap.data().layoutPicker === true) { console.log(`layoutPicker: already on ${uid}`); continue; }
    console.log(`layoutPicker: set on ${uid}`);
    if (RUN) await ref.update({ layoutPicker: true });
  }

  if (!RUN) console.log('Nothing written. Add --run to apply.');
})().catch(err => { console.error(err.message); process.exit(1); });
