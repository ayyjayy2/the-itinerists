// ── User ──────────────────────────────────────────────────────────────────────

export interface TripUser {
  name: string;
  color: string;       // hex color for avatar background
  avatarEmoji: string;
  isBirthday?: boolean;
  uid?: string;        // Firebase Auth UID (present when using real auth)
}

export interface FirestoreUser {
  uid: string;
  displayName: string;
  username: string;
  avatarEmoji: string;
  color: string;
  isAdmin: boolean;
  isDisabled?: boolean;
  createdAt: number;   // unix ms
}

/**
 * A trip invite. Stored per-trip at `/trips/{tripId}/invites/{code}` (TP-11);
 * the `tripId` is also denormalized here so a fetched invite is self-describing.
 */
export interface InviteCode {
  code: string;
  tripId: string;      // which trip this invite joins
  createdBy: string;   // uid
  createdAt: number;
  expiresAt: number;
  usedBy: string[];
}

/**
 * Global lookup so the join flow can resolve a code → trip without scanning
 * every trip. Stored at `/inviteIndex/{code}` (TP-11).
 */
export interface InviteIndexEntry {
  tripId: string;
  expiresAt: number;   // duplicated from the invite doc for fast validation
}

// ── Multi-Trip Architecture ─────────────────────────────────────────────────────
// Foundational data model for supporting many trips per user. Each trip carries
// its own dates/destination on the TripDoc; there is no global single-trip config.
// Spec: docs/superpowers/specs/2026-04-22-triplan-multi-trip-architecture-design.md

export type TripMemberRole = 'owner' | 'member';
export type TravelMode = 'flying' | 'driving' | 'train' | 'bus' | 'other';

/**
 * One leg of a trip — a destination with its own dates and currency.
 * Multi-destination trips carry an array of these (see TripDoc.destinations);
 * single-destination trips carry a one-element array.
 */
export interface TripDestination {
  destination: string;
  destinationPlaceId?: string;
  destinationCoords?: { lat: number; lng: number };
  startDate: string;            // YYYY-MM-DD
  endDate: string;              // YYYY-MM-DD
  currency: string;             // ISO currency code
}

/** Stored at Firestore `/trips/{tripId}` — one doc per trip. */
export interface TripDoc {
  id: string;                   // Firestore doc id (tripId)
  name: string;                 // "Bali Girls Trip 2026"
  // Per-leg destinations. Optional for back-compat with trips created before
  // multi-destination; read via tripDestinations() which falls back to the flat
  // fields below. The flat fields always mirror the primary (first) destination
  // and the overall date range, so existing single-destination code keeps working.
  destinations?: TripDestination[];
  destination: string;          // "Bali, Indonesia" (primary)
  destinationPlaceId?: string;  // Google Places ID, for maps/weather (optional — freeform destinations have none)
  destinationCoords?: {         // lat/lng for the weather API + map centering
    lat: number;
    lng: number;
  };
  startDate: string;            // YYYY-MM-DD (overall: earliest leg start)
  endDate: string;              // YYYY-MM-DD (overall: latest leg end)
  currency: string;             // ISO currency code, e.g. "USD" (primary)
  coverPhotoUrl?: string;       // Firebase Storage URL
  createdBy: string;            // uid of the trip creator
  createdAt: number;            // unix ms
  memberCount: number;          // denormalized count, for plan/limit checks
  archived?: boolean;           // set true by archiveTrip()
}

/** Stored at Firestore `/trips/{tripId}/members/{uid}` — one doc per member (doc id = uid). */
export interface TripMember {
  uid: string;                  // Firebase Auth UID (matches the doc id)
  role: TripMemberRole;
  displayName: string;          // snapshot at join time
  avatarEmoji: string;
  color: string;
  joinedAt: number;             // unix ms
  travelMode?: TravelMode | null;
  arrivalDate?: string;         // YYYY-MM-DD (derived from travel entries or set manually)
  arrivalTime?: string;         // e.g. "3:00 PM"
  departureDate?: string;       // YYYY-MM-DD
  departureTime?: string;       // e.g. "9:00 AM"
  hiddenPages?: string[];       // pages this member has toggled off, e.g. ["cars", "outfits"]
}

/** Stored at Firestore `/userTrips/{uid}` — fast index of the trips a user belongs to (doc id = uid). */
export interface UserTripsDoc {
  tripIds: string[];            // all trips this user is a member of
  lastActiveTrip?: string;      // tripId to restore on next app open
}

export type ActivityAction = 'member_added' | 'member_removed' | 'member_left' | 'member_restored';

/** Stored at Firestore `/trips/{tripId}/activityLog/{logId}` — member history (TP-18, spec §1.5). */
export interface ActivityLogEntry {
  id: string;
  action: ActivityAction;
  targetUid: string;            // the member who was affected
  targetName: string;           // snapshot for display
  performedByUid: string;       // who took the action
  performedByName: string;      // snapshot for display
  timestamp: number;            // unix ms
}

// ── Currency ──────────────────────────────────────────────────────────────────

export interface ExchangeRates {
  EUR: number;
  USD: number;
  GBP: number;
  ISK: number;
}

export interface CurrencyConfig {
  code: string;
  symbol: string;
  flag: string;
  label: string;
  optional: boolean;   // false = always shown, true = user-togglable
}

export const ALL_CURRENCIES: CurrencyConfig[] = [
  { code: 'EUR', symbol: '€',  flag: '🇪🇺', label: 'Euro',                        optional: false },
  { code: 'USD', symbol: '$',  flag: '🇺🇸', label: 'US Dollar',                   optional: false },
  { code: 'GBP', symbol: '£',  flag: '🏴󠁧󠁢󠁮󠁩󠁲󠁿', label: 'British Pound (N. Ireland)',   optional: true  },
  { code: 'ISK', symbol: 'kr', flag: '🇮🇸', label: 'Icelandic Króna',              optional: true  },
];

// Default rates relative to EUR (1 EUR = X of currency)
export const DEFAULT_RATES: ExchangeRates = {
  EUR: 1,
  USD: 1.16, // EUR/USD rate used for trip calculations (Mar 2026)
  GBP: 0.855,
  ISK: 149.5,
};

// ── Flights ───────────────────────────────────────────────────────────────────

/** Stored in Firestore `flights` collection — one doc per flight leg. */
export interface FlightDoc {
  id: string;
  uid: string;           // the user this flight belongs to
  addedByUid: string;    // who entered it
  section: 'ARRIVALS' | 'DEPARTURES';
  airline: string;
  flightNumber: string;
  from: string;          // IATA code
  to: string;            // IATA code
  departureDate: string; // YYYY-MM-DD
  departureTime: string; // e.g. "8:30 AM"
  arrivalDate: string;   // YYYY-MM-DD
  arrivalTime: string;   // e.g. "11:45 AM"
  notes: string;
  createdAt: number;
}

export interface Flight {
  person: string;
  section: string;        // 'ARRIVALS' | 'DEPARTURES'
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
  departureDate: string;  // YYYY-MM-DD
  departureTime: string;
  arrivalDate: string;    // YYYY-MM-DD (parsed from sheet, may include next-day info)
  arrivalTime: string;
  notes: string;
  mode: string;
}

// ── Itinerary ─────────────────────────────────────────────────────────────────

export interface ItineraryItem {
  date: string;        // YYYY-MM-DD
  dayLabel: string;    // e.g. "Day 1 – Dublin"
  time: string;        // "H:MM AM/PM [TZ]" or empty
  endTime?: string;    // optional end time, same format
  activity: string;
  location: string;
  category: string;    // e.g. "Food", "Sightseeing", "Transport"
  notes: string;
  forWho: string;      // comma-separated names or "All"
}

/** Stored in Firestore `itinerary` collection — one doc per event. */
export interface ItineraryItemDoc {
  id: string;
  date: string;          // YYYY-MM-DD
  time: string;          // "H:MM AM/PM" or ""
  endTime: string;       // "H:MM AM/PM" or ""
  activity: string;
  location: string;
  category: string;
  notes: string;
  forWho: string;        // comma-separated display names or "All"
  addedByUid: string;
  sortOrder: number;
  createdAt: number;
}

// ── Accommodations ────────────────────────────────────────────────────────────

export interface Accommodation {
  name: string;
  address: string;
  checkIn: string;     // YYYY-MM-DD
  checkOut: string;
  notes: string;
  bookingRef: string;
  forWho: string;      // comma-separated names or "All"
}

/** Stored in Firestore `stays` collection — one doc per accommodation. */
export interface AccommodationDoc {
  id: string;
  name: string;
  address: string;
  checkIn: string;     // YYYY-MM-DD
  checkOut: string;
  notes: string;
  bookingRef: string;
  link?: string;
  forWho: string;      // comma-separated display names or "All"
  addedByUid: string;
  createdAt: number;
}

// ── Finance (shared) ──────────────────────────────────────────────────────────

/** Stored in Firestore `financeEntries` collection — one doc per expense. */
export interface FinanceEntryDoc {
  id: string;
  date: string;
  vendor?: string;
  description: string;
  amount: number;
  currency: string;    // USD for Savannah trip
  paidBy: string;
  splitAmong: string;  // comma-separated display names or "All"
  splits?: Record<string, number>;
  category: string;
  notes?: string;
  link?: string;
  addedByUid: string;
  createdAt: number;
}

export interface FinanceEntry {
  date: string;
  description: string;
  amount: number;
  currency: string;    // EUR, USD, etc.
  paidBy: string;
  splitAmong: string;  // comma-separated names or "All"
  splits?: Record<string, number>;  // per-person amounts when split unequally
  category: string;
  vendor?: string;
  notes?: string;
  link?: string;
}

export interface Balance {
  from: string;
  to: string;
  amount: number;
  currency: string;
}

// ── Recs ──────────────────────────────────────────────────────────────────────

export interface Rec {
  category: string;
  title: string;
  description: string;
  extra: string;
}

/** Stored in Firestore `recs` collection — one doc per user-added rec. */
export interface RecDoc extends Rec {
  id: string;
  addedByUid: string;
  createdAt: number;
}

// ── Transportation ─────────────────────────────────────────────────────────────
// Stored in the `cars` sub-collection (kept for back-compat); each entry is a
// transportation booking whose `mode` selects rental car / train / bus / etc.

export type TransportMode = 'Rental Car' | 'Train' | 'Bus' | 'Ferry' | 'Rideshare' | 'Other';

export interface RentalCar {
  mode?: TransportMode;   // transportation type (defaults to Rental Car for legacy rows)
  company: string;
  confirmationNumber: string;
  pickupDate: string;
  pickupTime: string;
  pickupLocation: string;
  dropoffDate: string;
  dropoffTime: string;
  dropoffLocation: string;
  drivers: string;   // comma-separated
  notes: string;
  platform?: string;
  link?: string;
  rentalName?: string;    // whose name the rental is under
  passengers?: string;    // comma-separated names of people in this car
  location?: string;      // city/region where car will be used
}

// ── Full sheet data bundle ────────────────────────────────────────────────────

export interface SheetData {
  users: TripUser[];
  flights: Flight[];
  itinerary: ItineraryItem[];
  accommodations: Accommodation[];
  finance: FinanceEntry[];
  recs: Rec[];
  rentalCar: RentalCar[];
  outfits?: OutfitEntry[];
  mapPins?: MapPin[];
  weatherByDate?: Record<string, string>;  // e.g. '2026-03-17' → 'Dublin · 42–51°F ☁️'
  seedVersion?: number;     // bumped when seed data changes; triggers cache invalidation
  migrationVersion?: number; // bumped when migrate() adds/removes entries; prevents re-runs
  fetchedAt: number;        // unix timestamp
}

// ── Map custom pins ────────────────────────────────────────────────────────────

export interface MapPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  notes?: string;
  addedBy: string;
  forWho: string;   // 'All' or comma-separated names
}

// ── Local-only: Expenses ───────────────────────────────────────────────────────

export interface Expense {
  id: string;
  date: string;        // YYYY-MM-DD
  vendor?: string;
  description: string;
  amount: number;
  currency: string;
  category: string;   // food | transport | shopping | accommodation | activity | other
}

// ── Local-only: Packing ────────────────────────────────────────────────────────

export interface PackingItem {
  id: string;
  label: string;
  packed: boolean;
  addedAt: number;
  category?: string;
}

export interface PackingSuggestion {
  id: string;
  from: string;
  to: string;
  item: string;
  sentAt: number;
  status: 'pending' | 'accepted' | 'declined';
}

// ── Outfits ───────────────────────────────────────────────────────────────────
export interface OutfitEntry {
  date: string;
  user: string;
  items: string[];      // list of clothing items
  photoUrl?: string;    // Firebase Storage URL
  notes?: string;
}
