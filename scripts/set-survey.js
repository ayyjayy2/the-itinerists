#!/usr/bin/env node
/**
 * set-survey.js
 *
 * Writes the survey invitation shown on Home (`_config/survey`): the pop-up's
 * wording, the Home banner's line, the survey link and the on/off switch.
 * The wording names real people, so it lives in the gitignored
 * scripts/survey.local.json rather than the repo:
 *
 *   {
 *     "staging":    { "id": "...", "active": true, "url": "https://...", "title": "...", "body": "...", "bannerText": "..." },
 *     "production": { ... }
 *   }
 *
 * A new `id` starts everyone over (pop-up, then banner); keep it to tweak the
 * wording without asking people again.
 *
 * Dry run (default):  node scripts/set-survey.js [--staging]
 * Apply:              node scripts/set-survey.js [--staging] --run
 * Switch off:         node scripts/set-survey.js [--staging] --off --run
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const RUN = args.includes('--run');
const OFF = args.includes('--off');
const env = args.includes('--staging') ? 'staging' : 'production';
const PROJECT = { production: 'trip-planner-ayyjayy2', staging: 'the-itinerists-staging' }[env];
const KEY = { production: 'serviceAccountKey.json', staging: 'serviceAccountKey.staging.json' }[env];

const key = require(path.join(__dirname, KEY));
if (key.project_id !== PROJECT) throw new Error(`wrong project for ${env}: ${key.project_id}`);

admin.initializeApp({ credential: admin.credential.cert(key) });
const ref = admin.firestore().collection('_config').doc('survey');

(async () => {
  console.log(`${RUN ? 'Applying' : 'Dry run'} on ${PROJECT}`);
  if (OFF) {
    console.log('survey: switch off (active: false)');
    if (RUN) await ref.set({ active: false }, { merge: true });
  } else {
    const file = path.join(__dirname, 'survey.local.json');
    if (!fs.existsSync(file)) throw new Error('missing scripts/survey.local.json (see the comment at the top of this script)');
    const s = JSON.parse(fs.readFileSync(file, 'utf8'))[env];
    if (!s) throw new Error(`survey.local.json has no "${env}" section`);
    for (const f of ['id', 'url', 'title', 'body', 'bannerText']) if (typeof s[f] !== 'string' || !s[f]) throw new Error(`"${f}" is missing`);
    if (!s.url.startsWith('https://')) throw new Error('"url" must start with https://');
    const config = { id: s.id, active: s.active !== false, url: s.url, title: s.title, body: s.body, bannerText: s.bannerText };
    console.log(JSON.stringify(config, null, 2));
    if (RUN) await ref.set(config);
  }
  if (!RUN) console.log('Nothing written. Add --run to apply.');
})().catch(err => { console.error(err.message); process.exit(1); });
