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
 */
@Injectable({ providedIn: 'root' })
export class VisibleAreaService {
  private viewport = inject(VISUAL_VIEWPORT);

  start(): void {
    const vv = this.viewport;
    if (!vv) return;
    const style = document.documentElement.style;
    const update = () => {
      style.setProperty('--visible-height', `${Math.round(vv.height)}px`);
      style.setProperty('--visible-top', `${Math.round(vv.offsetTop)}px`);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
  }
}
