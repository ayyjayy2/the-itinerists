#!/usr/bin/env node
/**
 * Writes the partner offers shown on Tips & Recs for trips abroad
 * (`_config/partners`, #474): the eSIM and travel-insurance partners, with
 * their links and referral codes. Those name the owner, so they live in the
 * gitignored scripts/partners.local.json rather than the repo:
 *
 *   {
 *     "production": {
 *       "active": true,
 *       "esim": [
 *         { "id": "partner-a", "name": "Partner A", "offer": "$3 off your first eSIM", "code": "CODE", "url": "https://..." }
 *       ],
 *       "insurance": [
 *         { "id": "partner-b", "name": "Partner B", "offer": "Travel medical insurance by the week", "url": "https://..." }
 *       ]
 *     },
 *     "staging": { ... the same shape ... }
 *   }
 *
 * `id` is what taps are counted under in Pulse: lowercase letters, digits and
 * dashes. `code` is optional. Offers show in the order listed.
 *
 * Dry run (default):  node scripts/set-partners.js [--staging]
 * Apply:              node scripts/set-partners.js [--staging] --run
 * Switch off:         node scripts/set-partners.js [--staging] --off --run
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
const ref = admin.firestore().collection('_config').doc('partners');

/** One offer, checked; the same rules the app applies when it reads them. */
function offer(p, where) {
  if (!p || typeof p !== 'object') throw new Error(`${where}: not an offer`);
  if (!/^[a-z0-9-]{1,32}$/.test(p.id || '')) throw new Error(`${where}: "id" must be lowercase letters, digits or dashes (max 32)`);
  for (const f of ['name', 'offer', 'url']) if (typeof p[f] !== 'string' || !p[f].trim()) throw new Error(`${where}: "${f}" is missing`);
  if (!p.url.startsWith('https://')) throw new Error(`${where}: "url" must start with https://`);
  if (p.code !== undefined && (typeof p.code !== 'string' || !p.code.trim())) throw new Error(`${where}: "code" must be text when given`);
  return { id: p.id, name: p.name.trim(), offer: p.offer.trim(), url: p.url, ...(p.code ? { code: p.code.trim() } : {}) };
}

const masked = c => (c ? `${c.slice(0, 2)}${'•'.repeat(Math.max(0, c.length - 2))}` : '(no code)');

(async () => {
  console.log(`${RUN ? 'Applying' : 'Dry run'} on ${PROJECT}`);
  let config;
  if (OFF) {
    config = { active: false, esim: [], insurance: [] };
    console.log('partner offers: switch off');
  } else {
    const file = path.join(__dirname, 'partners.local.json');
    if (!fs.existsSync(file)) throw new Error('missing scripts/partners.local.json (see the comment at the top of this script)');
    const s = JSON.parse(fs.readFileSync(file, 'utf8'))[env];
    if (!s) throw new Error(`partners.local.json has no "${env}" section`);
    config = {
      active: s.active !== false,
      esim: (s.esim || []).map((p, i) => offer(p, `esim[${i}]`)),
      insurance: (s.insurance || []).map((p, i) => offer(p, `insurance[${i}]`)),
    };
    const ids = [...config.esim, ...config.insurance].map(p => p.id);
    if (new Set(ids).size !== ids.length) throw new Error('every "id" must be different');
    console.log(`active: ${config.active}`);
    for (const kind of ['esim', 'insurance']) {
      console.log(`${kind}:`);
      for (const p of config[kind]) console.log(`  ${p.id.padEnd(12)} ${p.name} · ${p.offer} · ${masked(p.code)} · ${new URL(p.url).host}`);
    }
  }
  if (RUN) await ref.set(config);
  else console.log('Nothing written. Add --run to apply.');
})().catch(err => { console.error(err.message); process.exit(1); });
