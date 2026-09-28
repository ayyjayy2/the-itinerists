#!/usr/bin/env node
/**
 * One-time migration for the account-privacy lockdown:
 *   users/{uid}.authEmail / .pendingEmail  →  users/{uid}/private/account
 *   plus a usernames/{username} index entry { uid, authEmail, pendingEmail? }
 *
 *   node scripts/migrate-account-privacy.js          # create the new docs (safe to re-run)
 *   node scripts/migrate-account-privacy.js --strip  # then remove the email fields from users/*
 *
 * Run "create" before deploying the new app + rules; run "--strip" after.
 * Uses scripts/serviceAccountKey.json; refuses any other project.
 */
const admin = require('firebase-admin');
const key = require('./serviceAccountKey.json');
if (key.project_id !== 'trip-planner-ayyjayy2') throw new Error('wrong project: ' + key.project_id);
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();
const strip = process.argv.includes('--strip');
const PLACEHOLDER = '@the-itinerists.local';

(async () => {
  const users = await db.collection('users').get();
  let created = 0, stripped = 0, skipped = 0;
  for (const u of users.docs) {
    const d = u.data();
    const username = (d.username ?? '').toLowerCase().trim();
    if (!username) { console.warn(`skip ${u.id}: no username`); skipped++; continue; }
    if (strip) {
      if ('authEmail' in d || 'pendingEmail' in d) {
        await u.ref.update({ authEmail: admin.firestore.FieldValue.delete(), pendingEmail: admin.firestore.FieldValue.delete() });
        stripped++;
      }
      continue;
    }
    // Prefer the address Firebase Auth actually has; fall back to the mirror, then the legacy synthetic one.
    let authEmail = d.authEmail;
    try { authEmail = (await admin.auth().getUser(u.id)).email || authEmail; } catch { /* keep mirror */ }
    authEmail = (authEmail || `${username}${PLACEHOLDER}`).toLowerCase();
    const account = { authEmail };
    const entry = { uid: u.id, authEmail };
    if (d.pendingEmail && d.pendingEmail.toLowerCase() !== authEmail) {
      account.pendingEmail = d.pendingEmail.toLowerCase();
      entry.pendingEmail = account.pendingEmail;
    }
    await u.ref.collection('private').doc('account').set(account, { merge: true });
    const existing = await db.collection('usernames').doc(username).get();
    if (existing.exists && existing.data().uid !== u.id) {
      console.warn(`CONFLICT usernames/${username} owned by ${existing.data().uid}, not ${u.id}`); skipped++; continue;
    }
    await db.collection('usernames').doc(username).set(entry);
    created++;
  }
  console.log(strip ? `stripped email fields from ${stripped} profiles` : `wrote private/account + usernames entry for ${created} users`, `(${skipped} skipped)`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
