import { money } from './event-text';
/**
 * Pure multi-currency helpers for the finance page. Rate tables follow the
 * Frankfurter shape: `rates` is keyed by currency code with values relative to
 * a base currency (rates[X] = units of X per 1 base). The base currency itself
 * is implicitly 1 and may be absent from the table.
 */

export type Rates = Record<string, number>;

/** The rate saved on an expense (#687): `value` units of the trip's currency `to` per 1 unit
 *  of the expense's currency, for the day `on`. Amounts never move once it's saved. */
export interface SavedRate { to: string; value: number; on: string }

/**
 * An expense's rates into every currency the group uses (#723): `per[X]` units
 * of X for 1 unit of the expense's own currency, on the day `on`. Saved when
 * it's added, filled in for currencies chosen later, so an amount in any
 * currency is fixed and the same for everyone.
 */
export interface SavedRates { on: string; per: Record<string, number> }

/** The trip's currency and each member's own, once each, trip's first. */
export function groupCurrencies(trip: string, members: readonly { ownCurrency?: string }[]): string[] {
  return [...new Set([trip, ...members.map(m => m.ownCurrency).filter((c): c is string => !!c)])];
}

/** From a table based on the expense's currency (table[X] = X per 1), the wanted rates it has, its own left out. */
export function lockRates(currency: string, wanted: readonly string[], table: Rates | null, on: string): SavedRates | null {
  if (!table) return null;
  const per: Record<string, number> = {};
  for (const c of wanted) if (c !== currency && table[c] > 0) per[c] = table[c];
  return { on, per };
}

/** The group currencies an expense has no saved rate for yet (its own currency never needs one). */
export function missingRates(e: { currency: string; rates?: SavedRates | null }, wanted: readonly string[]): string[] {
  return wanted.filter(c => c !== e.currency && !((e.rates?.per?.[c] ?? 0) > 0));
}

/** Add rates an expense was missing; the ones it already had (and their day) stay as they were. */
export function mergeRates(had: SavedRates | null | undefined, found: SavedRates): SavedRates {
  return { on: had?.on ?? found.on, per: { ...found.per, ...(had?.per ?? {}) } };
}

/**
 * The expenses missing a group currency (#723), grouped by their currency and
 * day so each group needs one rate lookup: the day their rates were saved on,
 * else the day they use for rates (rateDay).
 */
export function fillPlan(
  entries: readonly { id: string; currency: string; date: string; createdAt?: number; rates?: SavedRates | null }[],
  groupWanted: readonly string[], todayISO: string,
): { currency: string; on: string; ids: string[]; wanted: string[] }[] {
  const groups = new Map<string, { currency: string; on: string; ids: string[]; wanted: string[] }>();
  for (const e of entries) {
    const missing = missingRates(e, groupWanted);
    if (!missing.length) continue;
    const on = e.rates?.on ?? rateDay(e, todayISO);
    const key = `${e.currency}|${on}`;
    const g = groups.get(key) ?? { currency: e.currency, on, ids: [], wanted: [] };
    g.ids.push(e.id);
    for (const c of missing) if (!g.wanted.includes(c)) g.wanted.push(c);
    groups.set(key, g);
  }
  const order = (c: string) => groupWanted.indexOf(c);
  return [...groups.values()].map(g => ({ ...g, wanted: g.wanted.sort((a, b) => order(a) - order(b)) }));
}

/** The rate to save on an expense, from a base=`home` table for its day; null in the trip's
 *  own currency, or when there's no rate for that currency. */
export function lockRate(currency: string, home: string, rates: Rates | null, on: string): SavedRate | null {
  if (currency === home || !rates?.[currency]) return null;
  return { to: home, value: 1 / rates[currency], on };
}

/** Which day's rate an expense without a saved one uses (#687): its own date once that has
 *  passed, else the day it was entered, so it stops following today's rate. */
export function rateDay(e: { date: string; createdAt?: number }, todayISO: string): string {
  const entered = e.createdAt ? localISO(new Date(e.createdAt)) : todayISO;
  const day = e.date && e.date < entered ? e.date : entered;
  return day < todayISO ? day : todayISO;
}
/** After an edit, the date and currency to fetch a new saved rate for, or null when neither changed. */
export function needsNewRate(before: { date: string; currency: string }, patch: { date?: string; currency?: string }): { date: string; currency: string } | null {
  const date = patch.date ?? before.date, currency = patch.currency ?? before.currency;
  return date !== before.date || currency !== before.currency ? { date, currency } : null;
}
/** A trip-currency amount in the person's own currency (#429), from a base=trip `latest` table;
 *  null when they have none, it's the trip's, or there's no rate yet. Approximate: today's rate. */
export function inOwnCurrency(amount: number, tripCurrency: string, own: string | undefined, latest: Rates | null): { amount: number; currency: string } | null {
  const rate = own && own !== tripCurrency ? latest?.[own] : undefined;
  return rate ? { amount: Math.round(amount * rate * 100) / 100, currency: own! } : null;
}
function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * An amount with its currency (#719): the symbol where it has one (฿3,840.00,
 * $30.00), otherwise its code (CHF 10.00), always with cents. No bare numbers.
 */
export function amountText(amount: number, currency: string): string {
  try {
    return amount.toLocaleString('en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .replace(/\u00a0/g, ' ');
  } catch {
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;   // not a code Intl knows
  }
}

/**
 * Convert `amount` from `from` into `to`, given a `rates` table whose base is
 * `to` (so rates[from] = units of `from` per 1 `to`). Returns null when the
 * source rate is unavailable — callers surface that rather than guess.
 */
export function convertAmount(amount: number, from: string, to: string, rates: Rates): number | null {
  if (from === to) return amount;
  const r = rates[from];
  if (!r) return null;
  return amount / r;
}

/** Exact sums grouped by each entry's currency (no conversion). */
export function perCurrencySubtotals(entries: { amount: number; currency: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    out[e.currency] = (out[e.currency] ?? 0) + e.amount;
  }
  return out;
}

/**
 * Convert a single expense share into the `home` currency for settlement:
 *   1. already home, or a rate saved on the expense (#687) → exact.
 *   2. date rate available → convert, exact.
 *   3. else latest rate available → convert, estimated.
 *   4. else (unsupported currency) → face value as home, estimated (last resort;
 *      never drops the amount from the settlement).
 * `estimated` is true whenever the value isn't an exact date-rate conversion,
 * so the UI can flag the settlement as approximate.
 */
export function convertShare(
  amount: number,
  currency: string,
  date: string,
  ratesByDate: Record<string, Rates>,
  latestRates: Rates | null,
  home: string,
  rate?: SavedRate | null,
): { amount: number; estimated: boolean } {
  if (currency === home) return { amount, estimated: false };
  if (rate && rate.to === home) return { amount: amount * rate.value, estimated: false };

  const dateRates = ratesByDate[date];
  const exact = dateRates ? convertAmount(amount, currency, home, dateRates) : null;
  if (exact !== null) return { amount: exact, estimated: false };

  const viaLatest = latestRates ? convertAmount(amount, currency, home, latestRates) : null;
  if (viaLatest !== null) return { amount: viaLatest, estimated: true };

  return { amount, estimated: true }; // last resort: face value
}

/**
 * Sum of every entry converted to `home` at the rates for its own date.
 * `ratesByDate` maps an ISO date → a base=`home` rate table. Entries whose date
 * rates are missing, or whose currency has no rate, are skipped and counted in
 * `missing` so the UI can caveat the total.
 */
export function convertedTotal(
  entries: { amount: number; currency: string; date: string; rate?: SavedRate | null }[],
  ratesByDate: Record<string, Rates>,
  home: string,
): { total: number; missing: number } {
  let total = 0, missing = 0;
  for (const e of entries) {
    if (e.currency !== home && e.rate?.to === home) { total += e.amount * e.rate.value; continue; }
    const rates = ratesByDate[e.date];
    const converted = rates ? convertAmount(e.amount, e.currency, home, rates) : null;
    if (converted === null) { missing++; continue; }
    total += converted;
  }
  return { total, missing };
}

/**
 * Amounts in several currencies as text, one per currency with the trip's own
 * first ("€300.00 + $12.00"). Different currencies are never added together.
 */
export function perCurrencyText(entries: { amount: number; currency: string }[], home: string): string {
  const sums = Object.entries(perCurrencySubtotals(entries));
  if (!sums.length) return money(0, home);
  return sums
    .sort(([a], [b]) => (a === home ? -1 : b === home ? 1 : a.localeCompare(b)))
    .map(([currency, amount]) => money(amount, currency))
    .join(' + ');
}
