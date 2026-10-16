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
 * It also publishes how much of that area the header and the tab bar cover, as
 * `--chrome-top` and `--chrome-bottom` (#497), so pop-ups sit between them, 12px
 * clear of each like the eSIM pop-up. With the keyboard up the tab bar is behind
 * it, so `--chrome-bottom` drops to 0.
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
  private header: Element | null = null;
  private tabBar: Element | null = null;
  private bars = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.update()) : null;

  start(): void {
    const vv = this.viewport;
    if (!vv) return;
    const listen = { signal: this.stop.signal };
    vv.addEventListener('resize', () => { this.update(); this.revealFocusedField(); }, listen);
    vv.addEventListener('scroll', () => this.update(), listen);
    if (this.native) this.focusWithoutScrolling(listen);
    if (this.native) addEventListener('scroll', () => {
      if (!scrollX && !scrollY) return;
      scrollTo(0, 0);
      this.update();
      this.revealFocusedField();
    }, listen);
    this.update();
  }

  /** The app's header and tab bar, or null where the page has none (sign-in, the menu layout). */
  setChrome(header: Element | null, tabBar: Element | null): void {
    this.bars?.disconnect();
    this.header = header;
    this.tabBar = tabBar;
    for (const el of [header, tabBar]) if (el) this.bars?.observe(el);
    this.update();
  }

  private update(): void {
    const style = document.documentElement.style;
    const vv = this.viewport;
    const top = vv ? vv.offsetTop : 0;
    const bottom = top + (vv ? vv.height : innerHeight);
    if (vv) {
      style.setProperty('--visible-height', `${Math.round(vv.height)}px`);
      style.setProperty('--visible-top', `${Math.round(top)}px`);
    }
    const header = this.header?.getBoundingClientRect();
    const tabs = this.tabBar?.getBoundingClientRect();
    const covered = (px: number) => `${Math.round(Math.max(0, px))}px`;
    style.setProperty('--chrome-top', covered(header?.height ? header.bottom - top : 0));
    style.setProperty('--chrome-bottom', covered(tabs?.height ? bottom - tabs.top : 0));
  }

  /**
   * Tapping a field in a pop-up made the phone scroll the whole page toward it
   * before the reset above put it back: a visible jump on every tap (#507).
   * For a plain tap on a text field in a pop-up, the app focuses the field
   * itself without scrolling; the pop-up then scrolls to it. A drag that starts
   * on a field is left alone (it scrolls the form), as are pickers (dates,
   * times, lists), which the phone opens its own way.
   */
  private focusWithoutScrolling(listen: { signal: AbortSignal }): void {
    let start: { x: number; y: number } | null = null;
    document.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      start = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY } : null;
    }, { passive: true, ...listen });
    document.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      const tapped = start && t && Math.hypot(t.clientX - start.x, t.clientY - start.y) < 10;
      start = null;
      const field = (e.target as Element | null)?.closest?.('input, textarea');
      if (!tapped || !(field instanceof HTMLElement) || field === document.activeElement) return;
      if (!field.closest('.modal-backdrop') || !isTextField(field)) return;
      e.preventDefault();                                   // no tap → no scroll toward the field
      field.focus({ preventScroll: true });
    }, { passive: false, ...listen });
  }

  ngOnDestroy(): void {
    this.stop.abort();
    this.bars?.disconnect();
  }

  /**
   * Scrolls just enough to show the focused field above the keyboard: the
   * pop-up it's in, or, in the iPhone app, the page's own scroller (#513) —
   * the reset above takes back the phone's own scroll, so sign-in and other
   * page fields would otherwise stay behind the keyboard. The website's
   * browser reveals page fields itself.
   */
  private revealFocusedField(): void {
    const field = document.activeElement;
    if (!(field instanceof HTMLElement)) return;
    const card = field.closest<HTMLElement>('.modal-backdrop > *')
      ?? (this.native ? scrollerOf(field) : null);
    if (!card) return;
    const c = card.getBoundingClientRect(), f = field.getBoundingClientRect();
    const vv = this.viewport;
    const bottom = Math.min(c.bottom, vv ? vv.offsetTop + vv.height : innerHeight);
    const margin = 16;
    if (f.bottom > bottom - margin) card.scrollTop += f.bottom - bottom + margin;
    else if (f.top < c.top + margin) card.scrollTop -= c.top + margin - f.top;
  }
}

/** The nearest element that scrolls its own content, below the page itself. */
function scrollerOf(el: Element): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p;
  }
  return null;
}

/** Fields typed into with the keyboard (not pickers, boxes or buttons). */
const TEXT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'number', 'password']);
function isTextField(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
  return el instanceof HTMLInputElement && TEXT_TYPES.has(el.type) && !el.disabled && !el.readOnly;
}
