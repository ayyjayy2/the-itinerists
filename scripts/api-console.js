#!/usr/bin/env node
/**
 * Manages the API console on STAGING (https://the-itinerists-staging.web.app/api-console/index.html):
 * who may open it, and the request list it shows. Only the owner runs this.
 *
 *   node scripts/api-console.js grant <username|email>    approve a staging account
 *   node scripts/api-console.js revoke <username|email>   take the approval away
 *   node scripts/api-console.js list                      show who is approved
 *   node scripts/api-console.js publish <openapi.json>    upload the request list
 *
 * Approval is a doc at _apiConsoleAccess/{uid}; the request list is _apiConsole/spec.
 * The rules let no app user write either one, so this script (Admin SDK) is the only
 * way in. The account must already exist on staging (staging has public sign-up off).
 *
 * The request list is not kept in the repository (the repo is public): its source
 * lives in the owner's private HQ artifact and in scripts/api-spec.local.* on the
 * owner's Mac. Needs scripts/serviceAccountKey.staging.json (git-ignored); refuses
 * any key whose project is not the staging one.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const key = require(path.join(__dirname, 'serviceAccountKey.staging.json'));
if (key.project_id !== 'the-itinerists-staging') throw new Error('not the staging project: ' + key.project_id);
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();
const auth = admin.auth();

/** A username is looked up in usernames/{username}; an email is looked up in Authentication. */
async function findAccount(who) {
  if (who.includes('@')) return auth.getUserByEmail(who);
  const snap = await db.doc(`usernames/${who.toLowerCase()}`).get();
  if (!snap.exists) throw new Error(`No staging account has the username "${who}". Check the spelling, or create the account first.`);
  return auth.getUser(snap.data().uid);
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'grant' || cmd === 'revoke') {
    if (!arg) throw new Error(`Say whose access to ${cmd}: node scripts/api-console.js ${cmd} <username|email>`);
    const user = await findAccount(arg);
    const ref = db.doc(`_apiConsoleAccess/${user.uid}`);
    if (cmd === 'grant') {
      await ref.set({ grantedAt: admin.firestore.FieldValue.serverTimestamp(), label: arg });
      console.log(`Approved ${arg} for the API console.`);
    } else {
      await ref.delete();
      console.log(`Removed ${arg} from the API console.`);
    }
  } else if (cmd === 'list') {
    const snap = await db.collection('_apiConsoleAccess').get();
    if (snap.empty) return console.log('Nobody is approved yet.');
    for (const d of snap.docs) {
      const u = await auth.getUser(d.id).catch(() => null);
      console.log(`- ${d.data().label ?? u?.email ?? d.id}${u ? '' : ' (account no longer exists)'}`);
    }
  } else if (cmd === 'publish') {
    if (!arg) throw new Error('Say which file to upload: node scripts/api-console.js publish <openapi.json>');
    const text = fs.readFileSync(arg, 'utf8');
    const spec = JSON.parse(text);   // refuse a broken file before it reaches the console
    if (!spec.openapi || !spec.paths) throw new Error('That file is not an OpenAPI document (no "openapi" or "paths").');
    await db.doc('_apiConsole/spec').set({ openapi: text, publishedAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`Published ${Object.keys(spec.paths).length} paths to the API console.`);
  } else {
    console.log('Usage: node scripts/api-console.js grant|revoke <username|email> · list · publish <openapi.json>');
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err.message); process.exit(1); });
