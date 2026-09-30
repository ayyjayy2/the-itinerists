import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { IconComponent } from '../icon/icon.component';
import { AnalyticsService } from '../../services/analytics.service';

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
  imports: [IconComponent, TitleCasePipe],
  template: `
    <div class="invite-panel" role="group" aria-label="Invite">
      <section class="invite-block">
        <span class="invite-label">Invite code</span>
        <div class="invite-code">{{ code() }}</div>
        <button type="button" class="btn btn-accent invite-action" (click)="copy('code')">
          {{ copied() === 'code' ? 'Copied!' : 'Copy code' }}
        </button>
      </section>

      <section class="invite-block">
        <span class="invite-label">Invite link</span>
        <div class="invite-url">{{ link() }}</div>
        <button type="button" class="btn btn-accent invite-action" (click)="copy('link')">
          {{ copied() === 'link' ? 'Copied!' : 'Copy link' }}
        </button>
      </section>

      @if (canShare) {
        <button type="button" class="btn btn-ghost invite-action invite-share" (click)="share()">
          <app-icon name="link" [size]="15" /> Share…
        </button>
      }

      <p class="invite-hint">Friends can tap the link, or type the code on the sign-up screen or under "I have an invite code". {{ expiresIn() ? (expiresIn() | titlecase) : 'Good for 7 days' }}. Generating a new invite closes this one.</p>

      <div class="invite-close">
        <button type="button" class="btn btn-ghost btn-ghost-danger invite-action" (click)="close.emit(code())" [disabled]="closing()">
          {{ closing() ? 'Closing…' : 'Close invite' }}
        </button>
        <span class="invite-close-hint">Stops this code and link working. Generate a new one anytime.</span>
      </div>
    </div>
  `,
  styles: `
    // Phone-first: every piece is its own block with a full-width action, so
    // nothing crowds anything else. From ~560px the blocks go side by side.
    .invite-panel {
      display: grid; gap: 0.85rem;
      background: var(--bg); border: 1.5px solid var(--border); border-radius: var(--radius);
      padding: 0.9rem; margin-top: 0.85rem;
    }
    .invite-block {
      display: grid; gap: 0.55rem; min-width: 0;
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 0.85rem 0.95rem;
    }
    .invite-label { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); }
    .invite-code  { font-family: monospace; font-size: 1.6rem; font-weight: 700; letter-spacing: 0.22em; color: var(--text); text-align: center; padding: 0.35rem 0; }
    .invite-url   { font-family: monospace; font-size: 0.8rem; line-height: 1.45; color: var(--primary-dark); overflow-wrap: anywhere; min-width: 0; }
    .invite-action { width: 100%; }
    .invite-share  { justify-self: stretch; }
    .invite-hint   { margin: 0; font-size: 0.82rem; line-height: 1.45; color: var(--text-muted); }
    .invite-close  { display: grid; gap: 0.5rem; padding-top: 0.85rem; border-top: 1px solid var(--border); }
    .invite-close-hint { font-size: 0.78rem; line-height: 1.4; color: var(--text-muted); }
    .btn-ghost-danger { color: var(--danger); border-color: var(--danger); }

    @media (min-width: 560px) {
      .invite-block { grid-template-columns: 1fr auto; align-items: center; column-gap: 1rem; }
      .invite-label { grid-column: 1 / -1; }
      .invite-code  { text-align: left; padding: 0; }
      .invite-action { width: auto; }
      .invite-share  { justify-self: start; }
      .invite-close  { grid-template-columns: auto 1fr; align-items: center; column-gap: 0.9rem; }
    }
  `,
})
export class InvitePanelComponent {
  readonly code = input.required<string>();
  /** Unix ms when the invite stops working; shown as "expires in N days". */
  readonly expiresAt = input<number | null>(null);
  /** True while the host is revoking the invite. */
  readonly closing = input(false);
  /** Emits the code when the owner taps Close invite; the host revokes it. */
  readonly close = output<string>();
  readonly link = computed(() => `${window.location.origin}/join?code=${this.code()}`);
  readonly expiresIn = computed(() => {
    const at = this.expiresAt();
    if (!at) return '';
    const days = Math.ceil((at - Date.now()) / 86_400_000);
    if (days <= 0) return 'expired';
    if (days === 1) return 'expires in 1 day';
    return `expires in ${days} days`;
  });
  readonly copied = signal<'code' | 'link' | null>(null);
  readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  private timer: ReturnType<typeof setTimeout> | null = null;

  private analytics = inject(AnalyticsService);

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
      this.analytics.event('invite_shared');
    } catch { /* the person closed the share sheet */ }
  }
}
