#!/usr/bin/env node
/**
 * "Itinerists Demo" (com.theitinerists.app.demo) for the iPhone simulator: the
 * real app shell around the demo web build (in-memory data, no accounts). The
 * mobile UI tests (mobile-tests/, #502) drive it with Appium, real keyboard
 * included, which browser tests can't stand in for (#500).
 *
 *   npm run mobile:build      builds mobile-tests/.build/…/App.app
 *
 * Needs the gitignored ios/App/App/GoogleService-Info.staging.plist: the native
 * Firebase SDK reports to the staging project, never production. The production
 * plist is put back afterwards. Like `ios:staging`, it leaves the iPhone
 * project's web folder holding this build: `npm run ios:sync` before building
 * the real app again.
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
export const DEMO_BUNDLE_ID = 'com.theitinerists.app.demo';
export const DEMO_APP = join(ROOT, 'mobile-tests/.build/Build/Products/Debug-iphonesimulator/App.app');

const run = (cmd, args, env = {}) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });

if (!existsSync(STAGING_PLIST)) throw new Error(`Missing ${STAGING_PLIST} (see scripts/ios-staging.mjs).`);
const projectId = readFileSync(STAGING_PLIST, 'utf8').match(/<key>PROJECT_ID<\/key>\s*<string>([^<]*)</)?.[1];
if (projectId !== 'the-itinerists-staging') throw new Error('GoogleService-Info.staging.plist is not the staging project\'s file.');

run('node', ['scripts/set-version.js', '--ios']);
run('npx', ['ng', 'build', '--configuration', 'demo']);
run('npx', ['cap', 'sync', 'ios'], { CAP_TARGET: 'demo' });
run('node', ['scripts/native-csp.mjs', '--site', 'the-itinerists-demo']);

const work = mkdtempSync(join(tmpdir(), 'ios-demo-'));
const saved = join(work, 'GoogleService-Info.plist');
const hadPlist = existsSync(PLIST);
if (hadPlist) copyFileSync(PLIST, saved);
copyFileSync(STAGING_PLIST, PLIST);
try {
  run('xcodebuild', ['-project', 'ios/App/App.xcodeproj', '-scheme', 'App', '-configuration', 'Debug',
    '-sdk', 'iphonesimulator', '-destination', 'generic/platform=iOS Simulator',
    '-derivedDataPath', join(ROOT, 'mobile-tests/.build'), 'CODE_SIGNING_ALLOWED=NO',
    `PRODUCT_BUNDLE_IDENTIFIER=${DEMO_BUNDLE_ID}`, 'APP_DISPLAY_NAME=Itinerists Demo', 'build']);
} finally {
  if (hadPlist) copyFileSync(saved, PLIST); else rmSync(PLIST, { force: true });
  rmSync(work, { recursive: true, force: true });
}
console.log(`\n[mobile] Built ${DEMO_APP}`);
console.log('[mobile] Run `npm run ios:sync` before building the real app again.');
