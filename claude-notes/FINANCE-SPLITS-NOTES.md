# Notes: Building Expense-Sharing Platforms

Lessons and patterns from building the Ireland trip finance tracker. Useful reference for any future expense-sharing app.

---

## Currency Conversion

### The Problem with Static Rates
Hardcoding a single exchange rate (e.g., `USD: 1.055`) seems fine until you compare against real credit card charges. The rate on any given day differs from a "remembered" or estimated rate, and small per-entry errors accumulate into noticeable discrepancies across an entire trip.

**Example from this project:** Using a rate of `1.055` (stale default) vs. `1.16` (what was actually used in the expense spreadsheet) caused a $0.25 understatement on just ~$90 EUR of purchases.

### Recommended Approaches

1. **Fetch rates automatically at entry time** — When a user logs an expense in EUR, fetch the live mid-market rate (e.g., from ECB, Open Exchange Rates, or Frankfurter API) and store *both* the original currency amount and the converted USD amount. Lock in that rate at the moment of entry.

2. **Per-entry stored rates** — Store `{ amount: 25.30, currency: "EUR", usdAtEntry: 29.36, rateUsed: 1.16 }`. Never re-derive the USD from the EUR after the fact — the real charge is already locked.

3. **If using a fixed rate, round-number it** — `1.16` is easier to reason about than `1.1576` and tends to be close enough for group splits. Just document clearly what rate was used and when.

4. **Free rate APIs to consider:**
   - [Frankfurter](https://www.frankfurter.app/) — ECB rates, free, no key required, supports historical dates: `GET /2026-03-19?from=EUR&to=USD`
   - [Open Exchange Rates](https://openexchangerates.org/) — free tier available
   - [ExchangeRate-API](https://www.exchangerate-api.com/) — free tier with historical support

### Credit Card vs. Mid-Market
Credit card companies apply their own conversion rate, typically 0–3% above the mid-market rate. If your users are paying by card in a foreign currency, the actual charged amount will always differ slightly from any API rate. For maximum accuracy, allow users to input the actual USD amount charged rather than entering a foreign currency amount.

---

## User Error — The Biggest Source of Discrepancy

In this project, most balance mismatches came from user entry mistakes, not math bugs.

### Common errors seen:
- **Duplicate entries** — Same expense entered twice under different names/dates (e.g., "Breakfast" and "Brekky" for the same meal)
- **Wrong payer** — Expense logged under the wrong person
- **Missing entries** — An expense never recorded at all (e.g., car rental Iceland)
- **Wrong split** — "Split equally" applied when the actual split was unequal (e.g., hotel where one person had a smaller room)
- **Currency mismatch** — EUR entry converted at a stale or incorrect rate

### Ways to reduce user error:

1. **Require a receipt / total amount confirmation** — Show the user "You entered $X — is that the total bill or your share?" before saving.

2. **Duplicate detection** — Warn if an entry with the same date + description + payer already exists.

3. **Smart defaults** — Pre-fill "split equally among all" but surface it clearly so users notice when it's wrong.

4. **Unequal split input** — Allow entering custom per-person amounts when not splitting evenly. Show a running total as amounts are filled in, and validate that the sum equals the bill total before saving.

5. **Confirmation receipts** — After entry, show a summary card: "Alayna paid $45 EUR for Bottle Rioja on Mar 19 — Linda, Madeleine, and Caitlin each owe $15 EUR (~$17.40). Does this look right?"

6. **Editable history** — Make it easy to fix or delete entries after the fact. A read-only ledger creates friction for corrections.

7. **Running balance visible at all times** — If users can see live net balances as they enter, they notice anomalies immediately (e.g., "why does Makaela owe me $0 — I just paid for her ticket?").

---

## Splitting One Expense Unevenly

Equal splits are the simplest but often wrong. Patterns to support:

| Split Type | Example | How to implement |
|---|---|---|
| Equal | Dinner split 4 ways | `amount / n` per person |
| Custom amounts | Hotel: Dad paid less for smaller room | Per-person amount input, validate sum = total |
| Percentage | 60/40 split between two people | Per-person % input |
| Exclude some | Only 3 of 8 people at this dinner | Multi-select "who was there" picker |
| One person pays all | Gift / treat | Single debtor, full amount |
| Shared + individual | Group appetizers equal, entrées individual | Two entries, or line-item mode |

**Key UX:** When the user selects custom amounts, show a live "remaining" counter (e.g., "$12.50 unallocated") that counts down to $0 as they fill in each person's share. Block save until it hits zero (or allow a small rounding tolerance of ±$0.05).

---

## Multi-Currency UX

- **Show the original currency** everywhere, not just the converted amount — "€25.30 ($29.36)" is more trustworthy than just "$29.36"
- **Allow filtering / totaling by currency** — users may want to see "what did we spend in EUR total"
- **Don't hide the rate** — show "converted at 1.16 on Mar 19" so users can verify
- **Settlement in a single currency** — even if expenses are logged in multiple currencies, settle debts in one (usually the home currency of the group majority)
- **Flag currency risk** — if a rate is more than X days old, warn the user: "This rate is from 3 days ago — update?"

---

## Settlement UX

- **Minimize transactions** — A naive ledger creates O(n²) pairings. Use a debt-simplification algorithm to reduce to the minimum number of payments (e.g., Splitwise's approach).
- **Mark as paid** — Allow marking a debt as settled without deleting the underlying entries (keeps the audit trail).
- **Partial payments** — Support "Linda paid Alayna $30 of the $60.39 she owes" — reduce balance, keep history.
- **Payment method hints** — Suggest Venmo/Zelle/cash when surfacing settlement amounts.

---

## Data Integrity

- **Immutable ledger** — Prefer append-only entries with edit/void operations over in-place mutation. Makes debugging much easier.
- **Audit trail** — Log who added/edited each entry and when.
- **Paid tracking** — Store a separate `paidItems` set keyed by `debtor__creditor__date__description` (as in this app). Be aware this key can collide if two identical entries exist — deduplication matters.
- **Seed / export** — Keep a local seed file synced from the live database. Invaluable for debugging balance discrepancies without guessing what's in prod.
