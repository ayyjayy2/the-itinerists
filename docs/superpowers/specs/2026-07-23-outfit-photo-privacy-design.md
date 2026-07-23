# Outfit-photo privacy — design

**Date:** 2026-07-23
**Status:** Approved

## Problem

Uploaded outfit photos are stored in a global top-level Firestore collection
`outfitPhotos/{date}_{name}` (`{ dataUrl }`), governed by:

```
match /outfitPhotos/{key} { allow read, write: if isSignedIn(); }
```

Any signed-in user — including people who are **not members of the trip** — can
read or overwrite *anyone's* outfit photos. The key is a display name, not a
uid, and the collection is not scoped to a trip. This is a data-exposure bug.

Note: the modern outfit *entries* (planned-outfit text) already live at
`trips/{tripId}/outfits/*` and are correctly members-gated. Only the uploaded
photo images are mis-stored.

## Decision

Outfit photos are **private to the uploader**: each user can read/write only
their own photos, and only while they are a member of the trip. Other trip
members and outsiders cannot read them. Outfit *entries* remain shared among
trip members (unchanged).

No visible UI change: the outfits template only ever renders the current
user's own photo (`photoCache()[date + '_' + currentUser().name]`, alt "My
outfit"). The old code fetched other members' photos into the cache but never
displayed them, so removing that fetch has no visible regression.

## Approach (chosen: A)

Move photos into a per-trip, owner-gated subcollection.

**Storage:** `trips/{tripId}/outfitPhotos/{date}_{uid}` → `{ dataUrl, ownerUid, date }`.
The `dataUrl` cannot live on the shared `trips/{tripId}/outfits/{id}` entry doc,
because those are readable by all trip members; a separately-gated collection is
required for uploader-only access.

**Rules** (`firestore.rules`):
```
match /trips/{tripId}/outfitPhotos/{photoId} {
  allow read:   if isMember(tripId) && resource.data.ownerUid == uid();
  allow create: if isMember(tripId) && request.resource.data.ownerUid == uid();
  allow update: if isMember(tripId) && resource.data.ownerUid == uid()
                                    && request.resource.data.ownerUid == uid();
  allow delete: if isMember(tripId) && resource.data.ownerUid == uid();
}
```
Remove the global `match /outfitPhotos/{key}` block (falls through to deny).
`outfitPhotos` stays out of the members-can-read `{sub}/{doc}` allowlist, so this
dedicated block is the only grant.

**Service** (`OutfitPhotoService`): trip- and uid-aware.
- `upload(tripId, date, uid, file)` → writes `trips/{tripId}/outfitPhotos/{date}_{uid}` with `ownerUid: uid`.
- `getPhoto(tripId, date, uid)` → reads that doc.
- Callers always pass the current user's uid, so the service only ever touches the caller's own photos.

**Component** (`outfits.component.ts`):
- Photo-loading effect fetches only the current user's photos (filter `o.user === me.name`), passing `tripId` + `me.uid`.
- `uploadPhoto` passes `tripId` + `user.uid`.
- Cache key stays `${date}_${name}` (template compatibility).

## Alternative (rejected: B)

Keep a global `outfitPhotos` collection, re-key to `{uid}_{date}`, add an
owner-only rule. Less code, but not trip-scoped, not cleaned up on trip
deletion, and keeps photos in a global namespace. Weaker data model.

## Migration

None. The live project (`trip-planner-ayyjayy2`) has **0** documents in the
global `outfitPhotos` collection. (18 legacy photos exist only in the unrelated
old `ireland-stpatricks` project and are out of scope.)

## Testing

Extend `test/firestore-rules.test.mjs` (`npm run test:rules`, Firestore
emulator). Assert against actors alice (owner), bob (member), carol
(non-member), anon:
- owner can create / read / update / delete her own photo,
- a member **cannot** read another member's photo,
- a non-member and anon get nothing,
- create with a spoofed `ownerUid` (≠ auth uid) is denied.

Plus `ng build` to catch type errors in the service/component refactor.

## Out of scope

- Migrating/deleting the legacy `ireland-stpatricks` photos.
- Making outfit *entries* private (they stay shared among trip members).
