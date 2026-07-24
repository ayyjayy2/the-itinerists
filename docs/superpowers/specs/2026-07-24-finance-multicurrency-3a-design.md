# Finance multi-currency — Phase 3a (entry, rates, totals)

**Date:** 2026-07-24
**Status:** Approved

## Goal
Let finance expenses be entered in different currencies and show meaningful
totals: each expense in its own currency, plus a totals view that toggles
between **"All"** (converted to the home currency) and per-currency native
subtotals. Conversions use **date-specific** historical rates. Part of the
multi-destination project ([[project_multi_destination]]).

**3a is entry + display + rates.** The who-owes-whom settlement rework (netting
across currencies) is **Phase 3b**, a separate PR — this phase leaves the debt
engine as-is (it currently sums raw amounts) and focuses on entry and totals.

## Decisions (from brainstorming)
- **Home currency** = the trip's primary currency (`trip.currency`).
- **Entry default** = last-used currency (persisted per trip in localStorage).
- **Rates** = `api.frankfurter.dev` (free ECB, no key), **date-specific** — each
  expense converts at the rate for its own date. Cached per (date) in
  localStorage. Add the host to CSP `connect-src`.
- **Expense list**: each row in the currency it was entered in.
- **Totals toggle**: "All" (default) = grand total converted to home currency
  ("≈ approximate"); each currency = native subtotal of expenses in that
  currency (exact). Toggle lists only currencies actually used on the trip.

## Rates service (`ExchangeRateService`)
- `ratesFor(dateISO): Promise<Record<string,number>>` — base = home currency;
  fetches `https://api.frankfurter.dev/v1/{date}?base={home}` (clamped: future
  dates and today use `/latest`), caches per date in localStorage
  (`tripplanner_fx_{home}_{date}`). One in-flight request per date (dedupe).
- Frankfurter returns rates relative to base; `rates[home]` is implicitly 1.
- **Graceful failure**: if a date's rates can't be fetched (offline / API down /
  unknown currency), conversion for that expense is skipped and the UI shows the
  native amount with a "rate unavailable" marker rather than a wrong number.

## Pure conversion helpers (`utils/currency.ts`, unit-tested)
- `convertAmount(amount, from, to, rates): number | null` — `rates` is a
  base=`to` table; returns `amount / rates[from]` (null if `rates[from]` missing).
  (`to` maps to 1.)
- `perCurrencySubtotals(entries): Record<string, number>` — sum grouped by
  each entry's currency (exact, no conversion).
- `convertedTotal(entries, ratesByDate, home): { total, missing }` — sum of each
  entry converted at its date's rates to `home`; `missing` counts entries whose
  rate was unavailable (surfaced in the UI caveat).

## Add-expense form (`finance.component`)
- Replace the hardcoded `currency: 'USD'` with `app-currency-select`, defaulting
  to the trip's last-used currency (fallback: `trip.currency`).
- Persist last-used per trip on save.
- Store the chosen `currency` on the entry (field already exists on the model).

## Totals UI
- A currency toggle above the totals: `All` + one chip per distinct currency
  used. Default `All`.
- `All`: converted grand total in the home currency, with an "≈ approximate,
  rates by date" note; if any expense's rate is missing, note "N not converted".
- A specific currency: the exact native subtotal for that currency.

## Testing
- **Unit (`test:ci`)**: `convertAmount`, `perCurrencySubtotals`, `convertedTotal`
  (including the missing-rate path). Pure, no network.
- `ng build` clean; CSP updated so the Frankfurter host is allowed.
- **Live**: add expenses in two currencies on a trip; expense list shows each in
  its own currency; totals toggle switches All (converted) ↔ per-currency.

## Out of scope (→ 3b)
- The who-owes-whom settlement converting/netting across currencies + showing
  original-currency components. Debt engine stays as-is in 3a.
