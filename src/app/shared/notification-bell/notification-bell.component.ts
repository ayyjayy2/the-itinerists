import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon.component';
import { UserService } from '../../services/user.service';
import { timeAgo } from '../../utils/activity';
import { forMeAcrossTrips, unseenAcrossTrips, TripEventInTrip } from '../../utils/trip-events';
import { TripEventsService } from '../../services/trip-events.service';
import { TripService } from '../../services/trip.service';

@Component({
  selector: 'app-notification-bell',
  imports: [RouterLink, IconComponent],
  template: `
    <div class="bell-wrap">
      <button class="bell-btn" type="button" (click)="toggle($event)" aria-label="Group updates">
        <app-icon name="bell" [size]="22" />
        @if (unseen() > 0) {
          <span class="bell-badge">{{ unseen() > 9 ? '9+' : unseen() }}</span>
        }
      </button>

      @if (open()) {
        <div class="bell-scrim" (click)="open.set(false)"></div>
        <div class="bell-dropdown" [style.top.px]="dropTop()">
          <div class="bell-head">{{ shown().length }} {{ shown().length === 1 ? 'update' : 'updates' }}</div>
          @for (e of shown(); track e.id) {
            <a class="bell-item bell-link" [routerLink]="e.path" [queryParams]="e.itemId ? { focus: e.itemId } : null" (click)="go(e)">
              @if (multiTrip()) { <span class="bell-trip" [class.other]="e.tripId !== activeTripId()">{{ e.tripName || 'Trip' }}</span> }
              <b>{{ e.actorName }}</b> {{ e.summary }} <span class="bell-ago">· {{ ago(e.timestamp) }}</span>
            </a>
          } @empty {
            <div class="bell-item bell-empty">No new updates</div>
          }
          <a class="bell-all" routerLink="/updates" (click)="open.set(false)">See all</a>
        </div>
      }
    </div>
  `,
  styles: [`
    .bell-wrap { position: relative; }
    .bell-btn { position: relative; background: none; border: none; cursor: pointer;
      padding: 6px; display: grid; place-items: center; color: inherit; }
    .bell-badge { position: absolute; top: 0; right: 0; background: var(--danger, #c0504d);
      color: #fff; border-radius: 999px; font-size: 0.62rem; font-weight: 700;
      min-width: 15px; height: 15px; padding: 0 3px; display: grid; place-items: center; }
    .bell-scrim { position: fixed; inset: 0; z-index: 90; }
    /* Fixed to the viewport, not the bell: on narrow phones the bell can sit
       mid-header (wide user chip), and a right-anchored 320px panel would hang
       off the left screen edge. Top is set from the button's rect on open. */
    .bell-dropdown { position: fixed; right: 10px; z-index: 91;
      width: min(320px, 86vw); background: var(--surface, #fff);
      border: 1px solid var(--border, #eee); border-radius: 14px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.12); padding: 0.4rem 0; }
    .bell-head { padding: 0.5rem 0.9rem; font-weight: 700; font-size: 0.85rem;
      border-bottom: 1px solid var(--border, #eee); }
    .bell-item { padding: 0.5rem 0.9rem; font-size: 0.85rem; line-height: 1.4; }
    .bell-link { display: block; color: inherit; text-decoration: none; }
    .bell-link:hover { background: var(--surface-2, #f3f3f3); }
    .bell-ago { color: var(--muted, #8a8a8a); white-space: nowrap; }
    .bell-trip { display: block; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase;
      color: var(--muted, #8a8a8a); margin-bottom: 0.1rem; }
    .bell-trip.other { color: var(--primary, #4a9c6d); }
    .bell-empty { color: var(--muted, #8a8a8a); }
    .bell-all { display: block; padding: 0.55rem 0.9rem; font-size: 0.85rem; font-weight: 700;
      color: var(--primary, #4a9c6d); text-decoration: none;
      border-top: 1px solid var(--border, #eee); }
  `],
})
export class NotificationBellComponent {
  private eventsService = inject(TripEventsService);
  private userService   = inject(UserService);
  private tripService   = inject(TripService);

  readonly activeTripId = computed(() => this.tripService.activeTrip()?.id ?? '');

  open = signal(false);
  private now = signal(Date.now());

  private me      = computed(() => this.userService.firestoreUser());
  /** Events for me on any of my trips, newer than my high-water mark (own actions never count;
   *  each trip's own test rule applies). */
  private unseenList = computed(() => unseenAcrossTrips(
    this.eventsService.allEvents(), this.me()?.uid ?? '', this.me()?.lastSeenActivityAt ?? 0,
  ));
  readonly unseen = computed(() => this.unseenList().length);
  /** What the dropdown lists: the unseen ones, else the latest few for me. */
  readonly recent = computed<TripEventInTrip[]>(() => {
    const unseen = this.unseenList();
    if (unseen.length) return unseen.slice(0, 8);
    return forMeAcrossTrips(this.eventsService.allEvents(), this.me()?.uid ?? '').slice(0, 5);
  });
  /** Label entries with their trip once updates come from more than one trip. */
  readonly multiTrip = computed(() => new Set(this.shown().map(e => e.tripId)).size > 1
    || this.shown().some(e => e.tripId !== this.activeTripId()));

  /** Snapshot taken when the dropdown opens — opening marks everything seen
   *  (clears the badge), but the list stays readable. */
  readonly shown = signal<TripEventInTrip[]>([]);

  /** An update on another trip makes that trip active first, so the link opens the right item. */
  go(e: TripEventInTrip): void {
    this.open.set(false);
    if (e.tripId && e.tripId !== this.activeTripId()) void this.tripService.switchTrip(e.tripId);
  }

  ago = (ts: number) => timeAgo(ts, this.now());

  /** Viewport-fixed top for the dropdown, measured from the bell on open. */
  readonly dropTop = signal(64);

  toggle(ev?: Event): void {
    this.now.set(Date.now());
    if (!this.open()) {
      const btn = ev?.currentTarget as HTMLElement | undefined;
      if (btn) this.dropTop.set(btn.getBoundingClientRect().bottom + 6);
      this.shown.set(this.recent());
      if (this.unseen() > 0) void this.userService.markActivitySeen();
    }
    this.open.update(v => !v);
  }
}
