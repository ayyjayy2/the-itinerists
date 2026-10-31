import {
  Component, ElementRef, OnDestroy,
  inject, signal, computed, effect, untracked, viewChild, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { html, safeColor } from '../../utils/html';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { DataService } from '../../services/data.service';
import { UserService } from '../../services/user.service';
import { TripService } from '../../services/trip.service';
import { Flight, ItineraryItem, MapPin, TripUser } from '../../models/trip.models';
import { activeLeg, tripDestinations, localTodayISO, tripZone } from '../../utils/trip-destinations';
import { AirportZoneService } from '../../services/airport-zone.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { NoTripStateComponent } from '../../shared/no-trip-state/no-trip-state.component';

// Bump this to wipe the geocache and re-resolve all locations with new strategy.
// v5: destination-aware queries + cache keys (was Ireland-biased before).
// v7: lookups bounded to the trip's leg (Alfama was landing in Dublin, Belém in
//     Brazil); airports come from the bundled table, never from a name search.
const GEOCACHE_KEY         = 'tripmap_geocache';
const GEOCODE_MISSES_KEY   = 'tripmap_geocode_misses';

const GEOCACHE_VERSION_KEY = 'tripmap_geocache_version';
const GEOCACHE_VERSION     = '7';
// Each trip's place lookups live under it (trips/{id}/geocache/places),
// readable by its members only. The old shared doc held every trip's places (#356).
const TRIP_GEOCACHE_DOC = 'places';

// Dusk Garden palette (light-theme hexes — the map tiles are always light).
// Markers carry a white outline, so these muted tones still read on the map.
const CAT_COLOR: Record<string, string> = {
  food:          '#B97F35', // gold
  drink:         '#7E6FA8', // lavender
  sightseeing:   '#6A8F5E', // sage
  transport:     '#6E8BA6', // slate-blue (distinct)
  accommodation: '#B96A76', // pink
  lodging:       '#B96A76',
  hotel:         '#B96A76',
  activity:      '#C0564A', // terracotta
  shopping:      '#A76B86', // mauve
  other:         '#9A8E7C', // warm grey
};
const CATEGORIES = ['Food', 'Drink', 'Sightseeing', 'Activity', 'Transport',
                    'Accommodation', 'Shopping', 'Other'];

function catColor(cat: string): string {
  return CAT_COLOR[cat.toLowerCase()] ?? CAT_COLOR['other'];
}

/** True if the location string describes a route rather than a single point. */
function isRoute(loc: string): boolean {
  return !!loc && (loc.includes(' to ') || loc.includes('→'));
}

function isBlankLoc(loc: string): boolean { return !loc; }

/** Parse "A to B" or "A → B" into [A, B]. Works on both location and activity strings. */
function parseRoute(loc: string): [string, string] | null {
  if (loc.includes('→')) {
    const p = loc.split('→').map(s => s.trim());
    return p.length === 2 ? [p[0], p[1]] : null;
  }
  if (loc.includes(' to ')) {
    const i = loc.indexOf(' to ');
    return [loc.slice(0, i).trim(), loc.slice(i + 4).trim()];
  }
  return null;
}

/**
 * Returns the route string for a transport item.
 * Prefers location if it's a route; falls back to activity (e.g. "Drive A → B").
 * Returns null if neither contains a parseable route.
 */
function resolveRouteString(item: { location: string; activity: string; category: string }): string | null {
  if (isRoute(item.location)) return item.location;
  if (item.category.toLowerCase() === 'transport' && isRoute(item.activity)) return item.activity;
  return null;
}


function itinPinIcon(color: string, num?: number): L.DivIcon {
  const hasNum  = num !== undefined;
  const radius  = hasNum ? 5.5 : 4.5;
  const fSize   = (num ?? 0) > 9 ? 6.5 : 8;
  const numSvg  = hasNum
    ? `<text x="12" y="12" text-anchor="middle" dominant-baseline="central"
             font-family="Nunito,sans-serif" font-size="${fSize}" font-weight="800"
             fill="${color}">${num}</text>`
    : '';
  return L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20S24 21 24 12C24 5.37 18.63 0 12 0z"
        fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="${radius}" fill="white" opacity="${hasNum ? '1' : '0.85'}"/>
      ${numSvg}
    </svg>`,
    iconSize: [24, 32], iconAnchor: [12, 32], popupAnchor: [0, -34],
  });
}

function accomPinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="30" viewBox="0 0 28 30">
      <path d="M14 1 L1 13 L4 13 L4 29 L24 29 L24 13 L27 13 Z"
        fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <rect x="11" y="19" width="6" height="10" fill="white" opacity="0.9" rx="1"/>
    </svg>`,
    iconSize: [28, 30], iconAnchor: [14, 30], popupAnchor: [0, -32],
  });
}

function flightPinIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="font-size:16px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))">✈️</div>`,
    iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -12],
  });
}

function customPinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-pin',   // not tied to a day, so a day's framing leaves it out
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
      <polygon points="14,2 17.5,10.5 27,11.5 20,18 22,27 14,22.5 6,27 8,18 1,11.5 10.5,10.5"
        fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`,
    iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -16],
  });
}

/** Trip-level destination anchor — larger teardrop with the leg number. */
function destPinIcon(num: number): L.DivIcon {
  const color = '#2E6F4E'; // deep sage — distinct from category/stay/transport pins
  return L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 24 32">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20S24 21 24 12C24 5.37 18.63 0 12 0z"
        fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="12" cy="12" r="7" fill="white"/>
      <text x="12" y="12" text-anchor="middle" dominant-baseline="central"
            font-family="Nunito,sans-serif" font-size="9" font-weight="800" fill="${color}">${num}</text>
    </svg>`,
    iconSize: [34, 44], iconAnchor: [17, 44], popupAnchor: [0, -46],
  });
}

function transportPinIcon(color: string): L.DivIcon {
  // Teardrop pin with a small vehicle glyph (body + wheels) in white.
  return L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20S24 21 24 12C24 5.37 18.63 0 12 0z"
        fill="${color}" stroke="white" stroke-width="1.5"/>
      <rect x="7" y="7.5" width="10" height="6.5" rx="1.6" fill="white"/>
      <circle cx="9.3" cy="15.2" r="1.4" fill="white"/><circle cx="14.7" cy="15.2" r="1.4" fill="white"/>
    </svg>`,
    iconSize: [24, 32], iconAnchor: [12, 32], popupAnchor: [0, -34],
  });
}


/** One row in the locations list below the map (mirrors a map marker). */
interface LocationEntry {
  id: string;                                    // matches the marker key
  name: string;
  detail: string;
  color: string;
  type: 'itinerary' | 'stay' | 'flight' | 'pin' | 'transport';
  num?: number;                                  // itinerary sequence when a day is selected
}

import { FocusService } from '../../services/focus.service';
import { RateGate, missIsFresh } from '../../utils/rate-gate';
import { BaseMapService } from '../../services/base-map.service';
import { FlightsService } from '../../services/flights.service';
import { bookingDatesFor, everyDay, tripDayList } from '../../utils/trip-day-list';
import { dayChipDate } from '../../utils/day-heading';
import { numberPins } from '../../utils/pin-numbers';
@Component({
  selector: 'app-map',
  imports: [IconComponent, NoTripStateComponent, CommonModule, FormsModule],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent implements OnDestroy {
  private dataService = inject(DataService);
  private userService = inject(UserService);
  private tripService = inject(TripService);
  private flightsService = inject(FlightsService);
  readonly hasActiveTrip = computed(() => this.tripService.activeTrip() !== null);
  private ngZone      = inject(NgZone);
  private focus       = inject(FocusService);
  private firestore   = inject(Firestore);
  private airportZones = inject(AirportZoneService);

  /** Active trip's destination — appended to geocode queries to disambiguate
   *  local place names (e.g. "Baixa" → "Baixa, Lisbon, Portugal"). */
  private tripDestination(): string {
    return (this.tripService.activeTrip()?.destination || '').trim();
  }

  /** First token of the destination ("Lisbon, Portugal" → "lisbon"), for
   *  "already contains the city" checks. */
  private destinationHint(): string {
    return this.tripDestination().split(',')[0].trim().toLowerCase();
  }

  /** Where the trip is right now (the current leg's coordinates), so a place
   *  name is looked up near it: "Alfama" in Lisbon, not Dublin. */
  private nearCoords(): { lat: number; lng: number } | null {
    const trip = this.tripService.activeTrip();
    if (!trip) return null;
    const legs = tripDestinations(trip);
    if (!legs.length) return trip.destinationCoords ?? null;
    const now = new Date();
    const leg = activeLeg(legs, localTodayISO(now, tripZone(trip, now)));
    return leg.destinationCoords ?? legs.find(l => l.destinationCoords)?.destinationCoords ?? trip.destinationCoords ?? null;
  }

  /** Cache key namespaced by destination so the same place name in two
   *  different trips (e.g. "Baixa" in Lisbon vs. Brazil) never collides. */
  private cacheKey(location: string, context: string): string {
    return context ? `${location} @@ ${context}` : location;
  }

  currentUser  = this.userService.currentUser;
  showAll      = signal(false);
  selectedDay  = signal<string | null>(null);
  loading      = signal(true);
  geocodedCount  = signal(0);
  totalLocations = signal(0);
  mapReady  = signal(false);

  categories = CATEGORIES;

  /** The same days the Itinerary offers (tripDayList), worded the same ("Nov. 12"). */
  availableDays = computed(() => {
    const data = this.dataService.data();
    const trip = this.tripService.activeTrip();
    if (!data || !trip) return [];
    const me = this.currentUser();
    const uid = me?.uid ?? '', name = me?.name ?? '';
    const flights = this.flightsService.flights();
    return tripDayList({
      tripDays: trip.startDate && trip.endDate ? everyDay(trip.startDate, trip.endDate) : [],
      plans: data.itinerary.map(i => ({ date: i.date, mine: this.matches(i.forWho, name) })),
      bookingDates: bookingDatesFor(flights, data.accommodations ?? [], data.rentalCar ?? [], uid, name),
      myFlights: flights.filter(f => f.uid === uid),
      showAll: this.showAll(),
    }).map(date => ({ date, label: dayChipDate(date) }));
  });

  tripUsers = computed((): TripUser[] => this.dataService.data()?.users ?? []);

  // ── Add-pin form ─────────────────────────────────────────────────────────────
  showAddForm  = signal(false);
  addSearching = signal(false);
  addError     = signal('');
  addForm = { address: '', name: '', category: 'Sightseeing', notes: '' };
  addForWhoMap: Record<string, boolean> = {};

  /** Locations shown below the map for the current scope/day; rebuilt on each render. */
  readonly locations = signal<LocationEntry[]>([]);
  /** Marker lookup by LocationEntry id, so tapping a list row can fly to & open it. */
  private markerByKey = new Map<string, L.Marker>();

  private map: L.Map | null = null;
  /** The map's element. It only renders once the trip has loaded, which on a
   *  direct load (refresh or link to /map) is after the view first settles. */
  private mapEl = viewChild<ElementRef<HTMLElement>>('tripMap');
  private destLayer      = L.layerGroup();
  private destPinsRendered = false;
  /** True once anything has moved the view off the neutral world zoom, so the
   *  destination fallback never stomps a marker fit that already happened. */
  private viewFitted = false;
  private flightLayer    = L.layerGroup();
  private routeLayer     = L.layerGroup();
  private accomLayer     = L.layerGroup();
  private itinLayer      = L.layerGroup();
  private customLayer    = L.layerGroup();
  private transportLayer = L.layerGroup();

  private geocodedLocations = new Map<string, { lat: number; lng: number }>();
  // Only successful geocodes are stored here (no null caching)
  private geocache: Record<string, { lat: number; lng: number }> = {};
  private destroyed     = false;
  private geocodingBusy = false;
  /** True while places are being looked up and their pins dropped in one by one. */
  private pinning       = false;
  private userMovedMap  = false;
  private nominatim     = new RateGate(1100);
  /** This trip's shared place cache, loading in the background. */
  private sharedCache: Promise<void> = Promise.resolve();

  constructor() {
    // Start Leaflet as soon as the map's element exists, however late that is.
    effect(() => {
      const el = this.mapEl()?.nativeElement;
      if (!el || this.map) return;
      untracked(() => this.ngZone.runOutsideAngular(() => this.boot(el)));
    });

    effect(() => {
      if (!this.mapReady()) return;
      this.dataService.data();
      this.showAll();
      this.selectedDay();
      this.ngZone.runOutsideAngular(() => this.geocodeNewAndUpdateAll());
    });

    // Trip-level destination anchors are context for the whole trip, so they
    // only show on the "All Days" view — drilling into a specific day hides
    // them, leaving just that day's pins.
    effect(() => {
      const showDest = this.selectedDay() === null;
      if (!this.mapReady() || !this.map) return;
      const onMap = this.map.hasLayer(this.destLayer);
      if (showDest && !onMap) this.destLayer.addTo(this.map);
      else if (!showDest && onMap) this.map.removeLayer(this.destLayer);
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.releaseBaseMap();
    this.map?.remove();
    this.map = null;
  }

  setScope(all: boolean): void { this.showAll.set(all); this.selectedDay.set(null); }
  setDay(date: string | null): void { this.selectedDay.set(date); }

  openAddForm(): void {
    this.addForm = { address: '', name: '', category: 'Sightseeing', notes: '' };
    this.addForWhoMap = {};
    for (const u of this.tripUsers()) this.addForWhoMap[u.name] = true;
    this.addError.set('');
    this.showAddForm.set(true);
  }
  closeAddForm(): void { this.showAddForm.set(false); }
  isAllForWho(): boolean { return this.tripUsers().every(u => this.addForWhoMap[u.name]); }
  toggleAllForWho(): void {
    const all = this.isAllForWho();
    for (const u of this.tripUsers()) this.addForWhoMap[u.name] = !all;
  }

  async savePin(): Promise<void> {
    if (!this.addForm.address || !this.addForm.name) return;
    this.addSearching.set(true);
    this.addError.set('');
    const coords = await this.geocodeWithFallback(this.addForm.address, this.tripDestination(), this.nearCoords(), true);
    this.addSearching.set(false);
    if (!coords) { this.addError.set('Location not found — try a more specific address.'); return; }

    const selected = this.tripUsers().filter(u => this.addForWhoMap[u.name]).map(u => u.name);
    this.dataService.addMapPin({
      id:       crypto.randomUUID(),
      name:     this.addForm.name,
      lat:      coords.lat,
      lng:      coords.lng,
      category: this.addForm.category,
      notes:    this.addForm.notes || undefined,
      addedBy:  this.currentUser()?.name ?? '',
      forWho:   selected.length === this.tripUsers().length ? 'All' : selected.join(', '),
    });
    this.showAddForm.set(false);
    this.ngZone.runOutsideAngular(() => {
      if (this.map) this.map.setView([coords.lat, coords.lng], 14);
    });
  }

  // ── Base map (shared with Home's day maps, #568) ─────────────────────────────
  private baseMap = inject(BaseMapService);
  private releaseBaseMap = () => {};
  /** Labels show local names (as on street signs) instead of the app's language. */
  readonly localNames = this.baseMap.localNames;
  toggleLocalNames(): void { this.baseMap.setLocalNames(!this.localNames()); }

  // ── Boot ─────────────────────────────────────────────────────────────────────

  private async boot(el: HTMLElement): Promise<void> {
    // Neutral starting view; the map fits to the trip's markers once they resolve.
    this.map = L.map(el, { zoomControl: true }).setView([25, 0], 2);
    this.map.on('dragstart', () => { this.userMovedMap = true; });
    el.addEventListener('wheel', () => { this.userMovedMap = true; }, { passive: true });
    el.addEventListener('touchstart', e => { if (e.touches.length > 1) this.userMovedMap = true; }, { passive: true });
    // Pins don't wait for the background.
    void this.baseMap.attach(this.map, () => this.destroyed).then(release => this.releaseBaseMap = release);
    this.flightLayer.addTo(this.map);
    this.routeLayer.addTo(this.map);
    this.accomLayer.addTo(this.map);
    this.itinLayer.addTo(this.map);
    this.customLayer.addTo(this.map);
    this.transportLayer.addTo(this.map);
    this.destLayer.addTo(this.map);

    await this.waitForData();
    if (this.destroyed) return;
    this.loadCache();
    // The trip's shared cache is a network read: show what this device already
    // knows at once, and let the lookups below wait for it instead (#601).
    this.sharedCache = this.loadFirestoreCache();
    this.primeFromCache();
    // Show the map now with the places already known; the mapReady effect then
    // looks up the rest, dropping each pin in as it's found.
    this.ngZone.run(() => this.mapReady.set(true));
    // Trip-level destination pins (multi-destination only). Runs after the
    // marker cycle so its fit-all-destinations wins the initial view. Then, if
    // nothing at all has fitted the view, fall back to the trip destination.
    await this.renderDestinationPins();
    void this.centerOnDestinationIfIdle();
  }

  /**
   * Drop a distinct anchor pin for each destination leg and fit the map to all
   * of them. Multi-destination trips only — single-destination maps are
   * unchanged (itinerary markers drive the view as before). Runs once.
   */
  private async renderDestinationPins(): Promise<void> {
    if (this.destPinsRendered || !this.map) return;
    const trip = this.tripService.activeTrip();
    if (!trip) return;
    const legs = tripDestinations(trip);
    if (legs.length <= 1) return;
    this.destPinsRendered = true;

    const bounds: [number, number][] = [];
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      let coords = leg.destinationCoords ?? null;
      if (!coords) coords = await this.geocodeWithFallback(leg.destination);
      if (this.destroyed) return;
      if (!coords) continue;

      const short = leg.destination.split(',')[0].trim();
      const dates = `${this.formatDate(leg.startDate)} – ${this.formatDate(leg.endDate)}`;
      const popup = html`
        <div style="min-width:150px;font-family:'Nunito',sans-serif;">
          <div style="font-weight:800;font-size:13px;color:#1a4a2e;padding-bottom:5px;
                      border-bottom:2px solid #2E6F4E;">📍 Stop ${i + 1}: ${short}</div>
          <div style="font-size:11px;color:#888;margin-top:5px;">${dates}</div>
        </div>`;

      L.marker([coords.lat, coords.lng], { icon: destPinIcon(i + 1) })
        .bindPopup(String(popup))
        .addTo(this.destLayer);
      bounds.push([coords.lat, coords.lng]);
    }

    if (this.map && bounds.length > 1) {
      this.viewFitted = true;
      this.map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [50, 50] });
    }
  }

  private waitForData(): Promise<void> {
    return new Promise(resolve => {
      const check = () => {
        if (this.destroyed || this.dataService.data()) { resolve(); return; }
        setTimeout(check, 150);
      };
      check();
    });
  }

  // ── Geocoding ─────────────────────────────────────────────────────────────────

  private loadCache(): void {
    // Bust stale cache when geocoding strategy changes
    if (localStorage.getItem(GEOCACHE_VERSION_KEY) !== GEOCACHE_VERSION) {
      localStorage.removeItem(GEOCACHE_KEY);
      localStorage.removeItem('ireland_geocache'); // drop the legacy Ireland-biased cache
      localStorage.setItem(GEOCACHE_VERSION_KEY, GEOCACHE_VERSION);
    }
    try {
      const raw = localStorage.getItem(GEOCACHE_KEY);
      this.geocache = raw ? JSON.parse(raw) : {};
    } catch { this.geocache = {}; }
    // Note: the render map (geocodedLocations, keyed by raw location) is filled
    // during geocodeInitial via instant cache hits — not prefilled here, since
    // geocache keys are destination-namespaced.
  }

  private saveCache(): void {
    localStorage.setItem(GEOCACHE_KEY, JSON.stringify(this.geocache));
  }

  /** This trip's place lookups, shared by its members: one read per visit, so
   *  places a fellow member already resolved appear at once, without Nominatim. */
  private tripGeocacheRef() {
    const tripId = this.tripService.activeTrip()?.id;
    return tripId ? doc(this.firestore, 'trips', tripId, 'geocache', TRIP_GEOCACHE_DOC) : null;
  }

  private async loadFirestoreCache(): Promise<void> {
    const ref = this.tripGeocacheRef();
    if (!ref) return;
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const entries = snap.data()['entries'] as Record<string, { lat: number; lng: number }> ?? {};
      let addedNew = false;
      for (const [key, coords] of Object.entries(entries)) {
        if (!this.geocache[key]) {
          this.geocache[key] = coords;
          addedNew = true;
        }
      }
      if (addedNew) this.saveCache(); // keep localStorage in sync
    } catch { /* offline or permission error — fall back to local cache */ }
  }

  /** Add one newly resolved place to this trip's cache. Fire-and-forget. */
  private saveToFirestoreCache(location: string, coords: { lat: number; lng: number }): void {
    const ref = this.tripGeocacheRef();
    if (!ref) return;
    setDoc(ref, { entries: { [location]: coords } }, { merge: true })
      .catch(() => { /* ignore write failures */ });
  }

  /** One Nominatim lookup. With `near`, only results within about 150 km of it count
   *  (viewbox + bounded), which is what keeps a neighbourhood in its own city. */
  private async fetchGeocode(query: string, near?: { lat: number; lng: number } | null): Promise<{ lat: number; lng: number } | null> {
    try {
      let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=en`;
      if (near) {
        const dLat = 1.4, dLng = 1.4 / Math.max(0.2, Math.cos(near.lat * Math.PI / 180));
        url += `&viewbox=${(near.lng - dLng).toFixed(3)},${(near.lat + dLat).toFixed(3)},${(near.lng + dLng).toFixed(3)},${(near.lat - dLat).toFixed(3)}&bounded=1`;
      }
      await this.nominatim.wait();   // Nominatim: one request a second
      const res  = await fetch(url);
      const data = await res.json();
      return data[0] ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
    } catch { return null; }
  }

  /**
   * Tries multiple simplified forms of `location` until one geocodes:
   * 1. Strip parenthetical codes like (DUB), (RDU)
   * 2. Last 2 comma parts (city, country)
   * 3. Last 1 comma part (city)
   * Caches successful result under the original key.
   */
  private async geocodeWithFallback(location: string, context = '', near: { lat: number; lng: number } | null = null, retryMiss = false): Promise<{ lat: number; lng: number } | null> {
    const key = this.cacheKey(location, context);
    if (this.geocache[key]) {
      this.geocodedLocations.set(location, this.geocache[key]);
      return this.geocache[key];
    }
    // A place that wasn't found lately isn't looked up again on every visit.
    if (!retryMiss && this.isKnownMiss(key)) return null;

    // An airport code is answered from the bundled table: exact, instant, no network.
    const code = location.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(code)) {
      const airport = await this.airportZones.coordsFor(code);
      if (airport) {
        this.geocache[key] = airport;
        this.geocodedLocations.set(location, airport);
        this.saveCache();
        return airport;
      }
    }

    const cleaned = location.replace(/\s*\([A-Z0-9]{2,5}\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const parts   = cleaned.split(',').map(s => s.trim()).filter(Boolean);
    // Append the trip destination for context, unless the string already names it.
    const hint = this.destinationHint();
    const withCtx = (s: string): string =>
      context && hint && !s.toLowerCase().includes(hint) ? `${s}, ${context}` : s;

    // A bare 3-letter uppercase token is almost certainly an IATA airport code;
    // "LHR" alone is ambiguous (→ Lahore), but "LHR airport" disambiguates.
    const isIata = /^[A-Z]{3}$/.test(cleaned);

    // Most specific first, then progressively looser fallbacks.
    const attempts = (isIata
      ? [`${cleaned} airport`, cleaned]
      : [
          withCtx(cleaned),
          parts.length >= 2 ? withCtx(parts[0]) : '',
          cleaned,
          parts.length >= 3 ? parts.slice(-2).join(', ') : '',
          parts.length >= 2 ? parts[parts.length - 1] : '',
        ]
    ).filter((v, i, a) => v && a.indexOf(v) === i); // drop blanks + duplicates

    // Near the trip's current leg first; the same forms unbounded only if nothing is found there.
    const plan = near ? [...attempts.map(q => ({ q, near })), ...attempts.map(q => ({ q, near: null }))] : attempts.map(q => ({ q, near: null }));
    // A result from the unbounded pass still has to be on this trip: a place
    // Nominatim does not know must get no pin, not a namesake on another continent.
    const MAX_KM = 300;
    const kmFrom = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
      Math.hypot(a.lat - b.lat, (a.lng - b.lng) * Math.cos(b.lat * Math.PI / 180)) * 111;
    for (let i = 0; i < plan.length; i++) {
      if (this.destroyed) return null;
      let coords = await this.fetchGeocode(plan[i].q, plan[i].near);
      if (coords && near && !plan[i].near && kmFrom(coords, near) > MAX_KM) coords = null;
      if (coords) {
        this.geocache[key] = coords;
        this.geocodedLocations.set(location, coords);
        this.saveCache();
        this.saveToFirestoreCache(key, coords); // share with the trip's members
        return coords;
      }
    }
    this.rememberMiss(key);
    return null;
  }

  // Places that couldn't be found, by cache key → when (on this device only).
  private isKnownMiss(key: string): boolean {
    const at = this.misses()[key];
    return at !== undefined && missIsFresh(at, Date.now());
  }

  private rememberMiss(key: string): void {
    const misses = this.misses();
    misses[key] = Date.now();
    try { localStorage.setItem(GEOCODE_MISSES_KEY, JSON.stringify(misses)); } catch { /* storage full */ }
  }

  private misses(): Record<string, number> {
    try { return JSON.parse(localStorage.getItem(GEOCODE_MISSES_KEY) ?? '{}'); } catch { return {}; }
  }

  /**
   * Collect every unique location we need to geocode, each with its context.
   * Itinerary/stays/pins sit at the trip destination, so they carry it as
   * context; flight airports geocode on their own (a departure airport is
   * usually in a *different* city, so forcing the destination would misplace it).
   */
  private allNeededLocations(): { loc: string; ctx: string }[] {
    const data = this.dataService.data();
    if (!data) return [];
    const dest = this.tripDestination();
    const byLoc = new Map<string, string>(); // loc → ctx (first wins)
    const add = (loc: string, ctx: string) => { if (loc && !byLoc.has(loc)) byLoc.set(loc, ctx); };

    // Itinerary: single-place items
    for (const i of data.itinerary) {
      if (!isBlankLoc(i.location) && !resolveRouteString(i)) add(i.location, dest);
    }
    // Itinerary: route endpoints
    for (const i of data.itinerary) {
      const routeStr = resolveRouteString(i);
      if (routeStr) {
        const r = parseRoute(routeStr);
        if (r) { add(r[0], dest); add(r[1], dest); }
      }
    }
    // Accommodations
    for (const a of data.accommodations ?? []) add(a.address, dest);
    // Flights: departure and arrival airports (no destination context)
    for (const f of data.flights ?? []) { add(f.from, ''); add(f.to, ''); }
    // Transportation: pick-up / drop-off (or depart / arrive) locations
    for (const t of data.rentalCar ?? []) { add(t.pickupLocation, dest); add(t.dropoffLocation, dest); }

    return [...byLoc].map(([loc, ctx]) => ({ loc, ctx }));
  }

  /** Before the map shows: put every already-known place on it, and count the rest. */
  private primeFromCache(): void {
    let done = 0;
    const locs = this.allNeededLocations();
    for (const n of locs) {
      const key = this.cacheKey(n.loc, n.ctx);
      const coords = this.geocache[key];
      if (coords) { this.geocodedLocations.set(n.loc, coords); done++; }
      else if (this.isKnownMiss(key)) done++;
    }
    this.ngZone.run(() => {
      this.totalLocations.set(locs.length);
      this.geocodedCount.set(done);
      this.loading.set(false);
    });
  }

  /**
   * Draw what's known, then look up the places still missing (one request a
   * second), redrawing as each pin is found rather than after the last one.
   */
  private async geocodeNewAndUpdateAll(): Promise<void> {
    if (this.geocodingBusy) { this.updateAll(); return; }
    this.geocodingBusy = true;
    try {
      this.updateAll();
      // Places a fellow member already found come from the shared cache, not Nominatim.
      await this.sharedCache;
      if (this.destroyed) return;
      const all  = this.allNeededLocations();
      for (const n of all) {
        const cached = this.geocache[this.cacheKey(n.loc, n.ctx)];
        if (cached) this.geocodedLocations.set(n.loc, cached);
      }
      const todo = all.filter(n => !this.geocodedLocations.has(n.loc) && !this.isKnownMiss(this.cacheKey(n.loc, n.ctx)));
      this.ngZone.run(() => { this.totalLocations.set(all.length); this.geocodedCount.set(all.length - todo.length); });
      this.pinning = true;
      for (const n of todo) {
        if (this.destroyed) return;
        const coords = await this.geocodeWithFallback(n.loc, n.ctx, this.nearCoords());
        this.ngZone.run(() => this.geocodedCount.update(c => c + 1));
        if (coords) this.updateAll();
      }
    } finally {
      this.pinning = false;
      this.geocodingBusy = false;
      if (!this.destroyed) this.updateAll();
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────────────

  private matches(forWho: string, userName: string): boolean {
    return forWho === 'All' || forWho.split(',').map(s => s.trim()).includes(userName);
  }

  private formatDate(d: string): string {
    if (!d) return '';
    return new Date(d + 'T00:00').toLocaleDateString('en-IE', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }

  private updateAll(): void {
    this.markerByKey.clear();
    const entries: LocationEntry[] = [];
    this.updateItinMarkers(entries);
    this.updateAccomMarkers(entries);
    this.updateTransportMarkers(entries);
    this.updateFlightMarkers(entries);
    this.updateRouteLines();
    this.updateCustomMarkers(entries);
    this.ngZone.run(() => this.locations.set(entries));
    // One day frames all of that day's stops (plans, stay, rides, flight arrival);
    // All Days frames the plans. Custom pins aren't tied to a day, so never count.
    const day = this.selectedDay();
    const framed = [...this.markerByKey].filter(([key]) => day ? !key.startsWith('pin:') : key.startsWith('itin:'));
    this.fitBoundsIfNeeded(framed.map(([, m]) => { const ll = m.getLatLng(); return [ll.lat, ll.lng] as [number, number]; }));
  }

  private updateFlightMarkers(entries: LocationEntry[]): void {
    if (!this.map) return;
    this.flightLayer.clearLayers();
    const data     = this.dataService.data();
    const userName = this.currentUser()?.name ?? '';
    const day      = this.selectedDay();
    if (!data) return;

    const flights: Flight[] = (data.flights ?? []).filter(f => {
      if (!this.showAll() && f.person !== userName) return false;
      // Like the Itinerary: a flight in is on the day it lands, a flight home on the day it leaves (#603).
      if (day && (f.section === 'ARRIVALS' ? f.arrivalDate : f.departureDate) !== day) return false;
      return true;
    });

    // Group by unique route to avoid drawing duplicate lines for shared flights
    const drawnRoutes = new Set<string>();

    for (const flight of flights) {
      const fromCoords = this.geocodedLocations.get(flight.from);
      const toCoords   = this.geocodedLocations.get(flight.to);
      if (!fromCoords || !toCoords) continue;

      const routeKey = `${flight.from}→${flight.to}`;

      if (!drawnRoutes.has(routeKey)) {
        drawnRoutes.add(routeKey);
        const from: [number, number] = [fromCoords.lat, fromCoords.lng];
        const to:   [number, number] = [toCoords.lat,   toCoords.lng];
        L.polyline([from, to], {
          color: '#94A3B8', weight: 1.5, dashArray: '3 7', opacity: 0.55,
        }).addTo(this.flightLayer);
      }

      // Pin at arrival airport with full flight details
      const popup = html`
        <div style="min-width:180px;max-width:230px;font-family:'Nunito',sans-serif;">
          <div style="font-weight:800;font-size:13px;margin-bottom:6px;color:#1a4a2e;
                      padding-bottom:5px;border-bottom:2px solid #94A3B8;">
            ✈️ ${flight.airline} ${flight.flightNumber}
          </div>
          <div style="font-size:11px;color:#555;line-height:1.6;">
            <b>From:</b> ${flight.from}<br>
            <b>To:</b> ${flight.to}<br>
            <b>Departs:</b> ${this.formatDate(flight.departureDate)} ${flight.departureTime}<br>
            <b>Arrives:</b> ${this.formatDate(flight.arrivalDate)} ${flight.arrivalTime}
          </div>
          ${flight.notes ? html`<div style="font-size:11px;color:#888;margin-top:4px;">${flight.notes}</div>` : ''}
        </div>`;

      if (toCoords) {
        const key = `flight:${routeKey}:${flight.flightNumber}`;
        const marker = L.marker([toCoords.lat, toCoords.lng], { icon: flightPinIcon() })
          .bindPopup(String(popup), { maxWidth: 240 });
        marker.addTo(this.flightLayer);
        this.markerByKey.set(key, marker);
        entries.push({
          id: key, type: 'flight', color: '#94A3B8',
          name: `Flight to ${flight.to}`,
          detail: [flight.airline, flight.flightNumber].filter(Boolean).join(' ') || 'Flight',
        });
      }
    }
  }

  private updateItinMarkers(entries: LocationEntry[]): void {
    if (!this.map) return;
    this.itinLayer.clearLayers();
    const data      = this.dataService.data();
    const userName  = this.currentUser()?.name ?? '';
    const day       = this.selectedDay();

    const myTrip = !this.showAll();

    const items: ItineraryItem[] = (data?.itinerary ?? []).filter(item => {
      if (isBlankLoc(item.location)) return false;
      if (day && item.date !== day) return false;
      // My Trip always filters by forWho regardless of whether a day is selected.
      if (myTrip && !this.matches(item.forWho, userName)) return false;
      return true;
    });

    // When a day is selected, number its pins 1, 2, 3… in the day's order,
    // counting only places that are on the map (a place not found yet, or at
    // all, doesn't use up a number).
    const locationOrder = day
      ? numberPins(items.map(item => {
          const routeStr = resolveRouteString(item);
          return { loc: routeStr ? (parseRoute(routeStr)?.[1] ?? null) : item.location, sortOrder: item.sortOrder, time: item.time };
        }), loc => this.geocodedLocations.has(loc))
      : new Map<string, number>();

    const byLoc = new Map<string, ItineraryItem[]>();
    for (const item of items) {
      const routeStr = resolveRouteString(item);
      if (routeStr) {
        // Pin at the destination (TO part of the route)
        const parsed = parseRoute(routeStr);
        const pinLoc = parsed ? parsed[1] : null;
        if (!pinLoc) continue;
        const arr = byLoc.get(pinLoc);
        if (arr) arr.push(item); else byLoc.set(pinLoc, [item]);
      } else {
        const arr = byLoc.get(item.location);
        if (arr) arr.push(item); else byLoc.set(item.location, [item]);
      }
    }

    const rowsFrom = entries.length;
    for (const [location, locItems] of byLoc) {
      const coords = this.geocodedLocations.get(location);
      if (!coords) continue;

      const rows = locItems.map(it => html`
        <div style="margin-bottom:7px;padding-bottom:7px;border-bottom:1px solid #eee;">
          <div style="font-size:11px;color:#888;margin-bottom:2px;">
            ${this.formatDate(it.date)}${it.time ? ' · ' + it.time : ''}
          </div>
          <div style="font-weight:700;font-size:13px;line-height:1.3;">${it.activity}</div>
          ${it.notes ? html`<div style="font-size:11px;color:#666;margin-top:2px;">${it.notes}</div>` : ''}
        </div>`);

      const num = day ? locationOrder.get(location) : undefined;
      const cat = locItems[0]?.category ?? '';
      const key = `itin:${location}`;
      const marker = L.marker([coords.lat, coords.lng], { icon: itinPinIcon(catColor(cat), num) })
        .bindPopup(String(html`
          <div style="min-width:190px;max-width:250px;font-family:'Nunito',sans-serif;">
            <div style="font-weight:800;font-size:13px;margin-bottom:8px;color:#1a4a2e;
                        padding-bottom:6px;border-bottom:2px solid #8BAF7C;">📍 ${location}</div>
            ${rows}
          </div>`), { maxWidth: 260 });
      marker.addTo(this.itinLayer);
      this.markerByKey.set(key, marker);
      const extra = locItems.length - 1;
      entries.push({
        id: key, type: 'itinerary', color: catColor(cat), num,
        name: location,
        detail: (locItems[0]?.activity ?? cat) + (extra > 0 ? ` +${extra} more` : ''),
      });
    }
    // A day's plans are listed in their numbered order, like the pins.
    if (day) {
      const rows = entries.splice(rowsFrom).sort((a, b) => (a.num ?? Infinity) - (b.num ?? Infinity));
      entries.push(...rows);
    }
  }

  private updateRouteLines(): void {
    if (!this.map) return;
    // Route lines replaced by numbered pins — nothing to draw.
    this.routeLayer.clearLayers();
  }

  private updateAccomMarkers(entries: LocationEntry[]): void {
    if (!this.map) return;
    this.accomLayer.clearLayers();
    const data     = this.dataService.data();
    const userName = this.currentUser()?.name ?? '';
    if (!data) return;

    const day = this.selectedDay();
    const accoms = (data.accommodations ?? []).filter(a => {
      if (!this.showAll() && !this.matches(a.forWho, userName)) return false;
      // Like the Itinerary: a stay is on its check-in and check-out days (#603).
      if (day && a.checkIn !== day && a.checkOut !== day) return false;
      return true;
    });

    for (const acc of accoms) {
      if (!acc.address) continue;
      const coords = this.geocodedLocations.get(acc.address);
      if (!coords) continue;

      const popup = html`
        <div style="min-width:180px;max-width:230px;font-family:'Nunito',sans-serif;">
          <div style="font-weight:800;font-size:13px;margin-bottom:6px;color:#1a4a2e;
                      padding-bottom:5px;border-bottom:2px solid #B96A76;">
            🏠 ${acc.name}
          </div>
          <div style="font-size:11px;color:#888;">
            Check-in: ${this.formatDate(acc.checkIn)}<br>
            Check-out: ${this.formatDate(acc.checkOut)}
          </div>
          ${acc.bookingRef ? html`<div style="font-size:11px;color:#666;margin-top:4px;">Ref: ${acc.bookingRef}</div>` : ''}
          ${acc.notes ? html`<div style="font-size:11px;color:#666;margin-top:4px;">${acc.notes}</div>` : ''}
        </div>`;

      const key = `stay:${acc.address}`;
      const marker = L.marker([coords.lat, coords.lng], { icon: accomPinIcon('#B96A76') })
        .bindPopup(String(popup), { maxWidth: 240 });
      marker.addTo(this.accomLayer);
      this.markerByKey.set(key, marker);
      entries.push({
        id: key, type: 'stay', color: '#B96A76',
        name: acc.name || acc.address,
        detail: day && day === acc.checkOut ? `Check-out ${this.formatDate(acc.checkOut)}`
          : acc.checkIn ? `Check-in ${this.formatDate(acc.checkIn)}` : 'Stay',
      });
    }
  }

  private updateTransportMarkers(entries: LocationEntry[]): void {
    if (!this.map) return;
    this.transportLayer.clearLayers();
    const data = this.dataService.data();
    if (!data) return;

    const day   = this.selectedDay();
    const color = CAT_COLOR['transport'];

    for (const t of data.rentalCar ?? []) {
      if (!t.company) continue;
      const isVehicle = !t.mode || t.mode === 'Rental Car' || t.mode === 'Rideshare';
      const legs = [
        { k: 'pick', loc: t.pickupLocation,  date: t.pickupDate,  time: t.pickupTime,  verb: isVehicle ? 'Pick-up' : 'Depart' },
        { k: 'drop', loc: t.dropoffLocation, date: t.dropoffDate, time: t.dropoffTime, verb: isVehicle ? 'Drop-off' : 'Arrive' },
      ];
      for (const leg of legs) {
        if (!leg.loc) continue;
        if (day && leg.date !== day) continue;   // an undated leg isn't on any day's Itinerary
        const coords = this.geocodedLocations.get(leg.loc);
        if (!coords) continue;

        const popup = html`
          <div style="min-width:180px;max-width:230px;font-family:'Nunito',sans-serif;">
            <div style="font-weight:800;font-size:13px;margin-bottom:6px;color:#1a4a2e;
                        padding-bottom:5px;border-bottom:2px solid ${color};">
              ${t.mode || 'Rental Car'} · ${t.company}
            </div>
            <div style="font-size:11px;color:#555;line-height:1.6;">
              <b>${leg.verb}:</b> ${leg.loc}${leg.date ? html`<br>${this.formatDate(leg.date)}${leg.time ? ' · ' + leg.time : ''}` : ''}
            </div>
            ${t.notes ? html`<div style="font-size:11px;color:#888;margin-top:4px;">${t.notes}</div>` : ''}
          </div>`;

        const key = `transport:${t.company}:${leg.k}`;
        const marker = L.marker([coords.lat, coords.lng], { icon: transportPinIcon(color) })
          .bindPopup(String(popup), { maxWidth: 240 });
        marker.addTo(this.transportLayer);
        this.markerByKey.set(key, marker);
        entries.push({
          id: key, type: 'transport', color,
          name: `${leg.verb}: ${t.company}`,
          detail: [t.mode || 'Rental Car', leg.loc].filter(Boolean).join(' · '),
        });
      }
    }
  }

  private updateCustomMarkers(entries: LocationEntry[]): void {
    if (!this.map) return;
    this.customLayer.clearLayers();
    const data     = this.dataService.data();
    const userName = this.currentUser()?.name ?? '';
    const users    = data?.users ?? [];
    // Custom pins have no date, so they're on All Days only, never a single day (#603).
    const pins     = this.selectedDay() ? [] : (data?.mapPins ?? []).filter(p =>
      this.showAll() || this.matches(p.forWho, userName)
    );

    for (const pin of pins) {
      const adderColor = safeColor(users.find(u => u.name === pin.addedBy)?.color, '#8BAF7C');
      const popupId    = `del-pin-${pin.id}`;
      const canDelete  = pin.addedBy === userName;

      const popup = html`
        <div style="min-width:180px;max-width:230px;font-family:'Nunito',sans-serif;">
          <div style="font-weight:800;font-size:13px;margin-bottom:6px;color:#1a4a2e;
                      padding-bottom:6px;border-bottom:2px solid ${adderColor};">
            ⭐ ${pin.name}
          </div>
          <div style="font-size:11px;color:#888;margin-bottom:4px;">
            ${pin.category}${pin.addedBy ? ' · Added by ' + pin.addedBy : ''}
          </div>
          ${pin.notes ? html`<div style="font-size:12px;color:#555;margin-bottom:6px;">${pin.notes}</div>` : ''}
          ${canDelete
            ? html`<button id="${popupId}" style="background:#fee2e2;border:none;border-radius:6px;
                padding:4px 10px;font-size:11px;font-weight:700;color:#991b1b;cursor:pointer;
                font-family:'Nunito',sans-serif;">Remove pin</button>`
            : ''}
        </div>`;

      const marker = L.marker([pin.lat, pin.lng], { icon: customPinIcon(adderColor) })
        .bindPopup(String(popup), { maxWidth: 250 });
      if (canDelete) {
        marker.on('popupopen', () => {
          document.getElementById(popupId)?.addEventListener('click', () => {
            this.ngZone.run(() => this.dataService.removeMapPin(pin.id));
            marker.closePopup();
          });
        });
      }
      marker.addTo(this.customLayer);
      if (this.focus.id() === pin.id) {
        // Deep link from the bell: land on this pin.
        this.map.setView([pin.lat, pin.lng], Math.max(this.map.getZoom(), 14));
        marker.openPopup();
        this.ngZone.run(() => this.focus.clear());
      }

      const key = `pin:${pin.id}`;
      this.markerByKey.set(key, marker);
      entries.push({
        id: key, type: 'pin', color: adderColor,
        name: pin.name,
        detail: [pin.category, pin.addedBy && `Added by ${pin.addedBy}`].filter(Boolean).join(' · '),
      });
    }
  }

  /** Tapping a list row flies the map to that marker and opens its popup. */
  focusLocation(entry: LocationEntry): void {
    const marker = this.markerByKey.get(entry.id);
    if (!marker || !this.map) return;
    // The list sits below the full-size map, so scroll the map back into view.
    document.getElementById('trip-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const ll = marker.getLatLng();
    this.map.flyTo(ll, Math.max(this.map.getZoom(), 14), { duration: 0.6 });
    marker.openPopup();
  }

  private fitBoundsIfNeeded(bounds: [number, number][]): void {
    if (!this.map || !bounds.length) return;
    // While pins are still dropping in, stop re-fitting once the person has moved the map.
    if (this.pinning && this.userMovedMap) return;
    this.viewFitted = true;
    if (bounds.length > 1)
      this.map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40] });
    else
      this.map.setView(bounds[0], 13);
  }

  /**
   * A trip with no mappable items yet (fresh trip, empty itinerary) would
   * otherwise sit on the neutral world view — center on the trip's destination
   * instead so the map opens somewhere useful. Multi-destination trips focus
   * the current/upcoming leg. Skipped as soon as any marker fit has run.
   */
  private async centerOnDestinationIfIdle(): Promise<void> {
    if (!this.map || this.viewFitted) return;
    const trip = this.tripService.activeTrip();
    if (!trip) return;
    const legs = tripDestinations(trip);
    const leg  = activeLeg(legs, new Date().toISOString().slice(0, 10));
    let coords = leg.destinationCoords ?? null;
    if (!coords && leg.destination.trim()) coords = await this.geocodeWithFallback(leg.destination);
    if (this.destroyed || !coords || this.viewFitted || !this.map) return;
    this.map.setView([coords.lat, coords.lng], 11);
  }
}
