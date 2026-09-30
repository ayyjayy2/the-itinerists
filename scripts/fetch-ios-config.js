#!/usr/bin/env node
/**
 * Write ios/App/App/GoogleService-Info.plist for the registered iOS app
 * (bundle id com.theitinerists.app) using the Firebase Management API and the
 * local service-account key. The plist is gitignored like environment.ts;
 * run this once per machine before an Xcode build:
 *
 *   node scripts/fetch-ios-config.js
 */
const fs = require('fs');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');
const key = require('./serviceAccountKey.json');
if (key.project_id !== 'trip-planner-ayyjayy2') throw new Error('wrong project: ' + key.project_id);
const BUNDLE_ID = 'com.theitinerists.app';
const OUT = path.join(__dirname, '..', 'ios', 'App', 'App', 'GoogleService-Info.plist');

(async () => {
  const client = await new GoogleAuth({ credentials: key, scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
  const base = 'https://firebase.googleapis.com/v1beta1/projects/trip-planner-ayyjayy2';
  const apps = (await client.request({ url: `${base}/iosApps` })).data.apps || [];
  const app = apps.find(a => a.bundleId === BUNDLE_ID);
  if (!app) throw new Error(`no iOS app with bundle id ${BUNDLE_ID} registered in Firebase`);
  const cfg = (await client.request({ url: `https://firebase.googleapis.com/v1beta1/${app.name}/config` })).data;
  fs.writeFileSync(OUT, Buffer.from(cfg.configFileContents, 'base64'));
  console.log(`wrote ${path.relative(process.cwd(), OUT)} for ${app.appId}`);
})().catch(err => { console.error('failed:', err.response?.data?.error?.message || err.message); process.exit(1); });
