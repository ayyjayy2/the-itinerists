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

export interface InviteCode {
  code: string;
  createdBy: string;   // uid
  createdAt: number;
  expiresAt: number;
  usedBy: string | null;
}

export interface TripConfig {
  startDate: string;   // YYYY-MM-DD
  endDate: string;
  location: string;
  locationLabel: string;
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

// ── Finance (shared) ──────────────────────────────────────────────────────────

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
  category: string;   // "Irish Words", "Food", "Currency", etc.
  title: string;
  description: string;
  extra: string;
}

// ── Rental Car ────────────────────────────────────────────────────────────────

export interface RentalCar {
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
