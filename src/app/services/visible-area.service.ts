import { Injectable, InjectionToken, inject } from '@angular/core';

/** The browser's visual viewport (null where there is none); a token so tests can stand in. */
export const VISUAL_VIEWPORT = new InjectionToken<VisualViewportLike | null>('VISUAL_VIEWPORT', {
  providedIn: 'root',
  factory: () => (typeof window !== 'undefined' ? window.visualViewport : null),
});

type VisualViewportLike = Pick<VisualViewport, 'height' | 'offsetTop' | 'addEventListener'>;

/**
 * The part of the screen a person can actually see (#470). On an iPhone the
 * keyboard covers the page without shrinking it, so a pop-up sized to the
 * whole screen keeps its bottom — and its save button — behind the keyboard.
 * This publishes the visible area as `--visible-height` and `--visible-top` on
 * <html>; pop-ups size themselves to it, falling back to the full screen.
 *
 * It also publishes how much of that area the header and the tab bar cover, as
 * `--chrome-top` and `--chrome-bottom` (#497), so pop-ups sit between them. With
 * the keyboard up the tab bar is behind it, so `--chrome-bottom` drops to 0.
 *
 * When the keyboard opens, a pop-up shrinks but keeps its scroll position, so a
 * field tapped low in the form would end up below the new bottom edge (#495).
 * On each resize the focused field inside a pop-up is scrolled back into view.
 */
@Injectable({ providedIn: 'root' })
export class VisibleAreaService {
  private viewport = inject(VISUAL_VIEWPORT);
  private header: Element | null = null;
  private tabBar: Element | null = null;
  private bars = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.update()) : null;

  start(): void {
    const vv = this.viewport;
    if (!vv) return;
    // Only on resize (the keyboard opening or closing), never on scroll, so a
    // person scrolling the form isn't pulled back to the field.
    vv.addEventListener('resize', () => { this.update(); this.revealFocusedField(); });
    vv.addEventListener('scroll', () => this.update());
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

  /** The new size applies at once (scrollIntoView lays out first), so no frame wait is needed. */
  private revealFocusedField(): void {
    const field = document.activeElement;
    if (field instanceof HTMLElement && field.closest('.modal-backdrop')) {
      field.scrollIntoView({ block: 'center' });
    }
  }
}
