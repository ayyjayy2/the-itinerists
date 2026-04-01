#!/usr/bin/env node
/**
 * apply-v6-fixes.js
 *
 * Applies V6 migration fixes directly to Firestore (mirrors data.service.ts V6 migration).
 * Run ONCE, then run npm run sync-seed to update seed-data.ts.
 *
 * Fixes:
 *  1. Remove duplicate "hotel" entry (Mar 10, Makaela→Dad $224.01)
 *  2. Remove duplicate blank Blue Lagoon entry (Mar 20, Makaela→Makaela+Dad $299.80)
 *  3. Remove duplicate "Exit row seat" (Mar 19, Makaela→Dad $85) — V5 added named version
 *  4. Cliffs of Moher: replace Dad with Linda in split (V5 condition had wrong amount, never ran)
 *  5. Mar 26 parking blank: remove Alayna from split (she left Mar 21)
 */
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
const db = admin.firestore();

async function main() {
  const ref = db.doc('app/tripData');
  const snap = await ref.get();
  const data = snap.data();
  let finance = [...(data.finance ?? [])];
  const before = finance.length;

  // 1-3: Remove duplicates
  finance = finance.filter(e => {
    if (e.description === 'hotel' && e.paidBy === 'Makaela' &&
        e.date === '2026-03-10' && e.splitAmong === 'Dad') {
      console.log(`  REMOVE: hotel (${e.date}, ${e.paidBy}, $${e.amount})`);
      return false;
    }
    if (!e.description && e.paidBy === 'Makaela' && e.date === '2026-03-20' &&
        Math.abs(e.amount - 299.80) < 1) {
      console.log(`  REMOVE: blank Blue Lagoon duplicate (${e.date}, $${e.amount})`);
      return false;
    }
    if (e.description === 'Exit row seat' && e.paidBy === 'Makaela' &&
        e.date === '2026-03-19' && e.splitAmong === 'Dad') {
      console.log(`  REMOVE: "Exit row seat" duplicate (${e.date}, $${e.amount})`);
      return false;
    }
    return true;
  });

  // 4-5: Fix splits
  finance = finance.map(e => {
    if (e.description === 'Cliffs of Moher Tour' && e.paidBy === 'Caitlin' &&
        e.splitAmong?.includes('Dad')) {
      console.log(`  FIX: Cliffs of Moher — replace Dad with Linda`);
      return { ...e, splitAmong: 'Caitlin, Makaela, Madeleine, Linda', notes: '$69.81/pp × 4' };
    }
    if (!e.description && e.paidBy === 'Madeleine' && e.date === '2026-03-26' &&
        e.splitAmong?.includes('Alayna')) {
      console.log(`  FIX: Mar 26 parking — remove Alayna from split`);
      return { ...e, splitAmong: 'Linda, Madeleine, Caitlin' };
    }
    return e;
  });

  finance.sort((a, b) => a.date.localeCompare(b.date));

  console.log(`\nEntries: ${before} → ${finance.length} (removed ${before - finance.length})`);
  await ref.update({ finance, migrationVersion: 6 });
  console.log('✓ Firestore updated with V6 fixes');
  await admin.app().delete();
}

main().catch(e => { console.error(e.message); process.exit(1); });
