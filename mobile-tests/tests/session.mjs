/**
 * Starts Appium and opens "Itinerists Demo" on an iPhone simulator (#502).
 * Build the app first: `npm run mobile:build` at the repo root.
 *   IOS_SIM="iPhone 17"     the simulator to use
 *   MOBILE_APP=<App.app>    another build of the demo app
 *   SHOTS=<dir>             where screenshots go (default mobile-tests/.shots)
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { remote } from 'webdriverio';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = process.env.MOBILE_APP ?? join(HERE, '.build/Build/Products/Debug-iphonesimulator/App.app');
const PORT = 4723;
/** WebDriverAgent (Appium's helper on the simulator), pinned: newer ones need
 *  lib_TestingInterop.dylib, which Xcode 26.2 doesn't have. Drop the pin (and
 *  bootstrapPath) once Xcode is updated. */
const WDA = join(HERE, 'node_modules/appium-webdriveragent');
export const SHOTS = process.env.SHOTS ?? join(HERE, '.shots');

/** The simulator's id, by name (Appium otherwise guesses an iOS version that may not be installed). */
function simulatorId(name) {
  const { devices } = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], { encoding: 'utf8' }));
  const sim = Object.values(devices).flat().find(d => d.name === name);
  if (!sim) throw new Error(`No "${name}" simulator: set IOS_SIM to one from \`xcrun simctl list devices\`.`);
  return sim.udid;
}

async function appiumUp() {
  try { return (await fetch(`http://127.0.0.1:${PORT}/status`)).ok; } catch { return false; }
}

/** Appium on :4723 (reused when one is already running) and a session in the demo app's web view. */
export async function openApp() {
  if (!existsSync(APP)) throw new Error(`No demo app at ${APP}: run \`npm run mobile:build\` at the repo root first.`);
  let server = null;
  if (!(await appiumUp())) {
    server = spawn('npx', ['appium', '--port', String(PORT), '--log-level', 'error'], {
      cwd: HERE, env: { ...process.env, APPIUM_HOME: join(HERE, '.appium') }, stdio: 'ignore',
    });
    for (let i = 0; i < 60 && !(await appiumUp()); i++) await new Promise(r => setTimeout(r, 500));
  }
  const driver = await remote({
    hostname: '127.0.0.1', port: PORT, logLevel: 'error',
    capabilities: {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:udid': simulatorId(process.env.IOS_SIM ?? 'iPhone 17'),
      'appium:app': APP,
      'appium:connectHardwareKeyboard': false,   // the on-screen keyboard, as on a phone
      'appium:fullReset': true,
      'appium:bootstrapPath': WDA,
      // The page inspector lists the app by its program name, not its app id.
      'appium:additionalWebviewBundleIds': ['process-App'],
      'appium:wdaLaunchTimeout': 300000,
      'appium:newCommandTimeout': 300,
    },
  });
  // The app's page lives in a web view; wait for it, then work inside it.
  let web;
  for (let i = 0; i < 60 && !web; i++) {
    web = (await driver.getContexts()).map(String).find(c => c.startsWith('WEBVIEW'));
    if (!web) await driver.pause(1000);
  }
  if (!web) throw new Error('The app\'s web view never appeared.');
  await driver.switchContext(web);
  // Wait for the app to finish starting (its header is up) before a test navigates.
  await driver.waitUntil(() => driver.execute(() => !!document.querySelector('.app-header')),
    { timeout: 30000, timeoutMsg: 'the app never finished starting' });
  mkdirSync(SHOTS, { recursive: true });
  return {
    driver, web,
    native: () => driver.switchContext('NATIVE_APP'),
    page: () => driver.switchContext(web),
    shot: (name) => driver.saveScreenshot(join(SHOTS, `${name}.png`)),
    close: async () => { await driver.deleteSession().catch(() => {}); server?.kill(); },
  };
}
