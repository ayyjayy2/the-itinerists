# Trip events, in-app updates and push — design

**Date:** 2026-09-30
**Status:** approved in conversation (Alayna, 2026-09-30)

## Goal

When someone in a travel group adds or changes something the group shares, the
others hear about it: in the app (bell + Updates page) now, and as a push on
their phone once the paid plan and the Apple program exist. Every notification
names the person, the thing and the change, and tapping it lands on that thing.

Personal pages never notify anyone: My Expenses, your own packing list, day
labels, marking a debt paid, Outfits (no sharing exists today; if "share with"
is added later, only the named person is told).

## One feed, two deliveries

```
phone writes the change ──┐
                          ├─► trips/{id}/events/{eventId}   ◄── bell, Updates page, badge
phone writes the event ───┘            │
                                       ▼  (PR 2, needs Blaze)
                        Cloud Function onEventCreated ─► FCM push to audience − actor
                                                          payload: path + focus id
```

The app writes the event because only the app knows exactly what changed (it
has the form's before and after). The function never composes text; it only
delivers. So the bell line and the push body are the same words.

## Data model

`trips/{tripId}/events/{eventId}`:

```ts
export type TripEventKind =
  | 'itinerary' | 'flight' | 'stay' | 'transport' | 'finance' | 'rec' | 'pin'
  | 'packing' | 'member' | 'trip';
export type TripEventAction =
  | 'added' | 'changed' | 'removed'                 // content
  | 'joined' | 'left' | 'kicked' | 'restored'       // members
  | 'suggested' | 'accepted' | 'declined';          // packing suggestions

export interface TripEvent {
  id: string;
  kind: TripEventKind;
  action: TripEventAction;
  actorUid: string;
  actorName: string;         // snapshot
  itemId: string;            // target doc id; '' for trip-level
  summary: string;           // everything after the name: "added Dinner at Café Einstein to Day 3, Fri Oct 3 at 7:00 PM"
  path: string;              // '/itinerary', '/flights', … (deep-link page)
  audience: 'all' | string[];// member uids; never includes the actor's own notifications
  timestamp: number;         // unix ms
}
```

Display line = `${actorName} ${summary}`. Push title = the trip's name; body = the
display line.

`members/{uid}.hiddenPages` is unrelated. `users/{uid}.lastSeenActivityAt`
(already exists) stays the high-water mark for the bell badge.

The old `activityLog` (member history) keeps being written: Trip Settings shows
it. Member actions now also write an event so the bell has them.

## Who is told (audience)

| Kind | Audience | Notes |
|---|---|---|
| itinerary | the item's `forWho` names → uids; `All` → everyone | |
| flight | everyone | arrivals/departures are group logistics even though a flight belongs to one person |
| stay | `forWho` | |
| transport | everyone | |
| finance | `paidBy` + `splitAmong` names → uids; `All` → everyone | only the people in the split |
| rec | everyone | |
| pin | `forWho` | |
| packing | `suggested` → the recipient only; `accepted`/`declined` → the sender only | |
| member | everyone | joined, left, kicked (owner removed), restored |
| trip | everyone | name, destination(s) or dates changed |

Names resolve to uids against the trip's current members (`displayName`
match). Unmatched names are dropped. The actor is never in their own audience
for badge/push purposes (the feed still shows your own actions, greyed).

## Wording

Built by pure functions in `src/app/utils/event-text.ts`, unit-tested. Always
the item's name and the new value; dates as `Fri Oct 3`, times as the app shows
them (`7:00 PM`), money in the trip currency.

| Case | Summary |
|---|---|
| itinerary added | `added Dinner at Café Einstein to Day 3, Fri Oct 3 at 7:00 PM` (no time → `… on Fri Oct 3`) |
| itinerary time changed | `changed Museum Island to 2:00 PM (was 11:00 AM)` |
| itinerary date changed | `moved Bike tour to Sat Oct 4` |
| itinerary renamed | `renamed Museum to Museum Island` |
| itinerary location changed | `changed the location of Dinner to Café Einstein` |
| itinerary several fields | `updated Dinner (time, location)` |
| itinerary removed | `removed Bike tour from Day 2, Thu Oct 2` |
| flight added | `added Maya's flight SAV → BER, Fri Oct 3 at 10:40 AM` (own flight: `added their flight …`) |
| flight changed | `changed Maya's flight SAV → BER (departure time)` |
| flight removed | `removed Maya's flight SAV → BER` |
| stay added | `added a stay: Hotel Adlon, Oct 3 – 5` |
| stay changed / removed | `changed Hotel Adlon (check-out)` / `removed the stay Hotel Adlon` |
| transport added | `added a rental car: Hertz, pick-up Sat Oct 4 at 10:00 AM` (mode word from the entry) |
| finance added | `added €84.00 for Dinner, split between 4 of you` (`paid by Maya` when actor ≠ payer) |
| finance changed | `changed Dinner to €90.00 (was €84.00)` / `changed who splits Dinner` |
| finance removed | `removed €84.00 for Dinner` |
| rec added | `added a rec: Café Einstein (Food)` |
| pin added | `pinned Tempelhof Field (Sightseeing)` |
| packing suggested | `suggested you pack: rain jacket` |
| packing accepted | `added your suggestion: rain jacket` / declined: `passed on your suggestion: rain jacket` |
| member | `joined the trip` / `left the trip` / `removed Tess` / `added Tess back` |
| trip changed | `changed the trip dates to Oct 3 – 11` / `renamed the trip to Berlin 2026` |

## Noise control

- Several edits by the same person to the same item within **5 minutes**
  update the existing event (new summary, new timestamp) instead of adding one.
  The app does this (it remembers the last event id per actor+item); the push
  function therefore sees one create and, later, updates, and only pushes on
  create.
- Your own actions never count toward your badge and never push to you.
- Profile → Notifications: one switch per kind (PR 2). The bell shows
  everything regardless; the switches only govern push.

## Deep links

Each event has `path` + `itemId`. Tapping a bell row or the Updates row
navigates to `${path}?focus=${itemId}`. A push carries the same in its data
payload and the native shell routes it the same way.

Pages honour `focus`:

- **Itinerary**: select the item's day, scroll the item into view, highlight 2 s.
- **Flights, Stays, Transportation, Recs**: scroll + highlight the card.
- **Finance**: open the expense log if closed, scroll + highlight the entry.
- **Map**: pan to the pin and open its popup.
- **Packing**: scroll to the suggestions section.
- Item gone: land on the page and show a one-line "That one was removed" notice.

Shared mechanics: an `appFocusTarget` directive (`[appFocusTarget]="item.id"`)
that, when the route's `focus` equals its id, scrolls itself into view and adds
a `.focus-flash` class for 2 s. A `FocusService` exposes the current focus id
and lets a page clear it.

## Push (PR 2 and PR 3)

- **Tokens**: `users/{uid}/private/devices/{token}` = `{ platform: 'web'|'ios'|'android', updatedAt }`, owner-only rules.
- **Function** `onTripEventCreated` (Firestore trigger on `trips/{t}/events/{e}`): resolve audience uids (all → members minus actor), load their device tokens and Profile switches, send FCM with `notification: { title: trip.name, body }` and `data: { path, focus, tripId }`, badge = unseen count for that user. Drop dead tokens on `registration-token-not-registered`.
- **Web**: Firebase Messaging service worker alongside the Angular one; asked for after the first trip is created or joined ("Turn on notifications so you hear when the group adds plans"), never on first open.
- **iOS**: `@capacitor-firebase/messaging` + APNs auth key (Apple Developer Program). The tap handler reads `data.path` and `data.focus` and navigates. Badge cleared on app open (bell marks seen).
- **Never** for the actor. Opening the app or the Updates page marks seen and clears the badge.

## Security rules

`events` joins the trip sub-collection allowlist (members read/write). PR 2 adds
`users/{uid}/private/devices/{token}` (owner only) and `notificationPrefs` on
the private account doc.

## Testing

- `utils/event-text.spec.ts`: every row of the wording table, plus the
  audience resolver (All, names, unmatched name, actor excluded).
- `services/trip-events.service.spec.ts`: 5-minute collapse updates instead of
  adding; unseen count ignores own events and events outside the audience.
- Rules tests: a member can write `events`, a non-member cannot read them.
- Bell and Updates specs: rows render `${actorName} ${summary}` and link to
  `path?focus=id`.
- Itinerary spec: `?focus=` selects the day.

## Pull requests

1. **Feed + in-app + deep links** (now, no Apple, no paid plan): model, rules,
   `event-text`, `TripEventsService`, wiring in every shared write, bell and
   Updates on the feed, `appFocusTarget`, page anchors.
2. **Push on web** (after the paid plan): Cloud Functions project, tokens,
   the trigger, the permission card, Profile switches, badge.
3. **Push on iOS** (after the Apple program): messaging plugin, APNs key,
   entitlement, tap routing, icon badge.
