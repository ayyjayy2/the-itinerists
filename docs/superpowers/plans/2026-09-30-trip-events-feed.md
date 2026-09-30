# Trip Events Feed (PR 1 of 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every shared change on a trip writes one descriptive event; the bell and Updates page read that feed and each row deep-links to the item.

**Architecture:** Pure text/audience builders in `utils/event-text.ts`; a `TripEventsService` (Firestore `trips/{id}/events`, 5-minute collapse, unseen count) that depends only on Firestore, `TripContextService` and `UserService` so `TripService` can inject it without a cycle; each data service emits after its own write; an `appFocusTarget` directive scrolls and highlights the linked item.

**Tech Stack:** Angular 19 signals, AngularFire Firestore, Jasmine/Karma, Firestore rules emulator tests.

**Spec:** `docs/superpowers/specs/2026-09-30-trip-events-and-push-design.md`

---

## File map

| File | Responsibility |
|---|---|
| `src/app/models/trip.models.ts` (modify) | `TripEvent`, `TripEventKind`, `TripEventAction`. |
| `firestore.rules` (modify) + `test/firestore-rules.test.mjs` (modify) | `events` in the trip sub-collection allowlist; allow/deny tests. |
| `src/app/utils/event-text.ts` (create) + spec | `resolveAudience`, `fmtDay`, and one builder per kind returning `{ summary, audience }`. |
| `src/app/services/trip-events.service.ts` (create) + spec | Subscribe to the active trip's events; `emit()`; collapse; `unseenCount`; `isFor(ev, uid)`. |
| `src/app/services/{itinerary,flights,stays,finance,recs,packing,data,trip,auth}.service.ts` (modify) | Emit after each shared write. |
| `src/app/shared/notification-bell/notification-bell.component.ts` (modify) + spec | Rows from the feed, `${actorName} ${summary}`, link to `path?focus=id`. |
| `src/app/pages/updates/updates.component.ts` (modify) + spec | Same, full list. |
| `src/app/shared/focus-target.directive.ts` (create) + `src/app/services/focus.service.ts` (create) | `?focus=` scroll + 2 s highlight; "that one was removed" notice. |
| Page templates: itinerary, flights, accommodations, finance, recs, rental-car, packing, map (modify) | `[appFocusTarget]="item.id"` on each item; itinerary selects the day; map pans to the pin. |
| `src/styles.scss` (modify) | `.focus-flash` keyframe. |

Actor = `userService.currentUser()` (`{ uid, name }`). Members for name→uid resolution = `tripService.activeMembers()` (`TripMember.displayName`).

---

### Task 1: Model + rules

**Files:** `src/app/models/trip.models.ts`, `firestore.rules`, `test/firestore-rules.test.mjs`

- [ ] Add after `ActivityLogEntry`:

```ts
// ── Trip events (the bell / Updates feed; push fan-out reads the same docs) ──
export type TripEventKind =
  | 'itinerary' | 'flight' | 'stay' | 'transport' | 'finance' | 'rec' | 'pin'
  | 'packing' | 'member' | 'trip';
export type TripEventAction =
  | 'added' | 'changed' | 'removed'
  | 'joined' | 'left' | 'kicked' | 'restored'
  | 'suggested' | 'accepted' | 'declined';

/** Stored at `/trips/{tripId}/events/{id}`. Display line = `${actorName} ${summary}`. */
export interface TripEvent {
  id: string;
  kind: TripEventKind;
  action: TripEventAction;
  actorUid: string;
  actorName: string;
  itemId: string;            // '' for trip-level
  summary: string;           // "added Dinner to Day 3, Fri Oct 3 at 7:00 PM"
  path: string;              // deep-link page, e.g. '/itinerary'
  audience: 'all' | string[];// member uids
  timestamp: number;
}
```

- [ ] `firestore.rules`: add `'events'` to the `sub in [...]` list (after `'activityLog'`).
- [ ] `test/firestore-rules.test.mjs`, in the "Data sub-collections" block, add:

```js
await t('member writes events',      'allow', () => setDoc(doc(bob,   'trips', 'T', 'events', 'e1'), { kind: 'itinerary', action: 'added', actorUid: 'bob', summary: 'x', path: '/itinerary', audience: 'all', timestamp: 1 }));
await t('member reads events',       'allow', () => getDoc(doc(bob,   'trips', 'T', 'events', 'e1')));
await t('non-member reads events',   'deny',  () => getDoc(doc(carol, 'trips', 'T', 'events', 'e1')));
await t('non-member writes events',  'deny',  () => setDoc(doc(carol, 'trips', 'T', 'events', 'e2'), { kind: 'rec', action: 'added' }));
```

- [ ] Run `npm run test:rules` (needs a JDK; if unavailable, note it in the PR). Commit: `feat(events): TripEvent model and rules`.

---

### Task 2: `utils/event-text.ts` (TDD)

**Exports and contracts** (all pure):

```ts
export interface Person  { uid: string; name: string; }
export interface Audience { audience: 'all' | string[]; }
export interface EventText extends Audience { summary: string; }

/** 'All' → 'all'; "Maya, Sam" → uids of matching members (case-insensitive, trimmed); none matched → []. */
export function resolveAudience(forWho: string | undefined, members: readonly { uid: string; displayName: string }[]): 'all' | string[];
export function fmtDay(iso: string): string;            // 'Fri Oct 3'
export function fmtRange(a: string, b: string): string; // 'Oct 3 – 5' (same month) / 'Sep 30 – Oct 5'
export function money(amount: number, currency: string): string; // Intl, falls back to "84.00 EUR"

export function itineraryAdded(item: ItineraryItemDoc, dayNumber: number | null, members): EventText;
export function itineraryChanged(before: ItineraryItemDoc, after: ItineraryItemDoc, members): EventText | null; // null when nothing notable changed
export function itineraryRemoved(item: ItineraryItemDoc, dayNumber: number | null, members): EventText;
export function flightAdded(f: FlightDoc, ownerName: string, actorUid: string): EventText;      // audience 'all'
export function flightChanged(before: FlightDoc, after: FlightDoc, ownerName: string, actorUid: string): EventText | null;
export function flightRemoved(f: FlightDoc, ownerName: string, actorUid: string): EventText;
export function stayAdded(s: AccommodationDoc, members): EventText;
export function stayChanged(before, after, members): EventText | null;
export function stayRemoved(s, members): EventText;
export function transportAdded(c: RentalCar): EventText;      // 'all'
export function transportChanged(before, after): EventText | null;
export function transportRemoved(c): EventText;
export function financeAdded(e: FinanceEntryDoc, actorName: string, currency: string, members): EventText; // audience = paidBy + splitAmong
export function financeChanged(before, after, currency, members): EventText | null;
export function financeRemoved(e, currency, members): EventText;
export function recAdded(r: RecDoc): EventText;               // 'all'
export function recChanged(before, after): EventText | null;
export function recRemoved(r): EventText;
export function pinAdded(p: MapPin, members): EventText;
export function pinRemoved(p: MapPin, members): EventText;
export function packingSuggested(item: string, toUid: string): EventText;                 // audience [toUid]
export function packingAnswered(item: string, fromUid: string, accepted: boolean): EventText; // audience [fromUid]
export function memberEvent(action: 'joined'|'left'|'kicked'|'restored', targetName: string, selfAct: boolean): EventText; // 'all'
export function tripChanged(before: TripDoc, after: Partial<TripDoc>): EventText | null; // 'all'
```

Wording per the spec table. "Which fields changed" uses labels: itinerary `time | date | name | location | notes`; flight `departure time | arrival time | date | route | airline`; stay `check-in | check-out | name | address`; transport `pick-up | drop-off | company`; finance amount → `changed Dinner to €90.00 (was €84.00)`, split → `changed who splits Dinner`, else `updated Dinner (vendor, date)`.

- [ ] Write `src/app/utils/event-text.spec.ts` covering every row of the spec's wording table plus `resolveAudience` (All, two names, unmatched, case/space tolerance). Run, see it fail to compile.
- [ ] Implement. Run: `npm run test:ci -- --include='src/app/utils/event-text.spec.ts'` → all green.
- [ ] Commit: `feat(events): wording and audience builders`.

---

### Task 3: `TripEventsService` (TDD)

```ts
@Injectable({ providedIn: 'root' })
export class TripEventsService {
  readonly events: Signal<TripEvent[]>;          // active trip, newest first
  readonly loaded: Signal<boolean>;
  /** Fire-and-forget. Collapses into the last event for the same actor+kind+itemId within 5 min. */
  emit(input: { kind; action; itemId; path; summary; audience }, tripId?: string): void;
  /** Events aimed at this uid (audience 'all' or includes uid), excluding their own. */
  forMe(uid: string): TripEvent[];
  unseen(uid: string, lastSeenAt: number): TripEvent[];
}
export function isFor(ev: TripEvent, uid: string): boolean;   // exported pure helper
```

Details: subscribe like `StaysService` (effect on `signedInTripId`); `emit` uses `doc(collection(...,'events'))`, actor from `userService.currentUser()`; a `Map<string, { id, at }>` keyed `${actorUid}|${kind}|${itemId}` implements the collapse: if `Date.now() - at < 300_000` → `updateDoc(existing, { summary, action, timestamp })`, else new `setDoc`. Trip-level (`itemId: ''`) never collapses. Optional `tripId` arg for callers that act on a trip that is not active (join, leave).

- [ ] Spec with a stubbed Firestore: `emit` twice within 5 min for the same item → one `setDoc` + one `updateDoc`; different item → two `setDoc`; `isFor` and `unseen` cases (own event excluded; audience list without me excluded; `'all'` included; timestamp ≤ lastSeen excluded).
- [ ] Implement; green; commit `feat(events): TripEventsService with collapse and unseen count`.

---

### Task 4: Emit from every shared write

Each service gets `private events = inject(TripEventsService)` and (where names must resolve) `private trips = inject(TripService)`. Use the service's own signal for `before`. Emission is after the awaited write; never blocks or throws.

- [ ] **Itinerary**: `addItem` → `itineraryAdded` (day number from `tripService.activeTrip()` start date: `daysBetween(start, item.date) + 1`, null without dates); `updateItem` → find `before` in `items()`, `after = { ...before, ...updates }`, `itineraryChanged`; `deleteItem` → `itineraryRemoved`. `reorderDay` emits nothing.
- [ ] **Flights**: owner name = member with `uid === f.uid` (fallback "a"); `flightAdded/Changed/Removed`.
- [ ] **Stays**, **Recs**: same pattern.
- [ ] **Finance**: currency = `activeTrip()?.currency ?? 'USD'`; `togglePaidItem` emits nothing.
- [ ] **Packing**: `sendSuggestion` → `packingSuggested(item, toUid)` where `toUid` = member whose `displayName === toUser`; `updateSuggestionStatus` → `packingAnswered(item, fromUid, status === 'accepted')`.
- [ ] **DataService**: `addRentalCar` → `transportAdded`; `patchRentalCar` → `transportChanged(before=parts.rentalCar[index], after)`; `deleteRentalCar` → `transportRemoved`; `addMapPin` → `pinAdded`; `removeMapPin` → `pinRemoved` (find in `parts.mapPins`). Also **expose car doc ids**: add `carId(index): string | undefined` so the page can anchor.
- [ ] **TripService**: in `logActivity` also `events.emit({ kind: 'member', ... }, tripId)` mapping `member_added→joined`, `member_left→left`, `member_removed→kicked`, `member_restored→restored`; `updateTrip` → `tripChanged(activeTrip(), patch)`.
- [ ] **AuthService** join path: after the activityLog write, `events.emit({ kind:'member', action:'joined', itemId:'', path:'/trip-settings', summary:'joined the trip', audience:'all' }, tripId)`. (AuthService may not inject TripEventsService if that creates a cycle — TripEventsService must not import AuthService. It doesn't.)
- [ ] Type-check `npx tsc -p tsconfig.app.json --noEmit`, full test run, commit `feat(events): every shared write emits a feed event`.

---

### Task 5: Bell + Updates on the feed

- [ ] `notification-bell.component.ts`: inject `TripEventsService`; `unseen = computed(() => events.unseen(me.uid, lastSeen).length)`; rows = `forMe(uid)` newest first, max 8; each row is `<a [routerLink]="e.path" [queryParams]="{ focus: e.itemId }">` with `<b>{{ e.actorName }}</b> {{ e.summary }} · {{ ago }}`; own events shown greyed (`.mine`). Keep the open-snapshot behaviour.
- [ ] `updates.component.ts`: same rows, all events, avatar from members by `actorUid`.
- [ ] Update both specs: stub `TripEventsService` with `events: signal([...])`, `forMe`, `unseen`; assert text `Pat added Dinner to Day 1, Fri Oct 3 at 7:00 PM` and the row's `href` contains `/itinerary?focus=i1`.
- [ ] Commit `feat(events): bell and Updates read the feed and link to the item`.

---

### Task 6: Deep links

- [ ] `src/app/services/focus.service.ts`: `readonly id = signal<string | null>(null)`; `constructor` subscribes to `router.events` (NavigationEnd) and sets `id` from `route.snapshot.queryParamMap.get('focus')` (read via `ActivatedRoute` of the root: use `router.parseUrl(router.url).queryParams['focus']`); `clear()`; `missing = signal(false)` for the "That one was removed" notice.
- [ ] `src/app/shared/focus-target.directive.ts`:

```ts
@Directive({ selector: '[appFocusTarget]' })
export class FocusTargetDirective implements AfterViewInit {
  readonly appFocusTarget = input.required<string>();
  private el = inject(ElementRef<HTMLElement>); private focus = inject(FocusService);
  constructor() { effect(() => { if (this.focus.id() && this.focus.id() === this.appFocusTarget()) this.flash(); }); }
  ngAfterViewInit() { if (this.focus.id() === this.appFocusTarget()) this.flash(); }
  private flash() {
    const e = this.el.nativeElement; e.scrollIntoView({ block: 'center', behavior: 'smooth' });
    e.classList.add('focus-flash'); setTimeout(() => e.classList.remove('focus-flash'), 2000); this.focus.clear();
  }
}
```

- [ ] `src/styles.scss`: `.focus-flash { animation: focus-flash 2s ease-out; } @keyframes focus-flash { 0%,60% { box-shadow: 0 0 0 3px var(--primary); } 100% { box-shadow: none; } }` with `prefers-reduced-motion` → no animation, just the ring for 2 s.
- [ ] Anchors: itinerary item row (`[appFocusTarget]="item.id"`), flights card (per flight id), stays card, finance expense-log row, recs card, rental-car card (`carId(i)`), packing suggestions section (`appFocusTarget="suggestions"`).
- [ ] Itinerary: in `ngOnInit`, `effect`: when `focus.id()` is set and items are loaded, find the item; if found `selectedDate.set(item.date)`; if not found after `loaded()` → `focus.missing.set(true)`. Add a one-line notice under the header when `focus.missing()`; cleared on next navigation.
- [ ] Map: when `focus.id()` matches a pin, pan to it and open its popup after markers render.
- [ ] Finance: if `focus.id()` matches an entry, `showExpenses.set(true)`.
- [ ] Itinerary spec: `?focus=i1` (item on `2026-10-03`) → `selectedDate() === '2026-10-03'`.
- [ ] Commit `feat(events): tapping an update lands on the item`.

---

### Task 7: Docs + PR

- [ ] `docs/feature-log.md` entry; TODO.md Parked line for push points at the spec's PR 2/3.
- [ ] `npm run test:ci` green; `npm run build` green.
- [ ] Push `feat/trip-events`, open PR "feat(events): who changed what, in the bell, with a link to it".

---

## Self-review

Spec coverage: model/rules (T1), wording + audience (T2), collapse + unseen (T3), every writer incl. members and trip fields (T4), bell/Updates (T5), deep links incl. removed-item notice and itinerary day (T6). Push is PR 2/3 by design. Names consistent: `TripEventsService.emit/forMe/unseen`, `FocusService.id/clear/missing`, `appFocusTarget`.
