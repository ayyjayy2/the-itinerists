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

## Validation & deploy

Rules are **not** deployed by merging (no CI deploy is configured). Deploy is a
manual, gated step:

```bash
firebase deploy --only firestore:rules
```

Recommended validation before deploy — run the Firestore emulator locally
(requires a JDK) and exercise register → join → CRUD → leave, **or** deploy and
immediately run the browser verification scripts, rolling back if anything
breaks:

```bash
firebase deploy --only firestore:rules   # roll forward
# …run verify-tp*.mjs (register/join/CRUD/leave cover every rule path)…
# firebase deploy re-applies the previous rules file to roll back
```
