# "My Expenses" privacy — design

**Date:** 2026-07-23
**Status:** Approved

## Problem

The per-user **My Expenses** page (`ExpensesService`) stores data in a global
top-level collection `userExpenses/{username}` (`{ items }`), governed by:

```
match /userExpenses/{name} { allow read, write: if isSignedIn(); }
```

Any signed-in user — including non-members of the trip — can read or overwrite
*anyone's* personal expenses by knowing their display name. The doc is keyed by
display name (not uid) and is not owner-scoped. This is a data-exposure bug on
financial data.

For contrast, the shared **Finance** page (`FinanceService`) stores at
`trips/{tripId}/finance/*`, which is already correctly members-gated via the
enumerated `{sub}/{doc}` allowlist. No change there.

## Decision

My Expenses is **private to its owner**: only the signed-in user may read or
write their own expenses. Key the doc by `uid` and gate with the same pattern
the rules already use for `userTrips/{userId}`.

## Approach

**Storage:** `userExpenses/{uid}` → `{ items }` (was `userExpenses/{username}`).

**Rule** (`firestore.rules`), mirroring `userTrips`:
```
match /userExpenses/{userId} {
  allow read, write: if isSignedIn() && userId == uid();
}
```

**Service** (`ExpensesService`): key the Firestore doc by `user.uid` in `init()`
and `save()`. Guard on `user?.uid`. **localStorage keys stay name-based**
(`tripplanner_expenses_[backup_]{name}`) so the existing seed-from-backup path
still recovers any locally-cached expenses into the new uid-keyed doc — this
doubles as the migration for local data. Component API is unchanged.

## Migration

None needed server-side. The live project (`trip-planner-ayyjayy2`) has **0**
docs in `userExpenses`. Any locally-cached expenses migrate automatically via
the name-keyed localStorage seed on next load.

## Testing

Extend `test/firestore-rules.test.mjs` (`npm run test:rules`, emulator):
- owner reads / writes their own `userExpenses/{uid}` → allow,
- reading or writing another user's expenses → deny,
- anon → deny.

Plus `ng build`.

## Out of scope

- Making expenses trip-scoped (they remain a single per-user list, as today).
- Re-keying localStorage to uid (local-only; kept name-based to preserve data).
