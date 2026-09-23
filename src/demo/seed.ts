/**
 * The mock trip the demo boots with: a fictional week in Chiang Mai for
 * Alayna and three invented friends. Every document mirrors the shapes the
 * production services read (`src/app/models/trip.models.ts`).
 */
import { MemoryStore, DocData } from './memory-store';
import { DEMO_UID, DEMO_TRIP_ID } from './seed-constants';
import type {
  FirestoreUser, TripDoc, TripMember, UserTripsDoc, ActivityLogEntry,
  ItineraryItemDoc, FlightDoc, AccommodationDoc, FinanceEntryDoc, RecDoc,
  RentalCar, MapPin, PackingItem, PackingSuggestion, Expense,
} from '../app/models/trip.models';

const T0 = Date.UTC(2026, 8, 1, 12, 0, 0); // a fixed "created at" baseline (1 Sep 2026)
const at = (minutesAfterT0: number) => T0 + minutesAfterT0 * 60_000;

interface Person { uid: string; name: string; username: string; emoji: string; color: string }

const ALAYNA: Person = { uid: DEMO_UID,   name: 'Alayna', username: 'alayna', emoji: '🌿', color: '#88C9A1' };
const MAYA:   Person = { uid: 'demo-maya', name: 'Maya',   username: 'maya',   emoji: '🌸', color: '#F5B5D4' };
const THEO:   Person = { uid: 'demo-theo', name: 'Theo',   username: 'theo',   emoji: '🎒', color: '#B5D5F5' };
const JO:     Person = { uid: 'demo-jo',   name: 'Jo',     username: 'jo',     emoji: '🍜', color: '#F9E4B7' };
const PEOPLE = [ALAYNA, MAYA, THEO, JO];

const TRIP_START = '2026-11-12';
const TRIP_END   = '2026-11-19';
const CHIANG_MAI = { lat: 18.7883, lng: 98.9853 };

export function seedDemo(store: MemoryStore): void {
  const trip = (...segments: string[]) => ['trips', DEMO_TRIP_ID, ...segments].join('/');

  // ── People ────────────────────────────────────────────────────────────────
  PEOPLE.forEach((p, i) => {
    const user: FirestoreUser = {
      uid: p.uid, displayName: p.name, username: p.username,
      avatarEmoji: p.emoji, color: p.color, isAdmin: false, isDisabled: false,
      createdAt: at(i), authEmail: `${p.username}@the-itinerists.local`,
    };
    store.set(`users/${p.uid}`, user as unknown as DocData);
    const index: UserTripsDoc = { tripIds: [DEMO_TRIP_ID], lastActiveTrip: DEMO_TRIP_ID };
    store.set(`userTrips/${p.uid}`, index as unknown as DocData);
  });

  // ── Trip ──────────────────────────────────────────────────────────────────
  const tripDoc: TripDoc = {
    id: DEMO_TRIP_ID,
    name: 'Chiang Mai, November',
    destinations: [{
      destination: 'Chiang Mai, Thailand', startDate: TRIP_START, endDate: TRIP_END,
      currency: 'THB', destinationCoords: CHIANG_MAI,
    }],
    destination: 'Chiang Mai, Thailand',
    destinationCoords: CHIANG_MAI,
    startDate: TRIP_START, endDate: TRIP_END, currency: 'THB',
    createdBy: ALAYNA.uid, createdAt: at(10), memberCount: PEOPLE.length,
  };
  store.set(trip(), tripDoc as unknown as DocData);

  PEOPLE.forEach((p, i) => {
    const member: TripMember = {
      uid: p.uid, role: i === 0 ? 'owner' : 'member',
      displayName: p.name, avatarEmoji: p.emoji, color: p.color, joinedAt: at(10 + i),
      travelMode: 'flying',
    };
    store.set(trip('members', p.uid), member as unknown as DocData);
  });

  [MAYA, THEO, JO].forEach((p, i) => {
    const entry: ActivityLogEntry = {
      id: `log-${p.uid}`, action: 'member_added',
      targetUid: p.uid, targetName: p.name,
      performedByUid: ALAYNA.uid, performedByName: ALAYNA.name,
      timestamp: at(11 + i),
    };
    store.set(trip('activityLog', entry.id), entry as unknown as DocData);
  });

  // ── Itinerary ─────────────────────────────────────────────────────────────
  type Row = [date: string, time: string, endTime: string, activity: string, location: string, category: string, forWho: string, notes: string];
  const rows: Row[] = [
    ['2026-11-12', '3:50 PM',  '',         'Depart Chicago O’Hare',          'ORD',                                  'Transport',   'Alayna, Maya', 'EVA Air via Taipei'],
    ['2026-11-12', '11:10 PM', '',         'Depart San Francisco',              'SFO',                                  'Transport',   'Theo, Jo',     'Singapore Airlines via Singapore'],
    ['2026-11-13', '11:35 PM', '',         'Land in Chiang Mai',                'Chiang Mai International Airport (CNX)', 'Transport', 'All',          'Grab to the guesthouse, ~20 min'],
    ['2026-11-14', '9:00 AM',  '12:00 PM', 'Old City temples walk',             'Wat Chedi Luang & Wat Phra Singh',     'Sightseeing', 'All',          'Shoulders and knees covered'],
    ['2026-11-14', '12:30 PM', '',         'Khao soi lunch',                    'Khao Soi Khun Yai',                    'Food',        'All',          'Cash only, sells out early'],
    ['2026-11-14', '3:00 PM',  '',         'Nimman coffee crawl',               'Nimmanhaemin Road',                    'Food',        'Alayna, Maya', ''],
    ['2026-11-14', '7:00 PM',  '',         'Night Bazaar',                      'Chang Klan Road',                      'Sightseeing', 'All',          'Sticky rice and mango for dessert'],
    ['2026-11-15', '5:30 AM',  '7:30 AM',  'Doi Suthep at sunrise',             'Wat Phra That Doi Suthep',             'Sightseeing', 'All',          '306 steps, or the funicular'],
    ['2026-11-15', '3:00 PM',  '7:00 PM',  'Thai cooking class',                'Thai Farm Cooking School',             'Activity',    'Alayna, Jo, Maya', 'Pickup from the guesthouse'],
    ['2026-11-15', '6:00 PM',  '',         'Sunday Walking Street',             'Ratchadamnoen Road',                   'Sightseeing', 'Theo',         ''],
    ['2026-11-16', '8:00 AM',  '4:00 PM',  'Elephant sanctuary day',            'Elephant Nature Park, Mae Taeng',      'Activity',    'All',          'Songthaew booked for the day'],
    ['2026-11-17', '9:00 AM',  '1:00 PM',  'Bua Tong Sticky Waterfalls',        'Sri Lanna National Park',              'Activity',    'All',          'Bring water shoes'],
    ['2026-11-17', '4:00 PM',  '',         'Warorot Market',                    'Warorot Market (Kad Luang)',           'Sightseeing', 'All',          'Dried mango, northern sausage'],
    ['2026-11-18', '1:00 PM',  '5:00 PM',  'Grand Canyon water park',           'Hang Dong',                            'Activity',    'Maya, Theo, Jo', ''],
    ['2026-11-18', '7:00 PM',  '',         'Farewell dinner',                   'Dash! Restaurant & Bar',               'Food',        'All',          'Book a table for four'],
    ['2026-11-19', '10:20 AM', '',         'Fly home',                          'CNX',                                  'Transport',   'All',          'Connect in Bangkok'],
  ];
  const perDay = new Map<string, number>();
  rows.forEach(([date, time, endTime, activity, location, category, forWho, notes], i) => {
    const sortOrder = perDay.get(date) ?? 0;
    perDay.set(date, sortOrder + 1);
    const item: ItineraryItemDoc = {
      id: `it-${i + 1}`, date, time, endTime, activity, location, category, notes, forWho,
      addedByUid: ALAYNA.uid, sortOrder, createdAt: at(20 + i),
    };
    store.set(trip('itinerary', item.id), item as unknown as DocData);
  });

  store.set(trip('dayLabels', ALAYNA.uid), {
    dayLabels: { '2026-11-14': 'Old City', '2026-11-15': 'Doi Suthep', '2026-11-16': 'Elephants' },
  });

  // ── Flights ───────────────────────────────────────────────────────────────
  const flights: Array<Omit<FlightDoc, 'id' | 'addedByUid' | 'createdAt'>> = [
    { uid: ALAYNA.uid, section: 'ARRIVALS',   airline: 'EVA Air',            flightNumber: 'BR 55',  from: 'ORD', to: 'CNX', departureDate: '2026-11-12', departureTime: '3:50 PM',  arrivalDate: '2026-11-13', arrivalTime: '11:35 PM', notes: 'Via Taipei' },
    { uid: MAYA.uid,   section: 'ARRIVALS',   airline: 'EVA Air',            flightNumber: 'BR 55',  from: 'ORD', to: 'CNX', departureDate: '2026-11-12', departureTime: '3:50 PM',  arrivalDate: '2026-11-13', arrivalTime: '11:35 PM', notes: 'Via Taipei, seat next to Alayna' },
    { uid: THEO.uid,   section: 'ARRIVALS',   airline: 'Singapore Airlines', flightNumber: 'SQ 33',  from: 'SFO', to: 'CNX', departureDate: '2026-11-12', departureTime: '11:10 PM', arrivalDate: '2026-11-13', arrivalTime: '10:50 PM', notes: 'Via Singapore' },
    { uid: JO.uid,     section: 'ARRIVALS',   airline: 'Singapore Airlines', flightNumber: 'SQ 33',  from: 'SFO', to: 'CNX', departureDate: '2026-11-12', departureTime: '11:10 PM', arrivalDate: '2026-11-13', arrivalTime: '10:50 PM', notes: 'Via Singapore' },
    { uid: ALAYNA.uid, section: 'DEPARTURES', airline: 'Thai Airways',       flightNumber: 'TG 103', from: 'CNX', to: 'BKK', departureDate: '2026-11-19', departureTime: '10:20 AM', arrivalDate: '2026-11-19', arrivalTime: '11:40 AM', notes: 'Connect to ORD' },
    { uid: MAYA.uid,   section: 'DEPARTURES', airline: 'Thai Airways',       flightNumber: 'TG 103', from: 'CNX', to: 'BKK', departureDate: '2026-11-19', departureTime: '10:20 AM', arrivalDate: '2026-11-19', arrivalTime: '11:40 AM', notes: 'Connect to ORD' },
    { uid: THEO.uid,   section: 'DEPARTURES', airline: 'Thai Airways',       flightNumber: 'TG 103', from: 'CNX', to: 'BKK', departureDate: '2026-11-19', departureTime: '10:20 AM', arrivalDate: '2026-11-19', arrivalTime: '11:40 AM', notes: 'Connect to SFO' },
    { uid: JO.uid,     section: 'DEPARTURES', airline: 'Thai Airways',       flightNumber: 'TG 103', from: 'CNX', to: 'BKK', departureDate: '2026-11-19', departureTime: '10:20 AM', arrivalDate: '2026-11-19', arrivalTime: '11:40 AM', notes: 'Connect to SFO' },
  ];
  flights.forEach((f, i) => {
    const flight: FlightDoc = { ...f, id: `fl-${i + 1}`, addedByUid: f.uid, createdAt: at(40 + i) };
    store.set(trip('flights', flight.id), flight as unknown as DocData);
  });

  // ── Stay ──────────────────────────────────────────────────────────────────
  const stay: AccommodationDoc = {
    id: 'stay-1', name: 'Baan Nimman Guesthouse',
    address: 'Nimmanhaemin Soi 7, Suthep, Chiang Mai 50200',
    checkIn: '2026-11-13', checkOut: '2026-11-19', checkInTime: '2:00 PM', checkOutTime: '11:00 AM',
    notes: 'Two twin rooms. Rooftop breakfast 7–10 AM.', bookingRef: 'BNM-48213',
    forWho: 'All', addedByUid: ALAYNA.uid, createdAt: at(50),
  };
  store.set(trip('stays', stay.id), stay as unknown as DocData);

  // ── Shared finance ────────────────────────────────────────────────────────
  const finance: Array<Omit<FinanceEntryDoc, 'id' | 'addedByUid' | 'createdAt'>> = [
    { date: '2026-11-13', vendor: 'Baan Nimman',         description: 'Guesthouse deposit',        amount: 6000,  currency: 'THB', paidBy: 'Alayna', splitAmong: 'All',              category: 'Accommodation' },
    { date: '2026-11-14', vendor: 'Khao Soi Khun Yai',   description: 'Khao soi lunch',            amount: 640,   currency: 'THB', paidBy: 'Maya',   splitAmong: 'All',              category: 'Food' },
    { date: '2026-11-15', vendor: 'Thai Farm Cooking',   description: 'Cooking class',             amount: 4800,  currency: 'THB', paidBy: 'Jo',     splitAmong: 'Alayna, Jo, Maya', category: 'Activity' },
    { date: '2026-11-16', vendor: 'Elephant Nature Park', description: 'Sanctuary tickets',        amount: 10000, currency: 'THB', paidBy: 'Alayna', splitAmong: 'All',              category: 'Activity' },
    { date: '2026-11-16', vendor: 'Mr. Kwan',            description: 'Songthaew day hire',        amount: 1200,  currency: 'THB', paidBy: 'Theo',   splitAmong: 'All',              category: 'Transport' },
    { date: '2026-11-18', vendor: 'Dash!',               description: 'Farewell dinner',           amount: 2350,  currency: 'THB', paidBy: 'Theo',   splitAmong: 'All',              category: 'Food', notes: 'Split evenly, tip included' },
  ];
  finance.forEach((f, i) => {
    const entry: FinanceEntryDoc = { ...f, id: `fin-${i + 1}`, addedByUid: ALAYNA.uid, createdAt: at(60 + i) };
    store.set(trip('finance', entry.id), entry as unknown as DocData);
  });

  // ── Recs ──────────────────────────────────────────────────────────────────
  const recs: Array<Omit<RecDoc, 'id' | 'addedByUid' | 'createdAt'>> = [
    { category: 'Food',     title: 'Khao Soi Khun Yai',          description: 'Cash only and closes when the pot runs out. Go before 1 PM.', extra: 'Near Wat Chiang Man' },
    { category: 'Coffee',   title: 'Ristr8to Lab',               description: 'Latte-art champions. Try the signature flat white.',            extra: 'Nimman Soi 3' },
    { category: 'Market',   title: 'Warorot Market',             description: 'Dried mango, northern sausage, and the best people-watching.', extra: 'Open from early morning' },
    { category: 'Day trip', title: 'Bua Tong Sticky Waterfalls', description: 'Limestone you can climb barefoot. Bring a towel.',            extra: '1.5 h north of the city' },
  ];
  recs.forEach((r, i) => {
    const rec: RecDoc = { ...r, id: `rec-${i + 1}`, addedByUid: [MAYA, THEO, JO, ALAYNA][i % 4].uid, createdAt: at(70 + i) };
    store.set(trip('recs', rec.id), rec as unknown as DocData);
  });

  // ── Transportation ────────────────────────────────────────────────────────
  const songthaew: RentalCar = {
    mode: 'Other', company: 'Mr. Kwan’s songthaew', confirmationNumber: '',
    pickupDate: '2026-11-16', pickupTime: '7:45 AM', pickupLocation: 'Baan Nimman Guesthouse',
    dropoffDate: '2026-11-16', dropoffTime: '5:00 PM', dropoffLocation: 'Baan Nimman Guesthouse',
    drivers: 'Mr. Kwan', notes: 'Red truck, 1,200 THB for the day.', passengers: 'All', location: 'Chiang Mai',
  };
  store.set(trip('cars', 'car-1'), songthaew as unknown as DocData);

  // ── Map pins ──────────────────────────────────────────────────────────────
  const pins: MapPin[] = [
    { id: 'pin-1', name: 'Wat Phra That Doi Suthep', lat: 18.8048, lng: 98.9217, category: 'Sightseeing', addedBy: 'Alayna', forWho: 'All', notes: 'Sunrise on the 15th' },
    { id: 'pin-2', name: 'Baan Nimman Guesthouse',   lat: 18.7961, lng: 98.9672, category: 'Stay',        addedBy: 'Alayna', forWho: 'All' },
    { id: 'pin-3', name: 'Warorot Market',           lat: 18.7907, lng: 98.9998, category: 'Market',      addedBy: 'Theo',   forWho: 'All' },
  ];
  pins.forEach(p => store.set(trip('pins', p.id), p as unknown as DocData));

  // ── Packing (personal to the demo traveller) ──────────────────────────────
  const packing: PackingItem[] = [
    { id: 'pk-1', label: 'Rain jacket',                packed: false, addedAt: at(80), category: 'Outerwear' },
    { id: 'pk-2', label: 'Temple-appropriate trousers', packed: true,  addedAt: at(81), category: 'Clothes' },
    { id: 'pk-3', label: 'Sandals',                    packed: true,  addedAt: at(82), category: 'Shoes' },
    { id: 'pk-4', label: 'Mosquito repellent',         packed: false, addedAt: at(83), category: 'Toiletries' },
    { id: 'pk-5', label: 'Power adapter (Type O)',     packed: true,  addedAt: at(84), category: 'Accessories' },
  ];
  store.set(trip('packing', ALAYNA.uid), { items: packing, categories: [] } as unknown as DocData);

  const suggestion: PackingSuggestion = {
    id: 'sug-1', from: MAYA.name, to: ALAYNA.name, item: 'Packable umbrella', sentAt: at(90), status: 'pending',
  };
  store.set(trip('packingSuggestions', suggestion.id), suggestion as unknown as DocData);

  // ── Personal expenses ─────────────────────────────────────────────────────
  const expenses: Expense[] = [
    { id: 'exp-1', date: '2026-11-14', vendor: 'Ristr8to', description: 'Flat white',    amount: 120, currency: 'THB', category: 'food' },
    { id: 'exp-2', date: '2026-11-14', vendor: 'Grab',     description: 'Ride to Nimman', amount: 95,  currency: 'THB', category: 'transport' },
  ];
  store.set(`userExpenses/${ALAYNA.uid}`, { items: expenses } as unknown as DocData);
}
