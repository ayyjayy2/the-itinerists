import { Component, DestroyRef, effect, inject, input } from '@angular/core';
import { DelayedVisibility } from '../../utils/delayed-visibility';

/**
 * Thin progress bar along the top of the screen for app-wide waits: a page's
 * code being fetched, or the active trip being restored after sign-in. Same
 * timing as {@link LoadingComponent}: shows after 300ms, stays ≥300ms.
 */
@Component({
  selector: 'app-busy-bar',
  template: `
    @if (dv.visible()) {
      <div class="busy-bar" role="progressbar" aria-label="Loading"><div class="busy-bar-fill"></div></div>
    }
  `,
  styles: `
    .busy-bar {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: calc(3px + env(safe-area-inset-top, 0px));
      padding-top: env(safe-area-inset-top, 0px);
      background: transparent;
      z-index: 2000;
      pointer-events: none;
      overflow: hidden;
    }
    .busy-bar-fill {
      height: 3px;
      width: 40%;
      background: var(--primary);
      border-radius: 0 2px 2px 0;
      animation: busy-slide 1.1s ease-in-out infinite;
    }
    @keyframes busy-slide {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(250%); }
    }
  `,
})
export class BusyBarComponent {
  readonly active = input(false);

  protected readonly dv = new DelayedVisibility();

  constructor() {
    effect(() => this.dv.set(this.active()));
    inject(DestroyRef).onDestroy(() => this.dv.destroy());
  }
}
