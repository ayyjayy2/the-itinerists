#!/usr/bin/env node
/**
 * check-balances.js
 *
 * Reads live Firestore data and prints the full net balance sheet —
 * who owes whom, how much, and which entries drive each debt.
 *
 * Run:  node scripts/check-balances.js
 */

const admin = require('firebase-admin');
const path  = require('path');

const KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
const TRIP_DOC = 'app/tripData';
const PAID_DOC = 'app/paidItems';

const RATES = { USD: 1.16, EUR: 1, GBP: 0.855, ISK: 149.5 }; // EUR/USD rate used for trip calculations (Mar 2026)
const toUSD = (amount, currency) => (amount / (RATES[currency] ?? 1)) * RATES.USD;

admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
const db = admin.firestore();

async function main() {
  const [tripSnap, paidSnap] = await Promise.all([
    db.doc(TRIP_DOC).get(),
    db.doc(PAID_DOC).get(),
  ]);

  const finance  = tripSnap.data().finance ?? [];
  const paidSet  = new Set((paidSnap.exists ? paidSnap.data().items : []) ?? []);

  // Build direct debts map: "debtor__creditor" → { items[] }
  const debts = new Map();

  for (const e of finance) {
    if (!e.amount || e.amount <= 0) continue;
    const ALL_USERS = ['Alayna', 'Makaela', 'Dad', 'Linda', 'Madeleine', 'Caitlin', 'Arielle', 'Stinky'];
    const splits = e.splitAmong === 'All'
      ? ALL_USERS
      : e.splitAmong.split(',').map(s => s.trim()).filter(Boolean);

    for (const debtor of splits) {
      if (debtor === e.paidBy) continue;
      const share = e.splits ? (e.splits[debtor] ?? 0) : e.amount / splits.length;
      const key   = `${debtor}__${e.paidBy}`;
      if (!debts.has(key)) debts.set(key, { from: debtor, to: e.paidBy, items: [] });
      const paidKey = `${debtor}__${e.paidBy}__${e.date}__${e.description}`;
      debts.get(key).items.push({
        date: e.date, description: e.description,
        amount: share, currency: e.currency,
        paid: paidSet.has(paidKey),
      });
    }
  }

  // Net per pair (unpaid only)
  const pairs = new Map(); // "A__B" (A < B alphabetically) → net USD (positive = A is owed)
  const people = new Set();

  for (const [, d] of debts) {
    people.add(d.from); people.add(d.to);
    const unpaidUSD = d.items
      .filter(i => !i.paid)
      .reduce((s, i) => s + toUSD(i.amount, i.currency), 0);
    if (unpaidUSD < 0.005) continue;

    const a = d.from < d.to ? d.from : d.to;
    const b = d.from < d.to ? d.to   : d.from;
    const pairKey = `${a}__${b}`;
    const sign = d.from === a ? -1 : 1; // positive = a is owed by b
    pairs.set(pairKey, (pairs.get(pairKey) ?? 0) + sign * unpaidUSD);
  }

  // Print net balances
  console.log('\n══════════════════════════════════════════');
  console.log('  NET BALANCES (unpaid, in USD equivalent)');
  console.log('══════════════════════════════════════════\n');

  const sortedPairs = [...pairs.entries()]
    .filter(([, v]) => Math.abs(v) > 0.005)
    .sort((a, b) => a[0].localeCompare(b[0]));

  for (const [key, net] of sortedPairs) {
    const [a, b] = key.split('__');
    if (net > 0) {
      console.log(`  ${b} owes ${a}: $${net.toFixed(2)}`);
    } else {
      console.log(`  ${a} owes ${b}: $${Math.abs(net).toFixed(2)}`);
    }
  }

  // Per-person net summary
  console.log('\n══════════════════════════════════════════');
  console.log('  PER-PERSON NET (+ = is owed, - = owes)');
  console.log('══════════════════════════════════════════\n');

  const personNet = new Map();
  for (const [key, net] of pairs) {
    const [a, b] = key.split('__');
    personNet.set(a, (personNet.get(a) ?? 0) + net);
    personNet.set(b, (personNet.get(b) ?? 0) - net);
  }

  for (const [person, net] of [...personNet.entries()].sort((a, b) => b[1] - a[1])) {
    const sign = net >= 0 ? '+' : '';
    console.log(`  ${person.padEnd(12)} ${sign}$${net.toFixed(2)}`);
  }

  // Detailed breakdown per person
  const FOCUS = ['Linda', 'Caitlin', 'Madeleine'];
  for (const person of FOCUS) {
    console.log(`\n══════════════════════════════════════════`);
    console.log(`  ${person.toUpperCase()} — unpaid item detail`);
    console.log(`══════════════════════════════════════════`);
    for (const [, d] of debts) {
      if (d.from !== person && d.to !== person) continue;
      const unpaidItems = d.items.filter(i => !i.paid);
      if (!unpaidItems.length) continue;
      const total = unpaidItems.reduce((s, i) => s + toUSD(i.amount, i.currency), 0);
      console.log(`\n  ${d.from} → ${d.to}  ($${total.toFixed(2)} USD unpaid)`);
      for (const i of unpaidItems) {
        console.log(`    ${i.date} | ${i.description} | $${toUSD(i.amount, i.currency).toFixed(2)}`);
      }
    }
  }

  await admin.app().delete();
}

main().catch(err => { console.error(err.message); process.exit(1); });
