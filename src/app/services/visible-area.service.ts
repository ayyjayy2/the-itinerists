import { Injectable, InjectionToken, OnDestroy, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/** The browser's visual viewport (null where there is none); a token so tests can stand in. */
export const VISUAL_VIEWPORT = new InjectionToken<VisualViewportLike | null>('VISUAL_VIEWPORT', {
  providedIn: 'root',
  factory: () => (typeof window !== 'undefined' ? window.visualViewport : null),
});

/** Whether this is the iPhone app; a token so tests can stand in. */
export const IS_NATIVE_APP = new InjectionToken<boolean>('IS_NATIVE_APP', {
  providedIn: 'root',
  factory: () => Capacitor.isNativePlatform(),
});

type VisualViewportLike = Pick<VisualViewport, 'height' | 'offsetTop' | 'addEventListener'>;

/**
 * The part of the screen a person can actually see (#470). On an iPhone the
 * keyboard covers the page without shrinking it, so a pop-up sized to the
 * whole screen keeps its bottom — and its save button — behind the keyboard.
 * This publishes the visible area as `--visible-height` and `--visible-top` on
 * <html>; pop-ups size themselves to it, falling back to the full screen.
 *
 * A pop-up that shrinks for the keyboard keeps its scroll position, so a field
 * tapped low in the form (Notes) ended up out of sight (#500). When the visible
 * area resizes, the pop-up scrolls just enough to show the focused field: the
 * pop-up only, never the page behind it, and not while the person scrolls.
 *
 * The iPhone app also scrolls the whole page — header and tab bar too — to
 * reveal a tapped field (measured: 331px for Notes), though the page itself
 * never scrolls. In the app the page is put straight back and the pop-up
 * scrolls instead; the mobile tests (mobile-tests/, #502) check it.
 */
@Injectable({ providedIn: 'root' })
export class VisibleAreaService implements OnDestroy {
  private viewport = inject(VISUAL_VIEWPORT);
  private native = inject(IS_NATIVE_APP);
  private stop = new AbortController();

  start(): void {
    const vv = this.viewport;
    if (!vv) return;
    const style = document.documentElement.style;
    const update = () => {
      style.setProperty('--visible-height', `${Math.round(vv.height)}px`);
      style.setProperty('--visible-top', `${Math.round(vv.offsetTop)}px`);
    };
    const listen = { signal: this.stop.signal };
    vv.addEventListener('resize', () => { update(); this.revealFocusedField(); }, listen);
    vv.addEventListener('scroll', update, listen);
    if (this.native) addEventListener('scroll', () => {
      if (!scrollX && !scrollY) return;
      scrollTo(0, 0);
      update();
      this.revealFocusedField();
    }, listen);
    update();
  }

  ngOnDestroy(): void {
    this.stop.abort();
  }

  private revealFocusedField(): void {
    const field = document.activeElement;
    const card = field instanceof HTMLElement ? field.closest<HTMLElement>('.modal-backdrop > *') : null;
    if (!field || !card) return;
    const c = card.getBoundingClientRect(), f = field.getBoundingClientRect();
    const margin = 16;
    if (f.bottom > c.bottom - margin) card.scrollTop += f.bottom - c.bottom + margin;
    else if (f.top < c.top + margin) card.scrollTop -= c.top + margin - f.top;
  }
}
