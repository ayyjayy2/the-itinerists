#!/usr/bin/env node
/**
 * The iPhone app's Content-Security-Policy (#445).
 *
 * The website's policy comes from Firebase Hosting headers (firebase.json).
 * The iPhone app loads the same files from the phone (Capacitor), so no
 * header reaches it; this puts the policy in the page itself as a <meta> tag.
 * It is derived from the production website policy, so the two can't drift:
 * the same hosts for Firebase, maps, weather, rates and fonts, minus what only
 * the website uses (reCAPTCHA, Google Analytics and their frames).
 *
 * Run by `npm run ios:sync` after `cap sync`:
 *   node scripts/native-csp.mjs [path/to/index.html]   (default: the iOS copy)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The production website's policy, from firebase.json. */
export function webPolicy(firebaseJson) {
  const sites = Array.isArray(firebaseJson.hosting) ? firebaseJson.hosting : [firebaseJson.hosting];
  const site = sites.find(s => (s.site || s.target) === 'the-itinerists');
  const header = site?.headers?.flatMap(h => h.headers).find(h => /^content-security-policy$/i.test(h.key));
  if (!header) throw new Error('No Content-Security-Policy for the-itinerists in firebase.json');
  return header.value;
}

const WEB_ONLY = /recaptcha|google-analytics|googletagmanager|analytics\.google\.com|^https:\/\/www\.google\.com|^https:\/\/www\.gstatic\.com$/;
const META_IGNORED = new Set(['frame-ancestors', 'report-uri', 'report-to', 'sandbox']);

/** The iPhone app's policy: the website's, minus web-only hosts and what a <meta> policy can't carry. */
export function nativePolicy(web) {
  return web.split(';').map(d => d.trim()).filter(Boolean)
    .map(d => { const [name, ...values] = d.split(/\s+/); return { name, values }; })
    .filter(d => !META_IGNORED.has(d.name))
    .map(d => d.name === 'frame-src'
      ? { name: d.name, values: ["'none'"] }                       // the app opens no frames
      : { name: d.name, values: d.values.filter(v => !WEB_ONLY.test(v)) })
    .map(d => `${d.name} ${d.values.length ? d.values.join(' ') : "'none'"}`)
    .join('; ');
}

/** Put the policy first in <head>, replacing one put there before. */
export function injectPolicy(html, policy) {
  const tag = `<meta http-equiv="Content-Security-Policy" content="${policy.replace(/"/g, '&quot;')}">`;
  const without = html.replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/i, '');
  return without.replace(/<head>/i, `<head>\n  ${tag}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const target = process.argv[2] || join(ROOT, 'ios/App/App/public/index.html');
  const policy = nativePolicy(webPolicy(JSON.parse(readFileSync(join(ROOT, 'firebase.json'), 'utf8'))));
  writeFileSync(target, injectPolicy(readFileSync(target, 'utf8'), policy));
  console.log(`[native-csp] ${target}\n  ${policy}`);
}
