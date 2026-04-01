# App Architecture Notes

## Data flow
- `src/app/data/seed-data.ts` — fallback for first-time/empty Firestore installs only
- Firestore `app/tripData` — source of truth for all live data
- `npm run sync-seed` — pulls Firestore → seed-data.ts (run this to keep seed in sync)

## Migrations (data.service.ts → migrate())
- Always-on (no version gate): Graham→Stinky rename, Arthaus description renames
- V1: added missing entries (Cliffs, Belfast Hotel, GOT Tour, etc.)
- V2: fixed wrong splitAmong values (Alayna→Arielle in Iceland/Whale/Victoria)
- V3: added mock rental car entry
- V4: split Horseshoe Cottage into Night 1 + Night 2
- V5: fixed 7 data errors found via spreadsheet cross-check
- V6: removed 3 Dad→Makaela duplicate entries (hotel Mar10, blank Blue Lagoon Mar20, Exit row seat Mar19); fixed Cliffs of Moher split (Dad→Linda); removed Alayna from Mar26 parking split (she left Mar21)
- Next version: V7

To add a new migration: insert a new `if (!data.migrationVersion || data.migrationVersion < N)` block
and update the version in the return statement.

## Finance math
- All amounts stored in native currency (usually USD)
- Converted to EUR internally via `toEur(amount, currency)` using DEFAULT_RATES
- DEFAULT_RATES: USD=1.055, EUR=1, GBP=0.855, ISK=149.5
- Equal split: shareNative = entry.amount / splitNames.length
- Individual split: shareNative = entry.splits[debtor]
- paidBy is EXCLUDED from splitNames when computing debts
- splitAmong: 'All' expands to ALL financeUsers (8 people including Arielle & Stinky)

## Paid items
- Stored in Firestore `app/paidItems` as array of keys
- Key format: `debtor__creditor__date__description`
- DEFAULT_PAID_ITEMS pre-marks Arthaus Hotel Dad/Arielle/Stinky shares as settled

## Finance users
- Main app removes Arielle & Stinky from users[]
- Finance page always adds them back (financeUsers computed signal)
- Stinky = Graham's new name in the app

## Key files
- `src/app/services/data.service.ts` — Firestore listener, migrations, mutations
- `src/app/pages/finance/finance.component.ts` — all finance math (directDebts, personNetBreakdown, etc.)
- `src/app/data/seed-data.ts` — seed data (auto-updated by sync-seed script)
- `src/app/models/trip.models.ts` — TypeScript types
