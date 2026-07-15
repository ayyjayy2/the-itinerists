import { Injectable, signal, effect } from '@angular/core';

export interface AppTheme {
  id: string;
  label: string;
  group: 'Light' | 'Medium' | 'Dark';
  /** [ground, card, accent] preview swatch colours. */
  swatch: [string, string, string];
}

/** User-selectable themes (DP2-9). Deep Moss (5b) is kept in styles.scss as a
 *  backup but intentionally not listed here. */
export const THEMES: AppTheme[] = [
  { id: 'light',        label: 'Light',        group: 'Light',  swatch: ['#F8F4EF', '#FFFFFF', '#8BAF7C'] },
  { id: 'dusk-meadow',  label: 'Dusk Meadow',  group: 'Medium', swatch: ['#BFC6A9', '#EFE6D2', '#7E6FA8'] },
  { id: 'golden-hour',  label: 'Golden Hour',  group: 'Medium', swatch: ['#C4AFB6', '#F1E4C8', '#E8B4B8'] },
  { id: 'plum-dusk',    label: 'Plum Dusk',    group: 'Dark',   swatch: ['#221B20', '#2C242A', '#CDB4DE'] },
  { id: 'night-garden', label: 'Night Garden', group: 'Dark',   swatch: ['#1A1F17', '#2C2530', '#F0B7C6'] },
];

const THEME_IDS = new Set(THEMES.map(t => t.id));
const STORAGE_KEY = 'tripplanner_theme';

/**
 * App theme (DP2-9). The chosen theme id is written as `data-theme` on <html>;
 * `styles.scss` swaps the token values per theme. Persists to localStorage.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly themes = THEMES;
  readonly theme = signal<string>(readStored());

  constructor() {
    effect(() => this.apply(this.theme()));
  }

  set(id: string): void {
    if (!THEME_IDS.has(id)) return;
    this.theme.set(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* storage unavailable */ }
  }

  private apply(id: string): void {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', id);
  }
}

function readStored(): string {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && THEME_IDS.has(v) ? v : 'light';   // old 'dark'/'system' fall back to light
  } catch {
    return 'light';
  }
}
