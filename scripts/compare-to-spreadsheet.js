#!/usr/bin/env node
/**
 * Compares live Firestore balances against known-correct spreadsheet values.
 * Prints every discrepancy and shows which entries are causing it.
 */
const admin = require('firebase-admin');
const path  = require('path');
admin.initializeApp({ credential: admin.credential.cert(require(path.join(__dirname, 'serviceAccountKey.json'))) });
const db = admin.firestore();

const RATES = { USD: 1.055, EUR: 1, GBP: 0.855, ISK: 149.5 };
// All 8 finance users (matches financeUsers() in the app)
const ALL_USERS = ['Alayna', 'Dad', 'Makaela', 'Madeleine', 'Caitlin', 'Linda', 'Arielle', 'Stinky'];
const toUSD = (amt, cur) => (amt / (RATES[cur] ?? 1)) * RATES.USD;

// ── Correct net debts from spreadsheet (debtor → creditor → amount USD) ──────
const EXPECTED = {
  'Linda→Alayna':    60.42,
  'Madeleine→Alayna': 43.52,
  'Caitlin→Alayna':  81.60,
  'Dad→Alayna':      18.29,
  'Linda→Makaela':  457.77,
  'Madeleine→Makaela': 427.55,
  'Caitlin→Makaela': 191.85,
  'Dad→Makaela':    739.17,
  'Linda→Caitlin':  204.94,
  'Caitlin→Madeleine': 130.44,
  'Linda→Madeleine': 353.70,
  'Dad→Caitlin':    236.06,
  'Dad→Madeleine':   23.92,
  'Dad→Linda':       33.68,
};

async function main() {
  const [tripSnap, paidSnap] = await Promise.all([
    db.doc('app/tripData').get(),
    db.doc('app/paidItems').get(),
  ]);
  const finance = tripSnap.data().finance ?? [];
  const paidSet = new Set((paidSnap.exists ? paidSnap.data().items ?? [] : []));

  // Build per-pair item lists
  const debts = new Map();
  for (const e of finance) {
    if (!e.amount || e.amount <= 0) continue;
    const splits = e.splitAmong === 'All'
      ? ALL_USERS : e.splitAmong.split(',').map(s => s.trim()).filter(Boolean);
    for (const debtor of splits) {
      if (debtor === e.paidBy) continue;
      const share = e.splits ? (e.splits[debtor] ?? 0) : e.amount / splits.length;
      const key = `${debtor}→${e.paidBy}`;
      if (!debts.has(key)) debts.set(key, []);
      debts.get(key).push({
        date: e.date, desc: e.description, vendor: e.vendor,
        amount: share, currency: e.currency,
        paid: paidSet.has(`${debtor}__${e.paidBy}__${e.date}__${e.description}`),
      });
    }
  }

  // Net per pair (unpaid only)
  const netPair = (a, b) => {
    const ab = (debts.get(`${a}→${b}`) ?? []).filter(i=>!i.paid).reduce((s,i)=>s+toUSD(i.amount,i.currency),0);
    const ba = (debts.get(`${b}→${a}`) ?? []).filter(i=>!i.paid).reduce((s,i)=>s+toUSD(i.amount,i.currency),0);
    return ab - ba; // positive = a still owes b net
  };

  console.log('\n══════ DISCREPANCIES vs SPREADSHEET ══════\n');
  let anyBad = false;
  for (const [key, expected] of Object.entries(EXPECTED)) {
    const [debtor, creditor] = key.split('→');
    const got = netPair(debtor, creditor);
    const diff = got - expected;
    if (Math.abs(diff) < 0.10) {
      console.log(`✓ ${key.padEnd(24)} expected $${expected.toFixed(2)}  got $${got.toFixed(2)}`);
    } else {
      anyBad = true;
      console.log(`✗ ${key.padEnd(24)} expected $${expected.toFixed(2)}  got $${got.toFixed(2)}  diff ${diff>0?'+':''}$${diff.toFixed(2)}`);

      // Show which entries are driving the difference
      const items = debts.get(key) ?? [];
      const unpaid = items.filter(i=>!i.paid);
      if (unpaid.length) {
        console.log(`    ${debtor} → ${creditor} items (${unpaid.length}):`);
        for (const i of unpaid) console.log(`      ${i.date} | ${i.desc} | $${toUSD(i.amount,i.currency).toFixed(2)}`);
      }
      const rev = debts.get(`${creditor}→${debtor}`) ?? [];
      const revUnpaid = rev.filter(i=>!i.paid);
      if (revUnpaid.length) {
        console.log(`    ${creditor} → ${debtor} items (${revUnpaid.length}) [offset]:`);
        for (const i of revUnpaid) console.log(`      ${i.date} | ${i.desc} | $${toUSD(i.amount,i.currency).toFixed(2)}`);
      }
      console.log('');
    }
  }
  if (!anyBad) console.log('All balances match! 🎉');
  await admin.app().delete();
}
main().catch(e => { console.error(e.message); process.exit(1); });
