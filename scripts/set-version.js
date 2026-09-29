/**
 * Single source of truth for the app version: package.json "version".
 *
 * Writes src/version.ts (APP_VERSION, APP_BUILD, APP_BUILD_DATE) before every
 * build. APP_BUILD is the git commit count — it only ever goes up, which is
 * what Apple requires of a build number — with a timestamp fallback when git
 * isn't available.
 *
 * With --ios it also stamps the Xcode project (MARKETING_VERSION and
 * CURRENT_PROJECT_VERSION), so the App Store version and build match the app.
 * Bump the version in package.json (e.g. `npm version 0.9.1 --no-git-tag-version`).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const VERSION = require(path.join(root, 'package.json')).version;

let build;
try { build = String(parseInt(execSync('git rev-list --count HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(), 10)); }
catch { build = String(Math.floor(Date.now() / 60000)); } // minutes since epoch: still monotonic
if (!/^\d+$/.test(build)) build = String(Math.floor(Date.now() / 60000));

const now = new Date();
const buildDate = `${now.toLocaleString('en-US', { month: 'short' })} ${now.getDate()} @ ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;

fs.writeFileSync(path.join(root, 'src/version.ts'),
  `// Auto-generated at build time by scripts/set-version.js — do not edit manually.\n` +
  `export const APP_VERSION = '${VERSION}';\n` +
  `export const APP_BUILD = '${build}';\n` +
  `export const APP_BUILD_DATE = '${buildDate}';\n`);
console.log(`[version] ${VERSION} (${build}) — ${buildDate}`);

if (process.argv.includes('--ios')) {
  const pbx = path.join(root, 'ios/App/App.xcodeproj/project.pbxproj');
  if (fs.existsSync(pbx)) {
    let s = fs.readFileSync(pbx, 'utf8');
    s = s.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${VERSION};`)
         .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`);
    fs.writeFileSync(pbx, s);
    console.log(`[version] iOS project stamped ${VERSION} (${build})`);
  }
}
