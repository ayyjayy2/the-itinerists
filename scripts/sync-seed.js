#!/usr/bin/env node
/**
 * sync-seed.js
 *
 * Reads the live Firestore tripData and paidItems documents and overwrites
 * src/app/data/seed-data.ts with the current data.
 *
 * Run:  node scripts/sync-seed.js
 *
 * Requires scripts/serviceAccountKey.json — download from:
 *   Firebase Console → Project Settings → Service Accounts → Generate new private key
 */

const admin  = require('firebase-admin');
const fs     = require('fs');
const path   = require('path');

const KEY_PATH  = path.join(__dirname, 'serviceAccountKey.json');
const SEED_PATH = path.join(__dirname, '../src/app/data/seed-data.ts');
const TRIP_DOC  = 'app/tripData';

if (!fs.existsSync(KEY_PATH)) {
  console.error(`
ERROR: ${KEY_PATH} not found.

To generate it:
  1. Go to https://console.firebase.google.com/project/trip-planner-ayyjayy2/settings/serviceaccounts/adminsdk
  2. Click "Generate new private key"
  3. Save the file as:  scripts/serviceAccountKey.json
  (It is already in .gitignore — never commit it)
`);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(KEY_PATH)),
});

const db = admin.firestore();

async function main() {
  console.log('Reading Firestore...');
  const snap = await db.doc(TRIP_DOC).get();
  if (!snap.exists) {
    console.error('ERROR: app/tripData document does not exist in Firestore.');
    process.exit(1);
  }

  const data = snap.data();

  // Pretty-print the data as a JS value we can embed in TypeScript.
  // JSON.stringify produces valid TS literal syntax.
  const serialized = JSON.stringify(data, null, 2);

  const output = `/**
 * Hardcoded trip data — synced from Firestore via:  node scripts/sync-seed.js
 * DO NOT edit manually. Re-run the script to refresh.
 */
import { SheetData } from '../models/trip.models';

export const SEED_DATA: SheetData = ${serialized} as unknown as SheetData;
`;

  fs.writeFileSync(SEED_PATH, output, 'utf8');
  console.log(`✓ seed-data.ts updated from Firestore (${data.finance?.length ?? 0} finance entries)`);

  // Also print a summary of Dad ↔ Alayna finance entries so we can debug the balance.
  const finance = data.finance ?? [];
  const relevant = finance.filter(e =>
    (e.paidBy === 'Alayna' && e.splitAmong?.includes('Dad')) ||
    (e.paidBy === 'Dad' && e.splitAmong?.includes('Alayna'))
  );

  if (relevant.length === 0) {
    console.log('\n[Dad ↔ Alayna] No entries found.');
  } else {
    console.log('\n[Dad ↔ Alayna entries]:');
    for (const e of relevant) {
      const names = e.splitAmong === 'All' ? ['All'] : e.splitAmong.split(',').map(s => s.trim());
      const dadShare = e.splits?.['Dad'] ?? (e.amount / names.length);
      const alaynaShare = e.splits?.['Alayna'] ?? (e.amount / names.length);
      console.log(`  ${e.date} | ${e.description}`);
      console.log(`    paidBy=${e.paidBy}  total=${e.currency}${e.amount}  split=[${names.join(', ')}]`);
      if (e.paidBy === 'Alayna') console.log(`    Dad owes Alayna: $${dadShare.toFixed(2)}`);
      if (e.paidBy === 'Dad')    console.log(`    Alayna owes Dad: $${alaynaShare.toFixed(2)}`);
    }
    const totalDadOwesAlayna = relevant
      .filter(e => e.paidBy === 'Alayna')
      .reduce((sum, e) => {
        const names = e.splitAmong === 'All' ? [] : e.splitAmong.split(',').map(s => s.trim());
        return sum + (e.splits?.['Dad'] ?? e.amount / names.length);
      }, 0);
    console.log(`\n  Total Dad owes Alayna (unpaid not accounted for): $${totalDadOwesAlayna.toFixed(2)}`);
  }

  await admin.app().delete();
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
