#!/usr/bin/env node
/**
 * Apply storage.cors.json to the project's default Cloud Storage bucket.
 * Browsers can only talk to the bucket from the origins listed there; the
 * real access control is storage.rules. Re-run whenever the list changes
 * (a new domain, a new dev port).
 *
 *   node scripts/set-storage-cors.js          # show current CORS, then apply
 *   node scripts/set-storage-cors.js --show   # show only
 */
const { GoogleAuth } = require('google-auth-library');
const cors = require('../storage.cors.json');
const key  = require('./serviceAccountKey.json');
if (key.project_id !== 'trip-planner-ayyjayy2') throw new Error('wrong project: ' + key.project_id);
const BUCKET = 'trip-planner-ayyjayy2.firebasestorage.app';
const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}`;

(async () => {
  const auth = new GoogleAuth({ credentials: key, scopes: ['https://www.googleapis.com/auth/devstorage.full_control'] });
  const client = await auth.getClient();
  const before = (await client.request({ url: `${url}?fields=cors` })).data.cors || [];
  console.log('current CORS origins:', before.flatMap(r => r.origin).join(', ') || '(none)');
  if (process.argv.includes('--show')) return;
  const after = (await client.request({ url: `${url}?fields=cors`, method: 'PATCH', data: { cors } })).data.cors;
  console.log('applied CORS origins:', after.flatMap(r => r.origin).join(', '));
})().catch(err => { console.error('failed:', err.response?.data?.error?.message || err.message); process.exit(1); });
