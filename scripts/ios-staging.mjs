#!/usr/bin/env node
/**
 * The staging iPhone app: "Itinerists Staging" (com.theitinerists.app.staging),
 * a second app beside the real one that runs the staging web build against the
 * staging Firebase project (test trip, test accounts). It's where a change is
 * tried on a phone before production, the way the staging website is.
 *
 *   npm run ios:staging                  build, then install and open it on the connected iPhone
 *   IOS_DEVICE=<devicectl id> npm run ios:staging     pick a phone when several are paired
 *
 * Needs ios/App/App/GoogleService-Info.staging.plist (gitignored; from
 * `firebase apps:sdkconfig IOS <app id> --project the-itinerists-staging`).
 * The production plist is put back afterwards, even if the build fails.
 * The iPhone project's web folder is left holding the staging build: run
 * `npm run ios:sync` before building the real app again (it always rebuilds).
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = join(ROOT, 'ios/App/App');
const PLIST = join(APP_DIR, 'GoogleService-Info.plist');
const STAGING_PLIST = join(APP_DIR, 'GoogleService-Info.staging.plist');
const BUNDLE_ID = 'com.theitinerists.app.staging';
const NAME = 'Itinerists Staging';

const run = (cmd, args, env = {}) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });

/** The phone to install on: IOS_DEVICE, or the one paired iPhone that's available. */
function pickDevice(work) {
  if (process.env.IOS_DEVICE) return process.env.IOS_DEVICE;
  const out = join(work, 'devices.json');
  execFileSync('xcrun', ['devicectl', 'list', 'devices', '--json-output', out], { stdio: 'ignore' });
  const phones = JSON.parse(readFileSync(out, 'utf8')).result.devices
    .filter(d => d.hardwareProperties?.deviceType === 'iPhone' && d.connectionProperties?.pairingState === 'paired');
  if (phones.length !== 1) throw new Error(`Found ${phones.length} paired iPhones; set IOS_DEVICE to one devicectl id.`);
  return phones[0].identifier;
}

function plistValue(file, key) {
  const m = readFileSync(file, 'utf8').match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`));
  return m?.[1];
}

if (!existsSync(STAGING_PLIST)) throw new Error(`Missing ${STAGING_PLIST} (see the comment at the top of this script).`);
if (plistValue(STAGING_PLIST, 'PROJECT_ID') !== 'the-itinerists-staging' || plistValue(STAGING_PLIST, 'BUNDLE_ID') !== BUNDLE_ID)
  throw new Error('GoogleService-Info.staging.plist is not the staging iPhone app\'s file.');

const work = mkdtempSync(join(tmpdir(), 'ios-staging-'));
let device;
try { device = pickDevice(work); } catch (e) { rmSync(work, { recursive: true, force: true }); throw e; }

run('node', ['scripts/set-version.js', '--ios']);
run('npx', ['ng', 'build', '--configuration', 'staging']);
run('npx', ['cap', 'sync', 'ios'], { CAP_TARGET: 'staging' });
run('node', ['scripts/native-csp.mjs', '--site', 'the-itinerists-staging']);

const saved = join(work, 'GoogleService-Info.plist');
const hadPlist = existsSync(PLIST);
if (hadPlist) copyFileSync(PLIST, saved);
copyFileSync(STAGING_PLIST, PLIST);
try {
  run('xcodebuild', ['-project', 'ios/App/App.xcodeproj', '-scheme', 'App', '-configuration', 'Debug',
    '-destination', 'generic/platform=iOS', '-derivedDataPath', join(work, 'build'), '-allowProvisioningUpdates',
    `PRODUCT_BUNDLE_IDENTIFIER=${BUNDLE_ID}`, `APP_DISPLAY_NAME=${NAME}`, 'build']);
} catch (e) {
  rmSync(work, { recursive: true, force: true });
  throw e;
} finally {
  if (hadPlist) copyFileSync(saved, PLIST); else rmSync(PLIST, { force: true });
}

// The build is several GB: remove it whether or not the phone took it (a locked
// or unreachable phone fails the install, and leftovers filled the disk once).
try {
  run('xcrun', ['devicectl', 'device', 'install', 'app', '--device', device, join(work, 'build/Build/Products/Debug-iphoneos/App.app')]);
} finally {
  rmSync(work, { recursive: true, force: true });
}
try {
  run('xcrun', ['devicectl', 'device', 'process', 'launch', '--device', device, BUNDLE_ID]);
  console.log(`\n[ios-staging] "${NAME}" is installed and open.`);
} catch {
  console.log(`\n[ios-staging] "${NAME}" is installed; it couldn't open by itself (is the phone locked?). Tap its icon.`);
}
console.log('[ios-staging] Run `npm run ios:sync` before building the real app again.');
