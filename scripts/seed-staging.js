#!/usr/bin/env node
/**
 * Seeds the STAGING project (the-itinerists-staging) with the demo build's
 * Chiang Mai trip and gives its four travellers real staging accounts, so the
 * staging site has something to click through. Never touches production: it
 * refuses any key whose project is not the staging one.
 *
 *   node scripts/seed-staging.js
 *
 * Needs scripts/serviceAccountKey.staging.json (git-ignored). Writes the test
 * passwords to scripts/staging-accounts.local.json (git-ignored). Re-running
 * overwrites the seeded documents and keeps existing passwords.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const admin = require('firebase-admin');

const key = require(path.join(__dirname, 'serviceAccountKey.staging.json'));
if (key.project_id !== 'the-itinerists-staging') throw new Error('not the staging project: ' + key.project_id);
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();
const auth = admin.auth();

// Compile the demo seed (TypeScript) and run it against a store that only collects documents.
const out = fs.mkdtempSync(path.join(require('os').tmpdir(), 'seed-staging-'));
execSync(`npx tsc --target es2022 --module commonjs --skipLibCheck --outDir ${out} src/demo/seed.ts`, { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
const seedFile = [path.join(out, 'demo', 'seed.js'), path.join(out, 'seed.js')].find(f => fs.existsSync(f));
const { seedDemo } = require(seedFile);
const docs = new Map();
seedDemo({ set: (p, data) => docs.set(p, data) });

const accountsFile = path.join(__dirname, 'staging-accounts.local.json');
const accounts = fs.existsSync(accountsFile) ? JSON.parse(fs.readFileSync(accountsFile, 'utf8')) : {};

(async () => {
  // Accounts: same uids as the seed, email = username@the-itinerists.local (the app's synthetic sign-in email).
  const people = [...docs].filter(([p]) => /^users\/[^/]+$/.test(p));   // snapshot: the loop adds users/{uid}/private/account
  for (const [p, u] of people) {
    const email = u.authEmail;
    const password = accounts[u.username]?.password ?? `Staging-${crypto.randomBytes(4).toString('hex')}`;
    try { await auth.updateUser(u.uid, { email, password, displayName: u.displayName }); }
    catch { await auth.createUser({ uid: u.uid, email, password, displayName: u.displayName }); }
    accounts[u.username] = { uid: u.uid, username: u.username, password };
    // The app keeps emails out of the profile doc: they live in users/{uid}/private/account.
    // The public username index holds only placeholder addresses, never a real one (#352).
    const { authEmail, ...profile } = u;
    docs.set(p, profile);
    docs.set(`users/${u.uid}/private/account`, { authEmail });
    docs.set(`usernames/${u.username}`, authEmail.endsWith('@the-itinerists.local') ? { uid: u.uid, authEmail } : { uid: u.uid });
  }
  let batch = db.batch(), n = 0;
  for (const [p, data] of docs) {
    batch.set(db.doc(p), data);
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
  fs.writeFileSync(accountsFile, JSON.stringify(accounts, null, 2));
  console.log(`seeded ${n} documents; ${Object.keys(accounts).length} accounts (passwords in ${path.relative(process.cwd(), accountsFile)})`);
  process.exit(0);
})().catch(e => { console.error('failed:', e.message); process.exit(1); });
