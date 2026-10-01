import { signal } from '@angular/core';

/**
 * Decides when a loading indicator should be on screen.
 *
 * Anything under ~300ms feels instant, so a spinner that appears for a fast
 * load only adds a flicker. Past that, people need a sign the app is working.
 * Once shown, an indicator stays up for a minimum time so it never blinks.
 *
 *   const dv = new DelayedVisibility();   // show after 300ms, keep ≥300ms
 *   dv.set(true);   // work started
 *   dv.set(false);  // work finished
 *   dv.visible()    // what to render
 */
export class DelayedVisibility {
  private readonly _visible = signal(false);
  readonly visible = this._visible.asReadonly();

  private busy = false;
  private minElapsed = false;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private minTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly showAfterMs = 300, private readonly minShowMs = 300) {}

  /** `immediate`: show at once, skipping the grace period (e.g. right after sign-in). */
  set(busy: boolean, immediate = false): void {
    if (busy === this.busy) return;
    this.busy = busy;

    if (busy) {
      if (this._visible() || this.showTimer) return;     // already up, or already counting
      if (immediate) { this.show(); return; }
      this.showTimer = setTimeout(() => this.show(), this.showAfterMs);
      return;
    }

    if (this.showTimer) {                                // finished before it was needed
      clearTimeout(this.showTimer); this.showTimer = null;
      return;
    }
    if (this._visible() && this.minElapsed) this.hide(); // otherwise minTimer hides it
  }

  destroy(): void {
    if (this.showTimer) clearTimeout(this.showTimer);
    if (this.minTimer)  clearTimeout(this.minTimer);
    this.showTimer = this.minTimer = null;
  }

  private show(): void {
    this.showTimer = null;
    this.minElapsed = false;
    this._visible.set(true);
    this.minTimer = setTimeout(() => {
      this.minTimer = null;
      this.minElapsed = true;
      if (!this.busy) this.hide();
    }, this.minShowMs);
  }

  private hide(): void {
    this._visible.set(false);
  }
}
