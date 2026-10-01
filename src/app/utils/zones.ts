/**
 * Time zone arithmetic on top of Intl, no library. Trip times are wall-clock
 * times somewhere else (the destination, an airport), while the phone's clock
 * is wherever the person is. Everything that compares a trip time with "now"
 * goes through here.
 */

/** The phone's own zone, e.g. "America/Chicago". */
export function deviceZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string): Intl.DateTimeFormat {
  let f = partsCache.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    partsCache.set(zone, f);
  }
  return f;
}

/** Wall-clock parts of a UTC instant in `zone`. */
export function wallClockIn(zone: string, utcMs: number): { y: number; m: number; d: number; h: number; min: number; s: number } {
  const p: Record<string, number> = {};
  for (const part of formatter(zone).formatToParts(new Date(utcMs))) if (part.type !== 'literal') p[part.type] = Number(part.value);
  return { y: p['year'], m: p['month'], d: p['day'], h: p['hour'] === 24 ? 0 : p['hour'], min: p['minute'], s: p['second'] };
}

/** Minutes east of UTC that `zone` is at the given instant (Lisbon in October: +60). */
export function utcOffsetMinutes(zone: string, utcMs: number): number {
  const w = wallClockIn(zone, utcMs);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.min, w.s);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60_000);
}

/** The instant at which the wall clock in `zone` reads date + h:min. */
export function wallToUtcMs(dateISO: string, h: number, min: number, zone: string): number {
  const [y, mo, d] = dateISO.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, min);
  let utc = guess - utcOffsetMinutes(zone, guess) * 60_000;
  const second = guess - utcOffsetMinutes(zone, utc) * 60_000;   // settles across a DST edge
  if (second !== utc) utc = second;
  return utc;
}

/** Today's YYYY-MM-DD as the clock in `zone` sees it. */
export function todayISOInZone(zone: string, utcMs: number = Date.now()): string {
  const w = wallClockIn(zone, utcMs);
  return `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`;
}

/**
 * Codes for zones whose English locale data has no short name, keyed by the
 * long name Intl gives them ("Indochina Time" → ICT). These are the codes in
 * everyday use (the tz database's historical abbreviations); a traveller
 * always sees a code, never "GMT+7".
 */
const CODE_BY_LONG_NAME: Record<string, string> = {
  'Indochina Time': 'ICT', 'Japan Standard Time': 'JST', 'Korean Standard Time': 'KST', 'China Standard Time': 'CST',
  'Taiwan Standard Time': 'CST', 'Philippine Standard Time': 'PHT', 'Western Indonesia Time': 'WIB', 'Central Indonesia Time': 'WITA',
  'Eastern Indonesia Time': 'WIT', 'Moscow Standard Time': 'MSK', 'Türkiye Standard Time': 'TRT', 'Israel Standard Time': 'IST',
  'Israel Daylight Time': 'IDT', 'Iran Standard Time': 'IRST', 'Iran Daylight Time': 'IRDT', 'Pakistan Standard Time': 'PKT',
  'Bangladesh Standard Time': 'BST', 'Arabian Standard Time': 'AST', 'Nepal Time': 'NPT', 'Myanmar Time': 'MMT', 'Bhutan Time': 'BTT',
  'Brunei Time': 'BNT', 'Timor-Leste Time': 'TLT', 'Afghanistan Time': 'AFT', 'Armenia Standard Time': 'AMT', 'Azerbaijan Standard Time': 'AZT',
  'Georgia Standard Time': 'GET', 'Kazakhstan Time': 'ALMT', 'Kyrgyzstan Time': 'KGT', 'Tajikistan Time': 'TJT',
  'Turkmenistan Standard Time': 'TMT', 'Uzbekistan Standard Time': 'UZT', 'Ulaanbaatar Standard Time': 'ULAT', 'Khovd Standard Time': 'HOVT',
  'Irkutsk Standard Time': 'IRKT', 'Krasnoyarsk Standard Time': 'KRAT', 'Omsk Standard Time': 'OMST', 'Yekaterinburg Standard Time': 'YEKT',
  'Samara Standard Time': 'SAMT', 'Vladivostok Standard Time': 'VLAT', 'Yakutsk Standard Time': 'YAKT', 'Magadan Standard Time': 'MAGT',
  'Kamchatka Standard Time': 'PETT', 'Brasilia Standard Time': 'BRT', 'Brasilia Summer Time': 'BRST', 'Argentina Standard Time': 'ART',
  'Colombia Standard Time': 'COT', 'Peru Standard Time': 'PET', 'Venezuela Time': 'VET', 'Bolivia Time': 'BOT', 'Ecuador Time': 'ECT',
  'Uruguay Standard Time': 'UYT', 'Paraguay Standard Time': 'PYT', 'Paraguay Summer Time': 'PYST', 'Chile Standard Time': 'CLT',
  'Chile Summer Time': 'CLST', 'Amazon Standard Time': 'AMT', 'Acre Standard Time': 'ACT', 'Fernando de Noronha Standard Time': 'FNT',
  'French Guiana Time': 'GFT', 'Guyana Time': 'GYT', 'Suriname Time': 'SRT', 'Mexican Pacific Standard Time': 'MST',
  'Cuba Standard Time': 'CST', 'Cuba Daylight Time': 'CDT', 'Yukon Time': 'MST', 'Greenland Summer Time': 'WGST',
  'Greenland Standard Time': 'WGT', 'Azores Summer Time': 'AZOST', 'Azores Standard Time': 'AZOT', 'Cape Verde Standard Time': 'CVT',
  'Greenwich Mean Time': 'GMT', 'Mauritius Standard Time': 'MUT', 'Réunion Time': 'RET', 'Seychelles Time': 'SCT', 'Maldives Time': 'MVT',
  'Indian Ocean Time': 'IOT', 'Fiji Standard Time': 'FJT', 'Samoa Standard Time': 'SST', 'American Samoa Standard Time': 'SST',
  'Chamorro Standard Time': 'ChST', 'Papua New Guinea Time': 'PGT', 'Solomon Islands Time': 'SBT', 'Vanuatu Standard Time': 'VUT',
  'New Caledonia Standard Time': 'NCT', 'Norfolk Island Standard Time': 'NFT', 'Tonga Standard Time': 'TOT', 'Tahiti Time': 'TAHT',
  'Marquesas Time': 'MART', 'Gambier Time': 'GAMT', 'Cook Islands Standard Time': 'CKT', 'Niue Time': 'NUT', 'Tokelau Time': 'TKT',
  'Tuvalu Time': 'TVT', 'Wallis & Futuna Time': 'WFT', 'Wake Island Time': 'WAKT', 'Palau Time': 'PWT', 'Nauru Time': 'NRT',
  'Kosrae Time': 'KOST', 'Pohnpei Time': 'PONT', 'Chuuk Time': 'CHUT', 'Marshall Islands Time': 'MHT', 'Gilbert Islands Time': 'GILT',
  'Phoenix Islands Time': 'PHOT', 'Line Islands Time': 'LINT', 'Pitcairn Time': 'PST', 'Galapagos Time': 'GALT',
  'Easter Island Standard Time': 'EAST', 'Easter Island Summer Time': 'EASST', 'Christmas Island Time': 'CXT', 'Cocos Islands Time': 'CCT',
  'Falkland Islands Standard Time': 'FKT', 'South Georgia Time': 'GST', 'French Southern & Antarctic Time': 'TFT', 'Davis Time': 'DAVT',
  'Dumont d’Urville Time': 'DDUT', 'Mawson Time': 'MAWT', 'Rothera Time': 'ROTT', 'Syowa Time': 'SYOT', 'Vostok Time': 'VOST',
};

/** A few zones Intl only knows by offset: a neighbour zone to follow, or the code itself. */
const CODE_BY_ZONE: Record<string, string> = {
  'Europe/Guernsey': 'Europe/London', 'Europe/Jersey': 'Europe/London', 'Europe/Isle_of_Man': 'Europe/London',
  'America/Punta_Arenas': 'CLST', 'America/Coyhaique': 'CLST', 'Antarctica/Palmer': 'CLST',   // Magallanes stays on summer time all year
  'Antarctica/Troll': 'Europe/Berlin', 'Asia/Amman': 'AST', 'Asia/Damascus': 'AST',          // Jordan and Syria moved to UTC+3 for good
  'Asia/Urumqi': 'XJT', 'Pacific/Bougainville': 'BST',
};

const timeZoneName = (zone: string, locale: string, style: 'short' | 'long', at: Date): string => {
  try { return new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: style }).formatToParts(at).find(p => p.type === 'timeZoneName')?.value ?? ''; }
  catch { return ''; }
};

/**
 * The code a traveller would write after a time: "WEST", "EDT", "CEST", "ICT".
 * English locale data first (several locales, since each knows its own region's
 * codes), then the table above by long name, then the initials of the long name.
 * Only a zone that has no name anywhere ends up as "UTC+3".
 */
export function zoneAbbr(zone: string, utcMs: number = Date.now()): string {
  const at = new Date(utcMs);
  if (CODE_BY_ZONE[zone]) return CODE_BY_ZONE[zone].includes('/') ? zoneAbbr(CODE_BY_ZONE[zone], utcMs) : CODE_BY_ZONE[zone];
  const isOffset = (a: string) => /^(GMT|UTC)[+\-−]/.test(a);
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
  const off = utcOffsetMinutes(zone, utcMs), sign = off < 0 ? '-' : '+', h = Math.floor(Math.abs(off) / 60), m = Math.abs(off) % 60;
  return `UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

/** The abbreviation when `zone` differs from the phone's clock, else "" (no label needed at home). */
export function zoneLabelIfForeign(zone: string | undefined, utcMs: number = Date.now()): string {
  if (!zone) return '';
  const here = deviceZone();
  if (zone === here) return '';
  return utcOffsetMinutes(zone, utcMs) === utcOffsetMinutes(here, utcMs) ? '' : zoneAbbr(zone, utcMs);
}
