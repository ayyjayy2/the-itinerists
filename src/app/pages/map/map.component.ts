import {
  Component, AfterViewInit, OnDestroy,
  inject, signal, computed, effect, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { DataService } from '../../services/data.service';
import { UserService } from '../../services/user.service';
import { TripService } from '../../services/trip.service';
import { Flight, ItineraryItem, MapPin, TripUser } from '../../models/trip.models';
import { IconComponent } from '../../shared/icon/icon.component';

// Bump this to wipe the geocache and re-resolve all locations with new strategy.
// v5: destination-aware queries + cache keys (was Ireland-biased before).
const GEOCACHE_KEY         = 'tripmap_geocache';
const GEOCACHE_VERSION_KEY = 'tripmap_geocache_version';
const GEOCACHE_VERSION     = '6';
// Shared (cross-user) geocache doc — versioned so the old Ireland-biased,
// non-namespaced entries are abandoned rather than reused.
const FIRESTORE_GEOCACHE_DOC = 'trip_locations_v6';

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
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
      <polygon points="14,2 17.5,10.5 27,11.5 20,18 22,27 14,22.5 6,27 8,18 1,11.5 10.5,10.5"
        fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`,
    iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -16],
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

@Component({
  selector: 'app-map',
  imports: [IconComponent, CommonModule, FormsModule],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent implements AfterViewInit, OnDestroy {
  private dataService = inject(DataService);
  private userService = inject(UserService);
  private tripService = inject(TripService);
  private ngZone      = inject(NgZone);
  private firestore   = inject(Firestore);

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
  updating  = signal(false);

  categories = CATEGORIES;

  availableDays = computed(() => {
    const data     = this.dataService.data();
    const userName = this.currentUser()?.name ?? '';
    if (!data) return [];
    const items = this.showAll()
      ? data.itinerary
      : data.itinerary.filter(i => this.matches(i.forWho, userName));
    const seen = new Set<string>();
    const days: { date: string; label: string }[] = [];
    for (const item of items) {
      if (!isBlankLoc(item.location) && !seen.has(item.date)) {
        seen.add(item.date);
        // Fall back to a compact date when the itinerary day has no label set.
        const label = item.dayLabel?.trim()
          || new Date(item.date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        days.push({ date: item.date, label });
      }
    }
    return days.sort((a, b) => a.date.localeCompare(b.date));
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

  constructor() {
    effect(() => {
      if (!this.mapReady()) return;
      this.dataService.data();
      this.showAll();
      this.selectedDay();
      this.ngZone.runOutsideAngular(() => this.geocodeNewAndUpdateAll());
    });
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => this.boot());
  }

  ngOnDestroy(): void {
    this.destroyed = true;
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
    const coords = await this.geocodeWithFallback(this.addForm.address, this.tripDestination());
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

  // ── Boot ─────────────────────────────────────────────────────────────────────

  private async boot(): Promise<void> {
    const el = document.getElementById('trip-map');
    if (!el) return;
    // Neutral starting view; the map fits to the trip's markers once they resolve.
    this.map = L.map(el, { zoomControl: true }).setView([25, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(this.map);
    this.flightLayer.addTo(this.map);
    this.routeLayer.addTo(this.map);
    this.accomLayer.addTo(this.map);
    this.itinLayer.addTo(this.map);
    this.customLayer.addTo(this.map);
    this.transportLayer.addTo(this.map);

    await this.waitForData();
    if (this.destroyed) return;
    this.loadCache();
    await this.loadFirestoreCache();
    await this.geocodeInitial();
    if (this.destroyed) return;
    this.ngZone.run(() => this.mapReady.set(true));
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

  /** Pull the shared geocache from Firestore. One read per session;
   *  any locations already resolved by another user are used immediately,
   *  cutting Nominatim calls to near-zero after the first full load. */
  private async loadFirestoreCache(): Promise<void> {
    try {
      const snap = await getDoc(doc(this.firestore, 'geocache', FIRESTORE_GEOCACHE_DOC));
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

  /** Write a single newly-resolved coordinate to the shared Firestore cache.
   *  Fire-and-forget; failures are silently ignored. */
  private saveToFirestoreCache(location: string, coords: { lat: number; lng: number }): void {
    setDoc(
      doc(this.firestore, 'geocache', FIRESTORE_GEOCACHE_DOC),
      { entries: { [location]: coords } },
      { merge: true },
    ).catch(() => { /* ignore write failures */ });
  }

  private async fetchGeocode(query: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const url  = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=en`;
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
  private async geocodeWithFallback(location: string, context = ''): Promise<{ lat: number; lng: number } | null> {
    const key = this.cacheKey(location, context);
    if (this.geocache[key]) {
      this.geocodedLocations.set(location, this.geocache[key]);
      return this.geocache[key];
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

    for (let i = 0; i < attempts.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 1100));
      const coords = await this.fetchGeocode(attempts[i]);
      if (coords) {
        this.geocache[key] = coords;
        this.geocodedLocations.set(location, coords);
        this.saveCache();
        this.saveToFirestoreCache(key, coords); // share with all users (destination-namespaced)
        return coords;
      }
    }
    return null;
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

  private async geocodeInitial(): Promise<void> {
    const locs    = this.allNeededLocations();
    const isCached = (n: { loc: string; ctx: string }) => !!this.geocache[this.cacheKey(n.loc, n.ctx)];
    this.ngZone.run(() => {
      this.totalLocations.set(locs.length);
      this.geocodedCount.set(locs.filter(isCached).length);
      this.loading.set(false);
    });
    for (const n of locs) {
      if (this.destroyed) return;
      if (!isCached(n)) {
        await this.geocodeWithFallback(n.loc, n.ctx);
        this.ngZone.run(() => this.geocodedCount.update(c => c + 1));
        await new Promise(r => setTimeout(r, 1100));
      } else {
        // Cache hit — make sure the render map is populated too.
        await this.geocodeWithFallback(n.loc, n.ctx);
      }
    }
  }

  private async geocodeNewAndUpdateAll(): Promise<void> {
    if (this.geocodingBusy) { this.updateAll(); return; }
    this.geocodingBusy = true;
    this.ngZone.run(() => this.updating.set(true));
    try {
      const newLocs = this.allNeededLocations().filter(n => !this.geocodedLocations.has(n.loc));
      for (const n of newLocs) {
        if (this.destroyed) return;
        await this.geocodeWithFallback(n.loc, n.ctx);
        await new Promise(r => setTimeout(r, 1100));
      }
    } finally {
      this.geocodingBusy = false;
      this.updateAll();
      this.ngZone.run(() => this.updating.set(false));
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
    this.updateItinMarkers(entries);   // itinerary first — it drives fitBounds
    this.updateAccomMarkers(entries);
    this.updateTransportMarkers(entries);
    this.updateFlightMarkers(entries);
    this.updateRouteLines();
    this.updateCustomMarkers(entries);
    this.ngZone.run(() => this.locations.set(entries));
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
      if (day && f.departureDate !== day && f.arrivalDate !== day) return false;
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
      const popup = `
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
          ${flight.notes ? `<div style="font-size:11px;color:#888;margin-top:4px;">${flight.notes}</div>` : ''}
        </div>`;

      if (toCoords) {
        const key = `flight:${routeKey}:${flight.flightNumber}`;
        const marker = L.marker([toCoords.lat, toCoords.lng], { icon: flightPinIcon() })
          .bindPopup(popup, { maxWidth: 240 });
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

    // When a day is selected, assign sequential numbers (1, 2, 3…) to each
    // unique pin location in the order they first appear in the itinerary.
    const locationOrder = new Map<string, number>();
    if (day) {
      let counter = 1;
      for (const item of items) {
        const routeStr = resolveRouteString(item);
        const pinLoc   = routeStr ? (parseRoute(routeStr)?.[1] ?? null) : item.location;
        if (pinLoc && !locationOrder.has(pinLoc)) locationOrder.set(pinLoc, counter++);
      }
    }

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

    const bounds: [number, number][] = [];
    for (const [location, locItems] of byLoc) {
      const coords = this.geocodedLocations.get(location);
      if (!coords) continue;

      const rows = locItems.map(it => `
        <div style="margin-bottom:7px;padding-bottom:7px;border-bottom:1px solid #eee;">
          <div style="font-size:11px;color:#888;margin-bottom:2px;">
            ${this.formatDate(it.date)}${it.time ? ' · ' + it.time : ''}
          </div>
          <div style="font-weight:700;font-size:13px;line-height:1.3;">${it.activity}</div>
          ${it.notes ? `<div style="font-size:11px;color:#666;margin-top:2px;">${it.notes}</div>` : ''}
        </div>`).join('');

      const num = day ? locationOrder.get(location) : undefined;
      const cat = locItems[0]?.category ?? '';
      const key = `itin:${location}`;
      const marker = L.marker([coords.lat, coords.lng], { icon: itinPinIcon(catColor(cat), num) })
        .bindPopup(`
          <div style="min-width:190px;max-width:250px;font-family:'Nunito',sans-serif;">
            <div style="font-weight:800;font-size:13px;margin-bottom:8px;color:#1a4a2e;
                        padding-bottom:6px;border-bottom:2px solid #8BAF7C;">📍 ${location}</div>
            ${rows}
          </div>`, { maxWidth: 260 });
      marker.addTo(this.itinLayer);
      this.markerByKey.set(key, marker);
      const extra = locItems.length - 1;
      entries.push({
        id: key, type: 'itinerary', color: catColor(cat), num,
        name: location,
        detail: (locItems[0]?.activity ?? cat) + (extra > 0 ? ` +${extra} more` : ''),
      });
      bounds.push([coords.lat, coords.lng]);
    }
    this.fitBoundsIfNeeded(bounds);
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
      if (day && !(a.checkIn <= day && day < a.checkOut)) return false;
      return true;
    });

    for (const acc of accoms) {
      if (!acc.address) continue;
      const coords = this.geocodedLocations.get(acc.address);
      if (!coords) continue;

      const popup = `
        <div style="min-width:180px;max-width:230px;font-family:'Nunito',sans-serif;">
          <div style="font-weight:800;font-size:13px;margin-bottom:6px;color:#1a4a2e;
                      padding-bottom:5px;border-bottom:2px solid #B96A76;">
            🏠 ${acc.name}
          </div>
          <div style="font-size:11px;color:#888;">
            Check-in: ${this.formatDate(acc.checkIn)}<br>
            Check-out: ${this.formatDate(acc.checkOut)}
          </div>
          ${acc.bookingRef ? `<div style="font-size:11px;color:#666;margin-top:4px;">Ref: ${acc.bookingRef}</div>` : ''}
          ${acc.notes ? `<div style="font-size:11px;color:#666;margin-top:4px;">${acc.notes}</div>` : ''}
        </div>`;

      const key = `stay:${acc.address}`;
      const marker = L.marker([coords.lat, coords.lng], { icon: accomPinIcon('#B96A76') })
        .bindPopup(popup, { maxWidth: 240 });
      marker.addTo(this.accomLayer);
      this.markerByKey.set(key, marker);
      entries.push({
        id: key, type: 'stay', color: '#B96A76',
        name: acc.name || acc.address,
        detail: acc.checkIn ? `Check-in ${this.formatDate(acc.checkIn)}` : 'Stay',
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
        if (day && leg.date && leg.date !== day) continue;
        const coords = this.geocodedLocations.get(leg.loc);
        if (!coords) continue;

        const popup = `
          <div style="min-width:180px;max-width:230px;font-family:'Nunito',sans-serif;">
            <div style="font-weight:800;font-size:13px;margin-bottom:6px;color:#1a4a2e;
                        padding-bottom:5px;border-bottom:2px solid ${color};">
              ${t.mode || 'Rental Car'} · ${t.company}
            </div>
            <div style="font-size:11px;color:#555;line-height:1.6;">
              <b>${leg.verb}:</b> ${leg.loc}${leg.date ? '<br>' + this.formatDate(leg.date) + (leg.time ? ' · ' + leg.time : '') : ''}
            </div>
            ${t.notes ? `<div style="font-size:11px;color:#888;margin-top:4px;">${t.notes}</div>` : ''}
          </div>`;

        const key = `transport:${t.company}:${leg.k}`;
        const marker = L.marker([coords.lat, coords.lng], { icon: transportPinIcon(color) })
          .bindPopup(popup, { maxWidth: 240 });
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
    const pins     = (data?.mapPins ?? []).filter(p =>
      this.showAll() || this.matches(p.forWho, userName)
    );

    for (const pin of pins) {
      const adderColor = users.find(u => u.name === pin.addedBy)?.color ?? '#8BAF7C';
      const popupId    = `del-pin-${pin.id}`;
      const canDelete  = pin.addedBy === userName;

      const popup = `
        <div style="min-width:180px;max-width:230px;font-family:'Nunito',sans-serif;">
          <div style="font-weight:800;font-size:13px;margin-bottom:6px;color:#1a4a2e;
                      padding-bottom:6px;border-bottom:2px solid ${adderColor};">
            ⭐ ${pin.name}
          </div>
          <div style="font-size:11px;color:#888;margin-bottom:4px;">
            ${pin.category}${pin.addedBy ? ' · Added by ' + pin.addedBy : ''}
          </div>
          ${pin.notes ? `<div style="font-size:12px;color:#555;margin-bottom:6px;">${pin.notes}</div>` : ''}
          ${canDelete
            ? `<button id="${popupId}" style="background:#fee2e2;border:none;border-radius:6px;
                padding:4px 10px;font-size:11px;font-weight:700;color:#991b1b;cursor:pointer;
                font-family:'Nunito',sans-serif;">Remove pin</button>`
            : ''}
        </div>`;

      const marker = L.marker([pin.lat, pin.lng], { icon: customPinIcon(adderColor) })
        .bindPopup(popup, { maxWidth: 250 });
      if (canDelete) {
        marker.on('popupopen', () => {
          document.getElementById(popupId)?.addEventListener('click', () => {
            this.ngZone.run(() => this.dataService.removeMapPin(pin.id));
            marker.closePopup();
          });
        });
      }
      marker.addTo(this.customLayer);

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
    if (!this.map) return;
    if (bounds.length > 1)
      this.map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40] });
    else if (bounds.length === 1)
      this.map.setView(bounds[0], 13);
  }
}
