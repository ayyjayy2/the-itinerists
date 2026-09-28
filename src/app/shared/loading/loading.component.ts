import { Component, DestroyRef, effect, inject, input } from '@angular/core';
import { DelayedVisibility } from '../../utils/delayed-visibility';

/**
 * Centered spinner for a page or section that is still loading.
 *
 * It appears only after the wait passes 300ms (fast loads never flicker)
 * and then stays for at least 300ms (it never blinks). Render it in place
 * of the content, not on top of it:
 *
 *   @if (loading()) { <app-loading label="Loading flights…" /> } @else { … }
 */
@Component({
  selector: 'app-loading',
  template: `
    @if (dv.visible()) {
      <div class="loading-overlay" role="status" aria-live="polite">
        <div class="spinner"></div>
        @if (label()) { <p>{{ label() }}</p> }
      </div>
    }
  `,
})
export class LoadingComponent {
  /** Set false once the content is ready (defaults to "still loading"). */
  readonly active = input(true);
  readonly label  = input('Loading…');

  protected readonly dv = new DelayedVisibility();

  constructor() {
    effect(() => this.dv.set(this.active()));
    inject(DestroyRef).onDestroy(() => this.dv.destroy());
  }
}
