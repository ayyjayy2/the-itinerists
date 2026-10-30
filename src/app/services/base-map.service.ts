import { Injectable, signal } from '@angular/core';
import * as L from 'leaflet';
import { labelExpression, nameLabelLayers } from '../utils/map-labels';

/**
 * The map under every Leaflet map in the app (the Map page and Home's day
 * maps), so they look and read the same (#568): OpenFreeMap, drawn by MapLibre,
 * with labels in the app's language or, with "Local names", as on the street
 * signs. One switch, remembered on the device, applies to every map at once.
 * Devices that can't draw maps themselves (no WebGL), or a failed load, get
 * OpenStreetMap's tiles as before.
 */
export const LABEL_MODE_KEY = 'tripmap_label_mode';
const MAP_STYLE_URL   = 'https://tiles.openfreemap.org/styles/liberty';
export const BASE_MAP_ATTRIBUTION = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> '
  + '© <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> '
  + 'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const OSM_ATTRIBUTION = '© <a href="https://openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
/** The app's language; the maps follow it once the app has others. */
const APP_LANGUAGE    = 'en';

/** The parts of a MapLibre map this service uses. */
export interface GlMap {
  getStyle(): { layers: { id: string; layout?: Record<string, unknown> }[] } | undefined;
  setLayoutProperty(layer: string, name: string, value: unknown): void;
}

@Injectable({ providedIn: 'root' })
export class BaseMapService {
  /** Labels show local names (as on street signs) instead of the app's language. */
  readonly localNames = signal(readLocalNames());
  private maps = new Set<GlMap>();

  setLocalNames(local: boolean): void {
    this.localNames.set(local);
    try { localStorage.setItem(LABEL_MODE_KEY, local ? 'local' : 'app'); } catch { /* private mode */ }
    for (const gl of this.maps) this.applyLabels(gl);
  }

  /** Keep a drawn map's labels in step with the switch; the returned function stops that. */
  track(gl: GlMap): () => void {
    this.maps.add(gl);
    this.applyLabels(gl);
    return () => this.maps.delete(gl);
  }

  /**
   * Put the base map under a Leaflet map. MapLibre is loaded only now, so the
   * page and its pins never wait for it. Resolves to a function that lets go
   * of the map (call it before `map.remove()`).
   */
  async attach(map: L.Map, isGone: () => boolean): Promise<() => void> {
    if (!supportsWebGL()) { addOsmTiles(map); return () => {}; }
    try {
      const [maplibre, { maplibreGL }] = await Promise.all([
        import('maplibre-gl'), import('@maplibre/maplibre-gl-leaflet'),
      ]);
      // Our security policy only runs workers from our own site (worker-src 'self').
      maplibre.setWorkerUrl(new URL('maplibre/maplibre-gl-worker.mjs', document.baseURI).href);
      if (isGone()) return () => {};
      // The bridge takes its credit line from `attributionControl.customAttribution`, so
      // it reads the same whatever the style says.
      const layer = maplibreGL({
        style: MAP_STYLE_URL, attributionControl: { customAttribution: BASE_MAP_ATTRIBUTION },
      } as Parameters<typeof maplibreGL>[0]).addTo(map);
      const gl = layer.getMaplibreMap();
      let untrack = () => {};
      gl.once('load', () => { if (!isGone()) untrack = this.track(gl as unknown as GlMap); });
      return () => untrack();
    } catch (err) {
      console.warn('[BaseMap] OpenFreeMap failed; using OpenStreetMap tiles', err);
      if (!isGone()) addOsmTiles(map);
      return () => {};
    }
  }

  /** Point every place-name label at the chosen name. */
  private applyLabels(gl: GlMap): void {
    const layers = gl.getStyle()?.layers;
    if (!layers) return;
    const expr = labelExpression(this.localNames() ? 'local' : 'app', APP_LANGUAGE);
    for (const id of nameLabelLayers(layers)) gl.setLayoutProperty(id, 'text-field', expr);
  }
}

function addOsmTiles(map: L.Map): void {
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: OSM_ATTRIBUTION, maxZoom: 18 })
    .addTo(map);
}

function readLocalNames(): boolean {
  try { return localStorage.getItem(LABEL_MODE_KEY) === 'local'; } catch { return false; }
}

function supportsWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}
