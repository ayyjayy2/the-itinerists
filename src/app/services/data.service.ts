import { Injectable, signal, inject, Injector, runInInjectionContext, effect } from '@angular/core';
import {
  Firestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, Unsubscribe,
} from '@angular/fire/firestore';
import {
  SheetData, ItineraryItem, Accommodation, Flight, RentalCar, MapPin, TripUser,
  ItineraryItemDoc, AccommodationDoc, FlightDoc, FinanceEntryDoc, RecDoc, TripMember,
} from '../models/trip.models';
import { sanitizeStrings } from '../utils/sanitize';
import { TripContextService } from './trip-context.service';

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

  constructor() {
    // React to the active trip: (re)subscribe to its sub-collections.
    effect(() => this.subscribeToTrip(this.tripContext.activeTripId()));
  }

  /** Retained for AppComponent compatibility — the constructor effect drives loading. */
  init(): void { /* no-op */ }

  /** No-op — Firestore listeners handle live updates automatically. */
  refresh(): void {}

  // ── Rental car (trips/{tid}/cars) ───────────────────────────────────────────

  addRentalCar(car: RentalCar): void {
    const tid = this.currentTripId;
    if (!tid) return;
    runInInjectionContext(this.injector, () => {
      const ref = doc(collection(this.firestore, 'trips', tid, 'cars'));
      setDoc(ref, sanitizeStrings(car)).catch(err => console.error('[DataService] addRentalCar failed:', err));
    });
  }

  patchRentalCar(index: number, updates: Partial<RentalCar>): void {
    const tid = this.currentTripId; const id = this.carIds[index];
    if (!tid || !id) return;
    runInInjectionContext(this.injector, () => {
      updateDoc(doc(this.firestore, 'trips', tid, 'cars', id), sanitizeStrings(updates))
        .catch(err => console.error('[DataService] patchRentalCar failed:', err));
    });
  }

  deleteRentalCar(index: number): void {
    const tid = this.currentTripId; const id = this.carIds[index];
    if (!tid || !id) return;
    runInInjectionContext(this.injector, () => {
      deleteDoc(doc(this.firestore, 'trips', tid, 'cars', id))
        .catch(err => console.error('[DataService] deleteRentalCar failed:', err));
    });
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
  }

  removeMapPin(id: string): void {
    const tid = this.currentTripId;
    if (!tid) return;
    runInInjectionContext(this.injector, () => {
      deleteDoc(doc(this.firestore, 'trips', tid, 'pins', id))
        .catch(err => console.error('[DataService] removeMapPin failed:', err));
    });
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
    runInInjectionContext(this.injector, () => {
      const col = (name: string) => collection(this.firestore, 'trips', tripId, name);
      this.unsubs.push(
        onSnapshot(col('members'), snap => {
          this.parts.members = snap.docs.map(d => d.data() as TripMember);
          this.recompose();
        }),
        onSnapshot(col('itinerary'), snap => {
          this.parts.itinerary = snap.docs.map(d => toItineraryItem(d.data() as ItineraryItemDoc));
          this.recompose();
        }),
        onSnapshot(col('finance'), snap => {
          this.parts.finance = snap.docs.map(d => d.data() as FinanceEntryDoc);
          this.recompose();
        }),
        onSnapshot(col('stays'), snap => {
          this.parts.accommodations = snap.docs.map(d => d.data() as AccommodationDoc);
          this.recompose();
        }),
        onSnapshot(col('recs'), snap => {
          this.parts.recs = snap.docs.map(d => d.data() as RecDoc);
          this.recompose();
        }),
        onSnapshot(col('cars'), snap => {
          this.carIds = snap.docs.map(d => d.id);
          this.parts.rentalCar = snap.docs.map(d => d.data() as RentalCar);
          this.recompose();
        }),
        onSnapshot(col('pins'), snap => {
          this.parts.mapPins = snap.docs.map(d => d.data() as MapPin);
          this.recompose();
        }),
        onSnapshot(col('flights'), snap => {
          this.parts.flights = snap.docs.map(d => d.data() as FlightDoc);
          this.recompose();
        }),
      );
      this._loading.set(false);
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
