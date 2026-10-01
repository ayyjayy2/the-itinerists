import { Injectable, inject, signal } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

/**
 * The `?focus=<id>` deep link that bell rows, Updates rows and (later) push
 * taps carry. Pages read `id()` to select the right day or tab; the
 * `appFocusTarget` directive scrolls the matching item into view.
 */
@Injectable({ providedIn: 'root' })
export class FocusService {
  private router = inject(Router);

  /** The item id asked for by the current URL, until a page consumes it. */
  readonly id = signal<string | null>(null);
  /** Set by a page when the focused item no longer exists ("That one was removed"). */
  readonly missing = signal(false);

  constructor() {
    this.readFromUrl(this.router.url);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(e => this.readFromUrl((e as NavigationEnd).urlAfterRedirects));
  }

  private readFromUrl(url: string): void {
    const focus = this.router.parseUrl(url).queryParams['focus'];
    this.id.set(typeof focus === 'string' && focus ? focus : null);
    this.missing.set(false);
  }

  /** Called once the target has been shown (or found missing). */
  clear(): void { this.id.set(null); }
  markMissing(): void { this.missing.set(true); this.id.set(null); }
}

/** The date of the focused itinerary item, so the page can select its day. */
export function focusDate(items: readonly { id: string; date: string }[], focusId: string | null): string | null {
  if (!focusId) return null;
  return items.find(i => i.id === focusId)?.date ?? null;
}
