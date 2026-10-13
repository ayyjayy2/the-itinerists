# Authorization check on staging (two real accounts)

Run on **2026-10-12** against the staging project (`the-itinerists-staging`) for #403, from the review's SEC-01.
It is repeatable: `npx playwright test -c playwright.staging.config.ts --project authorization`
(needs `scripts/staging-accounts.local.json` and the staging service-account key; it adds tagged test data and removes it).

## How

The test signs in as two real staging accounts with the **real Firebase client**, the same requests a modified app
could send, and tries to read and write by document id. Staging doesn't enforce App Check, so every request
reaches the security rules. It never touches production.

- **Maya** owns a finished test trip and is a member of the demo trip.
- **Sam** is on no trip: the outsider.
- Test data (one doc in every trip sub-collection, private packing lists and outfit photos, an invite) is added
  with the Admin SDK, tagged, and deleted afterwards.

## Results

| Who | Tried | Result |
|---|---|---|
| Sam (outsider) | Read the trip, its members or invites; read or list each of the 13 trip sub-collections by id; read the owner's packing list or outfit photo | **Refused** |
| Sam (outsider) | Rename or delete the trip, take ownership (`createdBy`), write any sub-collection | **Refused** |
| Sam (outsider) | Join with no invite, a made-up code, as owner, or as owner with a real code; mint or extend an invite | **Refused** |
| Sam (outsider) | Read Maya's profile, private account (email), trip list or My Expenses; add a trip to her list; list users; read usage events, the write log, Pulse settings or the iPhone launch list | **Refused** |
| Maya (member) | Take ownership, delete the trip, make herself owner, remove or re-role another member, mint an invite, read another member's outfit photo | **Refused** |
| Maya (member) | Read or change **another member's packing list** | **Allowed before the fix → refused now** |
| Sam (added, then removed) | Read the trip and itinerary while a member (allowed), then after removal, in the same session: read, write, rejoin without an invite | **Refused after removal** |
| Maya (owner, tearing a trip down) | List everyone's packing lists or read a removed member's | **Refused** |
| Maya (owner, tearing a trip down) | Delete her own and a removed member's packing list by id | **Allowed** (what the app's teardown does) |

## Found and fixed

**Packing lists were readable and writable by every member of a trip**, though the privacy policy says a packing
list is visible only to you. `packing` sat in the shared "any member" list of sub-collections.

- `firestore.rules`: `trips/{trip}/packing/{uid}` is read/write for that person only; the trip owner may delete one
  (a removed member's, at teardown) but never read it.
- `TripService` teardown deletes packing lists by person (yours, then each removed member's) instead of listing them.
- Rules tests: own list allowed; another member's read, write and list refused; owner's delete allowed.

## Not covered here

Exports and background jobs (none run server-side yet), invite expiry and reuse (#404), sessions and recovery (#405),
local data after logout (#406), and Storage rules (no production bucket yet).
