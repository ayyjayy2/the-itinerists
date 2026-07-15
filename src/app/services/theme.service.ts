import { Injectable, signal, effect } from '@angular/core';

export type ThemePref = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'tripplanner_theme';

/**
 * Light / dark / system theme (DP2-4). The resolved theme is written as
 * `data-theme="light|dark"` on <html>; `styles.scss` swaps the token values.
 * The choice persists to localStorage and follows the OS when set to "system".
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  /**
   * Dark mode is fully built but DISABLED for now — its colour scheme needs
   * re-tuning. While false, the app is light-only and the Appearance toggle is
   * hidden. Flip to `true` (and re-tune the [data-theme="dark"] tokens) to bring
   * it back. (DP2-7)
   */
  readonly darkModeEnabled = false;

  readonly pref = signal<ThemePref>(readStored());

  private readonly media = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  constructor() {
    // Re-apply whenever the preference changes.
    effect(() => this.apply(this.pref()));
    // Follow the OS while on "system".
    this.media?.addEventListener('change', () => {
      if (this.pref() === 'system') this.apply('system');
    });
  }

  /** True when the currently-resolved theme is dark. */
  isDark(): boolean {
    if (!this.darkModeEnabled) return false;
    const p = this.pref();
    return p === 'dark' || (p === 'system' && !!this.media?.matches);
  }

  set(pref: ThemePref): void {
    this.pref.set(pref);
    try { localStorage.setItem(STORAGE_KEY, pref); } catch { /* storage unavailable */ }
  }

  private apply(pref: ThemePref): void {
    if (typeof document === 'undefined') return;
    const dark = this.darkModeEnabled
      && (pref === 'dark' || (pref === 'system' && !!this.media?.matches));
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
}

function readStored(): ThemePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}
