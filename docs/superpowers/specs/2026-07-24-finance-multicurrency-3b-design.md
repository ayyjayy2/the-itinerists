# Finance multi-currency — Phase 3b (settlement conversion)

**Date:** 2026-07-24
**Status:** Approved

## Goal
Make the who-owes-whom settlement correct across currencies: convert each
expense share to the trip's home currency at the expense's date-specific rate,
net in home currency, and show the original-currency components. Completes the
finance multi-currency work ([[project_multi_destination]], after Phase 3a).

## Problem
`directDebts()` accumulates each split share (in the entry's **original**
currency) into `amountUsd` and treats it as USD. Every downstream computed
(`personNetBreakdown`, `totalOwedToMeUsd`/`totalIOweUsd`, `paidBalanceUsd`,
`filteredSettlementItems`) reads those mislabeled shares. On a mixed-currency
trip the debts are wrong; on a non-USD trip the "USD" labels are wrong too.

## Core change
In `directDebts()`, convert each item's share to the **home currency**
(`trip.currency`) at the entry's date rate before it enters the math. The debt
item gains original-currency fields:
```ts
interface DebtItem {
  id; label; date; description; notes;
  amount: number;        // share converted to home currency (drives netting)
  origAmount: number;    // share in its original currency
  origCurrency: string;
  estimated: boolean;    // true when a fallback rate was used
}
```
`DirectDebt.amountUsd` → `amountHome`. All existing computeds keep working — they
just now sum home-currency values. `directDebts` reads the `ratesByDate` signal
(from 3a) so it recomputes as rates load.

## Conversion + missing-rate rule (decided)
`convertShare(amount, currency, date, ratesByDate, latestRates, home)` →
`{ amount, estimated }`:
1. `currency === home` → `{ amount, estimated: false }`.
2. date rate available → convert, `estimated: false`.
3. else latest rate available → convert, `estimated: true`.
4. else (currency unsupported) → face value as home, `estimated: true` (last
   resort; never drops a debt).
Historical rates are almost always available, so 3–4 are rare. Pure + unit-tested.

The component loads `latestRates` once (`ratesFor(home, 'latest')`) alongside the
per-date rates it already preloads in 3a.

## Display ("convert + show original")
- Settlement amounts render in the **home currency** code (not hardcoded USD).
- **"≈"** prefix whenever any converted item contributed to a figure; exact (no
  ≈) when every contributing item was already in the home currency.
- Expanding a debt shows each item in **its original currency**
  (`origAmount origCurrency`).
- A subtle note — "≈ approximate; some rates estimated" — shows only when an
  `estimated` fallback was used anywhere in the visible settlement.
- Remove the Phase 3a mixed-currency caveat banner (settlement now converts).

## Scope of edits
- `finance.component.ts`: `directDebts` conversion, `amountUsd`→`amountHome`,
  load `latestRates`, an `anyEstimated`/`homeCurrency`-labelled helper.
- `finance.component.html`: replace `${{ … | number }} USD` settlement figures
  with `{{ … }} {{ homeCurrency() }}` + `≈`; per-item original-currency display;
  remove the caveat banner.
- `utils/currency.ts`: add `convertShare`.

## Testing
- **Unit (`test:ci`)**: `convertShare` — home passthrough, date-rate hit,
  latest-rate fallback (estimated), last-resort face value (estimated).
- `ng build` clean.
- **Live**: mixed-currency debts (e.g. a EUR expense + a USD expense split
  between two people) net to a single home-currency "≈" figure; expanding shows
  original currencies; a non-USD-home trip shows the right code.

## Out of scope
- Per-currency settlement toggle (settlement is always home currency here).
- Editing/adding rates manually.
