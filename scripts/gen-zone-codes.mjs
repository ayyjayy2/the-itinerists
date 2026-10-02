#!/usr/bin/env node
/**
 * Writes public/api-console/zone-codes/: one small file per time zone code
 * (est.json, cst.json, cest.json…) listing every zone that shows that code at
 * some point in the year, plus index.json with every code. The API console
 * serves them so a code can be looked up like an endpoint:
 *   GET /api-console/zone-codes/est.json
 * Codes come from the same three-step lookup the app uses (src/app/utils/zones.ts,
 * mirrored in public/pulse/zone-codes.mjs), checked in mid-January and mid-July,
 * so EST finds New York (winter) and Panama (all year).
 * Run after changing either code table, or once a year:  node scripts/gen-zone-codes.mjs
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODE_BY_LONG_NAME, CODE_BY_ZONE } from '../public/pulse/zone-codes.mjs';
import { ZONES } from '../public/pulse/zones.mjs';
import { zoneCodeFile } from '../public/api-console/normalize.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'api-console', 'zone-codes');
const YEAR = new Date().getUTCFullYear();
const SAMPLES = { January: Date.UTC(YEAR, 0, 15, 12), July: Date.UTC(YEAR, 6, 15, 12) };

const timeZoneName = (zone, locale, style, at) => {
  try { return new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: style }).formatToParts(at).find(p => p.type === 'timeZoneName')?.value ?? ''; }
  catch { return ''; }
};
function offsetMinutes(zone, ms) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms))) p[x.type] = Number(x.value);
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour === 24 ? 0 : p.hour, p.minute) - Math.floor(ms / 60_000) * 60_000) / 60_000);
}
const offsetText = m => `UTC${m < 0 ? '−' : '+'}${Math.floor(Math.abs(m) / 60)}${Math.abs(m) % 60 ? ':' + String(Math.abs(m) % 60).padStart(2, '0') : ''}`;
/** Same steps as zoneAbbr() in src/app/utils/zones.ts. */
function zoneAbbr(zone, ms) {
  const at = new Date(ms);
  if (CODE_BY_ZONE[zone]) return CODE_BY_ZONE[zone].includes('/') ? zoneAbbr(CODE_BY_ZONE[zone], ms) : CODE_BY_ZONE[zone];
  const isOffset = a => /^(GMT|UTC)[+\-−]/.test(a);
  for (const locale of ['en-US', 'en-GB', 'en-AU', 'en-IN', 'en-NZ', 'en-ZA', 'en-SG', 'en-HK', 'en-PH', 'en-IE', 'en-CA', 'en-MY']) {
    const a = timeZoneName(zone, locale, 'short', at);
    if (a && !isOffset(a)) return a;
  }
  const long = timeZoneName(zone, 'en-US', 'long', at);
  if (CODE_BY_LONG_NAME[long]) return CODE_BY_LONG_NAME[long];
  if (long && !isOffset(long)) {
    const initials = long.replace(/[’'&]/g, '').split(/\s+/).filter(w => w !== 'Time').map(w => w[0].toUpperCase()).join('');
    if (initials.length >= 2) return initials;
  }
  return offsetText(offsetMinutes(zone, ms));
}

const byCode = new Map();
for (const zone of Object.keys(ZONES).sort()) {
  const seen = Object.entries(SAMPLES).map(([month, ms]) => ({ month, code: zoneAbbr(zone, ms), offset: offsetText(offsetMinutes(zone, ms)) }));
  for (const code of new Set(seen.map(s => s.code))) {
    if (/^UTC[+−-]/.test(code)) continue;   // a bare offset is not a code anyone searches for
    const hits = seen.filter(s => s.code === code);
    const { city, region, country } = ZONES[zone];
    const row = { zone, city, ...(region ? { region } : {}), country, offset: hits[0].offset, when: hits.length === 2 ? 'all year' : `around ${hits[0].month}` };
    (byCode.get(code) ?? byCode.set(code, []).get(code)).push(row);
  }
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const index = [];
for (const [code, zones] of [...byCode].sort(([a], [b]) => a.localeCompare(b))) {
  const file = zoneCodeFile(code) + '.json';   // the console asks for the same name
  writeFileSync(join(OUT, file), JSON.stringify({ code, zones }, null, 2) + '\n');
  index.push({ code, zones: zones.length, file });
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`wrote ${index.length} codes to public/api-console/zone-codes/ (checked ${Object.keys(ZONES).length} zones in January and July ${YEAR})`);
