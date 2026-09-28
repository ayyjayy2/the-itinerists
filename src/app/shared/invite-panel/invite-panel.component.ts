import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * Everything a trip owner needs to hand out one invite: the code (typed on
 * the sign-up form or under "I have an invite code"), the link that carries
 * the same code, copy buttons for each, and the phone's share sheet when the
 * browser offers one. Valid for 7 days, like the invite itself.
 * "Close invite" revokes it on the spot (the host handles the actual delete via
 * the `close` output) so a leaked code can be cut off and a fresh one made.
 */
@Component({
  selector: 'app-invite-panel',
  imports: [IconComponent],
  template: `
    <div class="invite-panel" role="group" aria-label="Invite">
      <div class="invite-row">
        <span class="invite-label">Code</span>
        <span class="invite-code">{{ code() }}</span>
        <button type="button" class="btn btn-accent btn-sm" (click)="copy('code')">
          {{ copied() === 'code' ? 'Copied!' : 'Copy code' }}
        </button>
      </div>
      <div class="invite-row">
        <span class="invite-label">Link</span>
        <span class="invite-url">{{ link() }}</span>
        <button type="button" class="btn btn-accent btn-sm" (click)="copy('link')">
          {{ copied() === 'link' ? 'Copied!' : 'Copy link' }}
        </button>
      </div>
      @if (canShare) {
        <button type="button" class="btn btn-ghost btn-sm invite-share" (click)="share()">
          <app-icon name="link" [size]="14" /> Share…
        </button>
      }
      <p class="invite-hint">Friends can tap the link, or type the code on the sign-up screen or under "I have an invite code". Good for 7 days.</p>
      <div class="invite-close">
        <button type="button" class="btn btn-ghost btn-sm btn-ghost-danger" (click)="close.emit(code())" [disabled]="closing()">
          {{ closing() ? 'Closing…' : 'Close invite' }}
        </button>
        <span class="invite-close-hint">Stops this code and link working. Generate a new one anytime.</span>
      </div>
    </div>
  `,
  styles: `
    .invite-panel {
      display: grid; gap: 0.5rem;
      background: var(--bg); border: 1.5px solid var(--border); border-radius: var(--radius-sm);
      padding: 0.7rem 0.9rem; margin-top: 0.75rem;
    }
    .invite-row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; min-width: 0; }
    .invite-label { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); width: 2.6rem; }
    .invite-code { font-family: monospace; font-size: 1.25rem; font-weight: 700; letter-spacing: 0.18em; color: var(--text); flex: 1; }
    .invite-url  { font-family: monospace; font-size: 0.8rem; color: var(--primary-dark); overflow-wrap: anywhere; flex: 1; min-width: 0; }
    .invite-share { justify-self: start; }
    .invite-hint { margin: 0.1rem 0 0; font-size: 0.8rem; color: var(--text-muted); }
    .invite-close { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-top: 0.2rem; padding-top: 0.6rem; border-top: 1px solid var(--border); }
    .invite-close-hint { font-size: 0.78rem; color: var(--text-muted); }
    .btn-ghost-danger { color: var(--danger); border-color: var(--danger); }
  `,
})
export class InvitePanelComponent {
  readonly code = input.required<string>();
  /** True while the host is revoking the invite. */
  readonly closing = input(false);
  /** Emits the code when the owner taps Close invite; the host revokes it. */
  readonly close = output<string>();
  readonly link = computed(() => `${window.location.origin}/join?code=${this.code()}`);
  readonly copied = signal<'code' | 'link' | null>(null);
  readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() { inject(DestroyRef).onDestroy(() => { if (this.timer) clearTimeout(this.timer); }); }

  async copy(what: 'code' | 'link'): Promise<void> {
    await navigator.clipboard.writeText(what === 'code' ? this.code() : this.link());
    this.copied.set(what);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.copied.set(null), 2000);
  }

  async share(): Promise<void> {
    try {
      await navigator.share({
        title: 'Join my trip on The Itinerists',
        text: `Join my trip on The Itinerists — invite code ${this.code()}`,
        url: this.link(),
      });
    } catch { /* the person closed the share sheet */ }
  }
}
