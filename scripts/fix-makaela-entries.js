#!/usr/bin/env node
/**
 * fix-makaela-entries.js
 *
 * 1. Remove duplicate "Breakfast" (Mar 13, Makaela+Dad $37.45) — keeping "Brekky" on Mar 15
 * 2. Add missing "Car rental Iceland" (Mar 19, Makaela paid, split Makaela+Dad, $304.57)
 *
 * Run once, then: npm run sync-seed
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

  // 1. Remove duplicate "Breakfast" (Mar 13) — keeping "Brekky" (Mar 15)
  finance = finance.filter(e => {
    if (e.description === 'Breakfast' && e.paidBy === 'Makaela' &&
        e.date === '2026-03-13' && e.splitAmong === 'Makaela, Dad') {
      console.log(`  REMOVE: Breakfast (${e.date}, $${e.amount})`);
      return false;
    }
    return true;
  });

  // 2. Add missing Car rental Iceland (only if not already present)
  const alreadyExists = finance.some(e =>
    e.description === 'Car rental Iceland' && e.paidBy === 'Makaela' && e.date === '2026-03-19'
  );
  if (!alreadyExists) {
    const entry = {
      date: '2026-03-19',
      description: 'Car rental Iceland',
      vendor: 'Car rental Iceland',
      category: 'Transport',
      amount: 304.57,
      currency: 'USD',
      paidBy: 'Makaela',
      splitAmong: 'Makaela, Dad',
      notes: '',
      link: '',
    };
    finance.push(entry);
    finance.sort((a, b) => a.date.localeCompare(b.date));
    console.log(`  ADD: Car rental Iceland (${entry.date}, $${entry.amount})`);
  } else {
    console.log('  SKIP: Car rental Iceland already exists');
  }

  console.log(`\nFinance entries: ${before} → ${finance.length}`);
  await ref.update({ finance });
  console.log('✓ Firestore updated. Run: npm run sync-seed');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
