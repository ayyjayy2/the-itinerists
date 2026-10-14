import { ZONE_COUNTRIES } from './zone-countries';

/**
 * Is a trip abroad for this person? Each stop's time zone gives its country,
 * compared with the country of the phone's own zone (Tips & Recs partner
 * offers, #474). US territories count as the US: a US phone going to San Juan
 * isn't abroad.
 */
const US_TERRITORIES = new Set(['PR', 'VI', 'GU', 'AS', 'MP', 'UM']);

function countryOf(zone: string | null | undefined): string | null {
  const code = zone ? ZONE_COUNTRIES[zone] : undefined;
  if (!code) return null;
  return US_TERRITORIES.has(code) ? 'US' : code;
}

/** The stops' countries that differ from the phone's, in stop order, once each. */
export function foreignCountries(stopZones: ReadonlyArray<string | null | undefined>, deviceZone: string): string[] {
  const home = countryOf(deviceZone);
  if (!home) return [];
  const out: string[] = [];
  for (const z of stopZones) {
    const c = countryOf(z);
    if (c && c !== home && !out.includes(c)) out.push(c);
  }
  return out;
}

let names: Intl.DisplayNames | null | undefined;
/** "DE" → "Germany"; the code itself when the browser can't name it. */
export function countryName(code: string): string {
  if (names === undefined) {
    try { names = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { names = null; }
  }
  const n = names?.of(code);
  return n && n !== code && n !== 'Unknown Region' ? n : code;
}

/** "Germany", "Germany & Czechia", "Germany, Czechia + 2 more". */
export function countryList(list: readonly string[]): string {
  if (list.length <= 1) return list[0] ?? '';
  if (list.length === 2) return `${list[0]} & ${list[1]}`;
  return `${list[0]}, ${list[1]} + ${list.length - 2} more`;
}
