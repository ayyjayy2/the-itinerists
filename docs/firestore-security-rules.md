# Firestore security rules (TP-9)

Replaces the wide-open dev rule (`allow read, write: if true`) with a
member-scoped model now that Firebase Auth is wired up.

## Access model

| Data | Read | Write |
|---|---|---|
| `trips/{tripId}` | trip members | members (create: `createdBy == you`) |
| `trips/{tripId}/members/{uid}` | trip members | self (join/leave), owner & app-admin (manage) |
| `trips/{tripId}/invites/{code}` | **public** (pre-auth join) | trip members |
| `trips/{tripId}/{itinerary,finance,stays,recs,cars,pins,flights,outfits,dayLabels,packing,packingSuggestions,activityLog}` | trip members | trip members |
| `users/{uid}` | **public** (see below) | self, app-admin |
| `userTrips/{uid}` | self | self, app-admin (member removal) |
| `inviteIndex/{code}` | **public** (pre-auth join) | any signed-in user |
| `geocache`, `userExpenses`, `outfitPhotos` | any signed-in user | any signed-in user |
| `_appLogs` | none | create-only (unchanged) |

Everything not matched is denied by default.

## Why the public-read exceptions exist

`AuthService.register()` runs three reads **before** the Firebase Auth account
exists (there is no `request.auth` yet):

1. `inviteIndex/{code}` — resolve the invite code to a `tripId`.
2. `trips/{tripId}/invites/{code}` — validate the invite.
3. `users` where `username == …` — enforce username uniqueness.

So those three must allow unauthenticated reads. The exposure is limited:
invite/index docs require you to already know the (secret) code, and `users`
holds only public profile fields (display name, avatar, colour, username,
`isAdmin`). Credentials live in Firebase Auth, never in Firestore.

## Client changes this required

Member-scoped writes surface an ordering constraint: an action that removes the
caller's **own** membership must do all its other writes first, or they'll be
denied the moment the member doc disappears.

- `TripService.leaveTrip` — decrement `memberCount` **before** deleting the
  caller's own member doc.
- `TripService.purgeTripData` (last member out) — delete every sub-collection
  except `members` first, then the trip doc, then `members` last.

(Admin `removeMember` needs no change: the actor there is the admin, who stays a
member; only the *removed* user's docs go away.)

## Known relaxation / follow-up

Membership is not cryptographically gated on holding a valid invite: a signed-in
user may create their own `members/{uid}` doc, so security relies on `tripId`
being an unguessable 20-char random id. True enforcement would move the join
into a server-side callable that validates the invite before writing membership.
Tracked as a follow-up; out of scope for TP-9.

## Validation

`test/firestore-rules.test.mjs` is a rules-unit-testing suite that runs against
the local Firestore emulator (no production impact) and asserts both ALLOW and
DENY outcomes for every collection/actor combination — the deny cases are what
guard against an over-permissive rule, which happy-path E2E can't catch.

```bash
npm run test:rules   # requires a JDK on PATH (Firestore emulator)
```

Current status: **48/48 passing.**

## Deploy

Rules are **not** deployed by merging (no CI deploy is configured). Deploy is a
manual, gated step:

```bash
firebase deploy --only firestore:rules
```

After deploying, a quick live smoke with the browser verification scripts
(`verify-tp*.mjs` — they cover register → join → CRUD → leave) confirms the real
app still works end-to-end; re-running `firebase deploy` re-applies the previous
rules file to roll back.
