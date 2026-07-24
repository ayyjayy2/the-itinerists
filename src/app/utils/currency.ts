/**
 * Pure multi-currency helpers for the finance page. Rate tables follow the
 * Frankfurter shape: `rates` is keyed by currency code with values relative to
 * a base currency (rates[X] = units of X per 1 base). The base currency itself
 * is implicitly 1 and may be absent from the table.
 */

export type Rates = Record<string, number>;

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
 * Sum of every entry converted to `home` at the rates for its own date.
 * `ratesByDate` maps an ISO date → a base=`home` rate table. Entries whose date
 * rates are missing, or whose currency has no rate, are skipped and counted in
 * `missing` so the UI can caveat the total.
 */
export function convertedTotal(
  entries: { amount: number; currency: string; date: string }[],
  ratesByDate: Record<string, Rates>,
  home: string,
): { total: number; missing: number } {
  let total = 0, missing = 0;
  for (const e of entries) {
    const rates = ratesByDate[e.date];
    const converted = rates ? convertAmount(e.amount, e.currency, home, rates) : null;
    if (converted === null) { missing++; continue; }
    total += converted;
  }
  return { total, missing };
}
