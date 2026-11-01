import {
  AccommodationDoc, Expense, FinanceEntryDoc, FirestoreUser, FlightDoc, ItineraryItemDoc, OutfitEntry, PackingItem, TripDoc, TripMember,
} from '../models/trip.models';

/**
 * "Download my data" (#332): one JSON file of what the app holds about the
 * person, for the rights the privacy policy promises (access and moving it).
 * Their own records in full; of each trip's shared things, only those they
 * added or are part of. Everyone else appears by first name, never their
 * profile, email or private lists. Usage records (`_activity`, `_writes`)
 * only the app owner can read; the file says how to ask for those.
 */
export interface ExportTrip {
  trip: TripDoc;
  me: TripMember | null;
  members: readonly TripMember[];
  itinerary: readonly ItineraryItemDoc[];
  flights: readonly FlightDoc[];
  stays: readonly AccommodationDoc[];
  finance: readonly FinanceEntryDoc[];
  packing: readonly PackingItem[];
  outfits: readonly OutfitEntry[];
  /** My outfit photos on this trip: the stored JPEG (data URL) when there is one. */
  photos: readonly { id: string; date: string; dataUrl?: string }[];
}

export interface ExportInput {
  now: number;
  uid: string;
  profile: FirestoreUser;
  myExpenses: readonly Expense[];
  trips: readonly ExportTrip[];
  /** Above this many characters of photo data, photos are counted instead of included. */
  photoBudget?: number;
}

const iso = (ms: number | undefined) => (ms ? new Date(ms).toISOString() : null);
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';
const names = (list: string) => list.split(',').map(s => s.trim()).filter(Boolean);
/** Drop who-wrote-it ids (another person's account id is theirs, not yours) and say whether it was you. */
function own<T extends { addedByUid?: string }>(item: T, uid: string): Omit<T, 'addedByUid'> & { addedByMe: boolean } {
  const { addedByUid, ...rest } = item;
  return { ...rest, addedByMe: addedByUid === uid };
}

export function buildDataExport(input: ExportInput): object {
  const { uid, profile } = input;
  const myName = profile.displayName;
  const budget = input.photoBudget ?? 15_000_000;
  let photoChars = input.trips.reduce((n, t) => n + t.photos.reduce((m, p) => m + (p.dataUrl?.length ?? 0), 0), 0);
  const includePhotos = photoChars <= budget;
  photoChars = 0;

  const trips = input.trips.map(t => {
    // Other people by first name only, in any name-bearing field.
    const otherName = (n: string) => (n === myName ? n : firstName(n));
    const involvesMe = (e: FinanceEntryDoc) =>
      e.addedByUid === uid || e.paidBy === myName || e.splitAmong === 'All'
      || names(e.splitAmong).includes(myName) || !!e.splits?.[myName];
    return {
      name: t.trip.name,
      dates: { start: t.trip.startDate, end: t.trip.endDate },
      destinations: (t.trip.destinations?.length ? t.trip.destinations.map(d => d.destination) : [t.trip.destination]).filter(Boolean),
      myRole: t.me?.role ?? null,
      joinedAt: iso(t.me?.joinedAt),
      myDetailsOnTheTrip: t.me ? {
        displayName: t.me.displayName, travelMode: t.me.travelMode ?? null,
        arrival: [t.me.arrivalDate, t.me.arrivalTime].filter(Boolean).join(' ') || null,
        departure: [t.me.departureDate, t.me.departureTime].filter(Boolean).join(' ') || null,
        hiddenPages: t.me.hiddenPages ?? [],
      } : null,
      otherMembers: t.members.filter(m => m.uid !== uid).map(m => firstName(m.displayName)),
      myFlights: t.flights.filter(f => f.uid === uid).map(f => { const { uid: _u, addedByUid: _a, ...rest } = f; return rest; }),
      myPackingList: t.packing,
      myOutfits: t.outfits.filter(o => o.user === myName),
      myOutfitPhotos: includePhotos ? t.photos : t.photos.map(p => ({ id: p.id, date: p.date, note: 'Left out: too large for one file. Email us for a copy.' })),
      itineraryIAdded: t.itinerary.filter(i => i.addedByUid === uid).map(i => own(i, uid)),
      staysIAdded: t.stays.filter(s => s.addedByUid === uid).map(s => own(s, uid)),
      sharedExpensesInvolvingMe: t.finance.filter(involvesMe).map(e => ({
        ...own(e, uid),
        paidBy: otherName(e.paidBy),
        splitAmong: e.splitAmong === 'All' ? 'All' : names(e.splitAmong).map(otherName).join(', '),
        splits: e.splits ? Object.fromEntries(Object.entries(e.splits).map(([n, v]) => [otherName(n), v])) : null,
      })),
    };
  });

  const { authEmail, pendingEmail, uid: _uid, isAdmin: _a, isDisabled: _d, layoutPicker: _l, ...profileRest } =
    profile as FirestoreUser & { layoutPicker?: boolean };
  return {
    about: 'Your data from The Itinerists. Usage records (which screens you opened, and when you changed something) are kept separately: email hello@theitinerists.com for a copy.',
    exportedAt: iso(input.now),
    profile: { ...profileRest, createdAt: iso(profile.createdAt) },
    account: { signInEmail: authEmail ?? null, unconfirmedEmail: pendingEmail ?? null },
    myExpenses: input.myExpenses,
    trips,
  };
}

/** "the-itinerists-data-2026-11-01.json" */
export function dataExportFileName(now: number): string {
  return `the-itinerists-data-${new Date(now).toISOString().slice(0, 10)}.json`;
}
