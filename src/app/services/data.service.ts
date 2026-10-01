import { Injectable, signal, inject, Injector, runInInjectionContext, effect, computed } from '@angular/core';
import {
  Firestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, Unsubscribe,
} from '@angular/fire/firestore';
import {
  SheetData, ItineraryItem, Accommodation, Flight, RentalCar, MapPin, TripUser,
  ItineraryItemDoc, AccommodationDoc, FlightDoc, FinanceEntryDoc, RecDoc, TripMember,
} from '../models/trip.models';
import { sanitizeStrings } from '../utils/sanitize';
import { TripContextService } from './trip-context.service';
import { UserService } from './user.service';
import { TripEventsService } from './trip-events.service';
import { transportAdded, transportChanged, transportRemoved, pinAdded, pinRemoved } from '../utils/event-text';
import { TripService } from './trip.service';
import { tripZone } from '../utils/trip-destinations';

const EMPTY_SHEET: SheetData = {
  users: [], flights: [], itinerary: [], accommodations: [], finance: [],
  recs: [], rentalCar: [], outfits: [], mapPins: [], fetchedAt: 0,
};

/**
 * Aggregate view of the **active trip's** data, composed live from its
 * Firestore sub-collections (`trips/{activeTripId}/…`).
 *
 * Exposes `data()` — a {@link SheetData} aggregate consumed by the Map and
 * Rental Car pages — and owns the per-item writes for cars and map pins.
 * Re-subscribes automatically whenever {@link TripContextService} changes the
 * active trip; emits an empty aggregate when no trip is selected.
 *
 * (Itinerary/finance/stays/recs/flights are populated here for the aggregate;
 * their own feature services own the dedicated pages — repointed in TP-9.)
 */
@Injectable({ providedIn: 'root' })
export class DataService {
  private firestore   = inject(Firestore);
  private injector    = inject(Injector);
  private tripContext = inject(TripContextService);
  private userService = inject(UserService);
  private events      = inject(TripEventsService);
  private tripService = inject(TripService);

  /** The active trip id, but only while someone is signed in. Listeners opened
   *  while signed out are refused by the rules and never recover, so trip
   *  subscriptions follow the user as well as the trip. */
  private signedInTripId = computed(() =>
    this.userService.currentUser() ? this.tripContext.activeTripId() : null);

  private _data    = signal<SheetData | null>(null);
  private _loading = signal(true);

  readonly data    = this._data.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly isStale = signal(false); // kept for template compatibility

  // Live pieces, recomposed into _data whenever any sub-collection changes.
  private parts = blankParts();
  private carIds: string[] = [];        // doc ids parallel to parts.rentalCar (index-based API)
  private unsubs: Unsubscribe[] = [];
  private currentTripId: string | null = null;
  private pendingFirst = new Set<string>();   // sub-collections still awaiting their first snapshot

  constructor() {
    // React to the active trip: (re)subscribe to its sub-collections.
    effect(() => this.subscribeToTrip(this.signedInTripId()));
  }

  /** Retained for AppComponent compatibility — the constructor effect drives loading. */
  init(): void { /* no-op */ }

  /** No-op — Firestore listeners handle live updates automatically. */
  refresh(): void {}

  // ── Rental car (trips/{tid}/cars) ───────────────────────────────────────────

  /** Firestore id of the car at this index (the page anchors deep links on it). */
  carId(index: number): string | undefined { return this.carIds[index]; }

  addRentalCar(car: RentalCar): void {
    const tid = this.currentTripId;
    if (!tid) return;
    runInInjectionContext(this.injector, () => {
      const ref = doc(collection(this.firestore, 'trips', tid, 'cars'));
      setDoc(ref, sanitizeStrings(car)).catch(err => console.error('[DataService] addRentalCar failed:', err));
      this.events.emit({ kind: 'transport', action: 'added', itemId: ref.id, path: '/transportation', ...transportAdded(car, tripZone(this.tripService.activeTrip())) });
    });
  }

  patchRentalCar(index: number, updates: Partial<RentalCar>): void {
    const tid = this.currentTripId; const id = this.carIds[index];
    if (!tid || !id) return;
    const before = this.parts.rentalCar[index];
    runInInjectionContext(this.injector, () => {
      updateDoc(doc(this.firestore, 'trips', tid, 'cars', id), sanitizeStrings(updates))
        .catch(err => console.error('[DataService] patchRentalCar failed:', err));
    });
    if (!before) return;
    const t = transportChanged(before, { ...before, ...updates });
    if (t) this.events.emit({ kind: 'transport', action: 'changed', itemId: id, path: '/transportation', ...t });
  }

  deleteRentalCar(index: number): void {
    const tid = this.currentTripId; const id = this.carIds[index];
    if (!tid || !id) return;
    const before = this.parts.rentalCar[index];
    runInInjectionContext(this.injector, () => {
      deleteDoc(doc(this.firestore, 'trips', tid, 'cars', id))
        .catch(err => console.error('[DataService] deleteRentalCar failed:', err));
    });
    if (before) this.events.emit({ kind: 'transport', action: 'removed', itemId: id, path: '/transportation', ...transportRemoved(before) });
  }

  // ── Map pins (trips/{tid}/pins) ─────────────────────────────────────────────

  addMapPin(pin: MapPin): void {
    const tid = this.currentTripId;
    if (!tid) return;
    const clean = sanitizeStrings(pin);
    runInInjectionContext(this.injector, () => {
      setDoc(doc(this.firestore, 'trips', tid, 'pins', clean.id), clean)
        .catch(err => console.error('[DataService] addMapPin failed:', err));
    });
    this.events.emit({ kind: 'pin', action: 'added', itemId: clean.id, path: '/map', ...pinAdded(clean, this.parts.members) });
  }

  removeMapPin(id: string): void {
    const tid = this.currentTripId;
    if (!tid) return;
    const before = this.parts.mapPins.find(p => p.id === id);
    runInInjectionContext(this.injector, () => {
      deleteDoc(doc(this.firestore, 'trips', tid, 'pins', id))
        .catch(err => console.error('[DataService] removeMapPin failed:', err));
    });
    if (before) this.events.emit({ kind: 'pin', action: 'removed', itemId: id, path: '/map', ...pinRemoved(before, this.parts.members) });
  }

  // ── Live subscription ────────────────────────────────────────────────────────

  private subscribeToTrip(tripId: string | null): void {
    if (tripId === this.currentTripId) return;
    this.currentTripId = tripId;
    this.unsubs.forEach(u => u());
    this.unsubs = [];
    this.parts = blankParts();
    this.carIds = [];

    if (!tripId) {
      this._data.set(null);
      this._loading.set(false);
      return;
    }

    this._loading.set(true);
    const names = ['members', 'itinerary', 'finance', 'stays', 'recs', 'cars', 'pins', 'flights'];
    this.pendingFirst = new Set(names);
    const arrived = (name: string) => {
      this.pendingFirst.delete(name);
      if (this.pendingFirst.size === 0) this._loading.set(false);
    };
    runInInjectionContext(this.injector, () => {
      const col = (name: string) => collection(this.firestore, 'trips', tripId, name);
      this.unsubs.push(
        onSnapshot(col('members'), snap => {
          arrived('members');
          this.parts.members = snap.docs.map(d => d.data() as TripMember);
          this.recompose();
        }),
        onSnapshot(col('itinerary'), snap => {
          arrived('itinerary');
          this.parts.itinerary = snap.docs.map(d => toItineraryItem(d.data() as ItineraryItemDoc));
          this.recompose();
        }),
        onSnapshot(col('finance'), snap => {
          arrived('finance');
          this.parts.finance = snap.docs.map(d => d.data() as FinanceEntryDoc);
          this.recompose();
        }),
        onSnapshot(col('stays'), snap => {
          arrived('stays');
          this.parts.accommodations = snap.docs.map(d => d.data() as AccommodationDoc);
          this.recompose();
        }),
        onSnapshot(col('recs'), snap => {
          arrived('recs');
          this.parts.recs = snap.docs.map(d => d.data() as RecDoc);
          this.recompose();
        }),
        onSnapshot(col('cars'), snap => {
          arrived('cars');
          this.carIds = snap.docs.map(d => d.id);
          this.parts.rentalCar = snap.docs.map(d => d.data() as RentalCar);
          this.recompose();
        }),
        onSnapshot(col('pins'), snap => {
          arrived('pins');
          this.parts.mapPins = snap.docs.map(d => d.data() as MapPin);
          this.recompose();
        }),
        onSnapshot(col('flights'), snap => {
          arrived('flights');
          this.parts.flights = snap.docs.map(d => d.data() as FlightDoc);
          this.recompose();
        }),
      );
    });
  }

  /** Recompose the SheetData aggregate from the live pieces. */
  private recompose(): void {
    const nameOf = new Map(this.parts.members.map(m => [m.uid, m.displayName]));
    const users: TripUser[] = this.parts.members.map(m => ({
      uid: m.uid, name: m.displayName, color: m.color, avatarEmoji: m.avatarEmoji, avatarLetterColor: m.avatarLetterColor,
    }));
    const flights: Flight[] = this.parts.flights.map(f => toFlight(f, nameOf));

    this._data.set({
      ...EMPTY_SHEET,
      users,
      flights,
      itinerary: this.parts.itinerary,
      accommodations: this.parts.accommodations,
      finance: this.parts.finance,
      recs: this.parts.recs,
      rentalCar: this.parts.rentalCar,
      mapPins: this.parts.mapPins,
      fetchedAt: Date.now(),
    });
  }
}

interface Parts {
  members: TripMember[];
  itinerary: ItineraryItem[];
  finance: FinanceEntryDoc[];
  accommodations: Accommodation[];
  recs: RecDoc[];
  rentalCar: RentalCar[];
  mapPins: MapPin[];
  flights: FlightDoc[];
}

function blankParts(): Parts {
  return { members: [], itinerary: [], finance: [], accommodations: [], recs: [], rentalCar: [], mapPins: [], flights: [] };
}

/** ItineraryItemDoc → ItineraryItem (display). dayLabel isn't stored per-item. */
function toItineraryItem(d: ItineraryItemDoc): ItineraryItem {
  return {
    date: d.date, dayLabel: '', time: d.time, endTime: d.endTime,
    activity: d.activity, location: d.location, category: d.category,
    notes: d.notes, forWho: d.forWho,
  };
}

/** FlightDoc → Flight (display), resolving the owner's display name. */
function toFlight(f: FlightDoc, nameOf: Map<string, string>): Flight {
  return {
    person: nameOf.get(f.uid) ?? '',
    section: f.section, airline: f.airline, flightNumber: f.flightNumber,
    from: f.from, to: f.to, departureDate: f.departureDate, departureTime: f.departureTime,
    arrivalDate: f.arrivalDate, arrivalTime: f.arrivalTime, notes: f.notes, mode: '',
  };
}
