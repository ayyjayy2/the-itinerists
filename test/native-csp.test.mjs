// The iPhone app's Content-Security-Policy, derived from the website's (#445).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nativePolicy, injectPolicy, webPolicy } from '../scripts/native-csp.mjs';

const WEB = webPolicy(JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8')));
const dirs = p => Object.fromEntries(p.split(';').map(d => d.trim()).filter(Boolean).map(d => { const [k, ...v] = d.split(/\s+/); return [k, v]; }));

test('reads the production website policy from firebase.json', () => {
  assert.match(WEB, /script-src 'self'/);
  assert.match(WEB, /https:\/\/\*\.googleapis\.com/);
});

test("keeps what the app uses: Firebase, maps, weather, rates, fonts; scripts only from the app itself", () => {
  const d = dirs(nativePolicy(WEB));
  assert.deepEqual(d['script-src'], ["'self'"]);
  for (const host of ['https://*.googleapis.com', 'https://api.open-meteo.com', 'https://nominatim.openstreetmap.org', 'https://api.frankfurter.dev'])
    assert.ok(d['connect-src'].includes(host), host);
  assert.ok(d['img-src'].includes('https://*.tile.openstreetmap.org'));
  assert.ok(d['font-src'].includes('https://fonts.gstatic.com'));
  assert.deepEqual(d['object-src'], ["'none'"]);
});

test('drops what only the website needs: reCAPTCHA, Google Analytics, their frames', () => {
  const p = nativePolicy(WEB);
  assert.doesNotMatch(p, /recaptcha|google-analytics|googletagmanager|analytics\.google|www\.google\.com|gstatic\.com\/recaptcha/);
  assert.deepEqual(dirs(p)['frame-src'], ["'none'"]);
});

test('leaves out directives a <meta> policy ignores', () => {
  const p = nativePolicy(WEB + "; frame-ancestors 'none'; report-uri /x; sandbox");
  assert.doesNotMatch(p, /frame-ancestors|report-uri|sandbox/);
});

test('injects the policy as the first thing in <head>, once, replacing an older one', () => {
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>x</title></head><body></body></html>';
  const once = injectPolicy(html, "default-src 'self'");
  assert.match(once, /<head>\s*<meta http-equiv="Content-Security-Policy" content="default-src 'self'">/);
  const twice = injectPolicy(once, "default-src 'none'");
  assert.equal((twice.match(/Content-Security-Policy/g) || []).length, 1);
  assert.match(twice, /content="default-src 'none'"/);
});
