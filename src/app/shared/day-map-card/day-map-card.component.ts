import {
  Component, AfterViewInit, OnDestroy, ElementRef, ViewChild,
  computed, effect, inject, NgZone,
} from '@angular/core';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { IconComponent } from '../icon/icon.component';
import { ItineraryService } from '../../services/itinerary.service';
import { TripService } from '../../services/trip.service';
import { pickMapDay } from '../../utils/map-day';
import { tripDestinations } from '../../utils/trip-destinations';

// Same cache the Trip Map page reads/writes, so geocodes are shared both ways.
const GEOCACHE_KEY = 'tripmap_geocache';

/**
 * Home-page mini map (Type C): non-interactive Leaflet view pinned to the
 * current itinerary day's stops (or the next planned day pre-trip).
 * Tapping anywhere opens the full Trip Map.
 */
@Component({
  selector: 'app-day-map-card',
  imports: [IconComponent],
  template: `
    <button class="map-card" type="button" (click)="openMap()" aria-label="Open trip map">
      <div class="map-card-head">
        <span class="map-ic"><app-icon name="map" [size]="20" /></span>
        <span class="map-card-title">{{ title() }}</span>
        <span class="map-card-sub">{{ subtitle() }}</span>
        <span class="map-card-arrow">›</span>
      </div>
      <div #mini class="mini-map"></div>
    </button>
  `,
  styles: [`
    .map-card {
      display: block; width: 100%; padding: 0; margin-top: 0.85rem;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #eee);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow: hidden; cursor: pointer; text-align: left;
    }
    .map-card-head {
      display: flex; align-items: center; gap: 0.55rem;
      padding: 0.7rem 0.9rem;
    }
    .map-ic { color: var(--primary-dark, #3f7d58); display: grid; place-items: center; }
    .map-card-title { font-weight: 800; color: var(--text); }
    .map-card-sub { color: var(--text-muted, #8a8a8a); font-size: 0.82rem;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
    .map-card-arrow { color: var(--text-muted, #8a8a8a); font-size: 1.1rem; }
    /* position+z-index trap Leaflet's internal panes (z-index up to ~700)
       inside the card's stacking context so menus/drawers stay on top. */
    .mini-map { height: 170px; pointer-events: none; position: relative; z-index: 0; }
  `],
})
export class DayMapCardComponent implements AfterViewInit, OnDestroy {
  private itineraryService = inject(ItineraryService);
  private tripService      = inject(TripService);
  private router           = inject(Router);
  private ngZone           = inject(NgZone);

  @ViewChild('mini') miniRef!: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private markerLayer = L.layerGroup();
  private destroyed = false;
  private renderSeq = 0;

  private readonly today = new Date().toISOString().slice(0, 10);

  readonly mapDay = computed(() =>
    pickMapDay(this.itineraryService.items().map(i => i.date), this.today));

  readonly dayItems = computed(() => {
    const day = this.mapDay();
    if (!day) return [];
    return this.itineraryService.items()
      .filter(i => i.date === day)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  });

  readonly title = computed(() => {
    const day = this.mapDay();
    if (!day) return 'Trip map';
    return day === this.today ? 'Today on the map' : 'Next up on the map';
  });

  readonly subtitle = computed(() => {
    const day = this.mapDay();
    if (!day) return this.destinationShort();
    const d = new Date(`${day}T12:00:00`);
    const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const n = this.dayItems().length;
    return `${label} · ${n} ${n === 1 ? 'stop' : 'stops'}`;
  });

  constructor() {
    // Re-render markers whenever the target day's items or the trip change.
    effect(() => {
      this.dayItems();
      this.tripService.activeTrip();
      if (this.map) void this.renderMarkers();
    });
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.map = L.map(this.miniRef.nativeElement, {
        zoomControl: false, dragging: false, scrollWheelZoom: false,
        doubleClickZoom: false, boxZoom: false, keyboard: false,
        touchZoom: false, attributionControl: false,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 })
        .addTo(this.map);
      this.markerLayer.addTo(this.map);
      this.centerFallback();
      void this.renderMarkers();
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.map?.remove();
    this.map = null;
  }

  openMap(): void { void this.router.navigate(['/map']); }

  private destinationShort(): string {
    const t = this.tripService.activeTrip();
    return (t?.destination || t?.name || 'Trip map').split(',')[0];
  }

  private centerFallback(): void {
    const t = this.tripService.activeTrip();
    const legs = t ? tripDestinations(t) : [];
    const coords = legs.find(l => l.destinationCoords)?.destinationCoords ?? t?.destinationCoords;
    if (coords && this.map) this.map.setView([coords.lat, coords.lng], 11);
    else this.map?.setView([20, 0], 2);
  }

  /** Pin the day's stops using the Trip Map's shared geocache; geocode gently
   *  (Nominatim, 1.1s apart) only for locations the cache doesn't know yet. */
  private async renderMarkers(): Promise<void> {
    if (!this.map) return;
    const seq = ++this.renderSeq;
    this.markerLayer.clearLayers();

    const dest = this.tripService.activeTrip()?.destination ?? '';
    const points: L.LatLng[] = [];
    let firstMiss = true;

    for (const item of this.dayItems()) {
      if (!item.location) continue;
      let coords = this.cachedCoords(item.location, dest);
      if (!coords) {
        if (!firstMiss) await new Promise(r => setTimeout(r, 1100));
        firstMiss = false;
        coords = await this.fetchGeocode(`${item.location}, ${dest}`)
              ?? await this.fetchGeocode(item.location);
        if (coords) this.storeCoords(item.location, dest, coords);
      }
      if (this.destroyed || seq !== this.renderSeq) return;
      if (!coords) continue;

      const n = points.length + 1;
      points.push(L.latLng(coords.lat, coords.lng));
      L.marker([coords.lat, coords.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:22px;height:22px;border-radius:50%;background:#4a9c6d;
                   border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);color:#fff;
                   font:700 11px/18px 'Nunito',sans-serif;text-align:center;">${n}</div>`,
          iconSize: [22, 22], iconAnchor: [11, 11],
        }),
      }).addTo(this.markerLayer);
    }

    if (points.length && this.map) {
      this.map.fitBounds(L.latLngBounds(points).pad(0.25), { maxZoom: 14, animate: false });
    } else {
      this.centerFallback();
    }
  }

  private cachedCoords(location: string, dest: string): { lat: number; lng: number } | null {
    try {
      const cache = JSON.parse(localStorage.getItem(GEOCACHE_KEY) ?? '{}');
      return cache[`${location} @@ ${dest}`] ?? cache[location] ?? null;
    } catch { return null; }
  }

  private storeCoords(location: string, dest: string, coords: { lat: number; lng: number }): void {
    try {
      const cache = JSON.parse(localStorage.getItem(GEOCACHE_KEY) ?? '{}');
      cache[`${location} @@ ${dest}`] = coords;
      localStorage.setItem(GEOCACHE_KEY, JSON.stringify(cache));
    } catch { /* cache is best-effort */ }
  }

  private async fetchGeocode(query: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=en`;
      const res  = await fetch(url);
      const data = await res.json();
      return data[0] ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
    } catch { return null; }
  }
}
