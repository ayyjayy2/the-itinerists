import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon.component';
import { TripService } from '../../services/trip.service';
import { UserService } from '../../services/user.service';
import { activityText, timeAgo, unseenActivityCount } from '../../utils/activity';
import { ActivityLogEntry } from '../../models/trip.models';

@Component({
  selector: 'app-notification-bell',
  imports: [RouterLink, IconComponent],
  template: `
    <div class="bell-wrap">
      <button class="bell-btn" type="button" (click)="toggle()" aria-label="Group updates">
        <app-icon name="bell" [size]="22" />
        @if (unseen() > 0) {
          <span class="bell-badge">{{ unseen() > 9 ? '9+' : unseen() }}</span>
        }
      </button>

      @if (open()) {
        <div class="bell-scrim" (click)="open.set(false)"></div>
        <div class="bell-dropdown">
          <div class="bell-head">{{ shown().length }} {{ shown().length === 1 ? 'update' : 'updates' }}</div>
          @for (a of shown(); track a.id) {
            <div class="bell-item"><b>{{ a.performedByName }}</b> — {{ text(a) }} · {{ ago(a.timestamp) }}</div>
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
    .bell-dropdown { position: absolute; right: 0; top: calc(100% + 6px); z-index: 91;
      width: min(320px, 86vw); background: var(--surface, #fff);
      border: 1px solid var(--border, #eee); border-radius: 14px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.12); padding: 0.4rem 0; }
    .bell-head { padding: 0.5rem 0.9rem; font-weight: 700; font-size: 0.85rem;
      border-bottom: 1px solid var(--border, #eee); }
    .bell-item { padding: 0.5rem 0.9rem; font-size: 0.85rem; line-height: 1.4; }
    .bell-empty { color: var(--muted, #8a8a8a); }
    .bell-all { display: block; padding: 0.55rem 0.9rem; font-size: 0.85rem; font-weight: 700;
      color: var(--primary, #4a9c6d); text-decoration: none;
      border-top: 1px solid var(--border, #eee); }
  `],
})
export class NotificationBellComponent {
  private tripService = inject(TripService);
  private userService = inject(UserService);

  open = signal(false);
  private now = signal(Date.now());

  private me      = computed(() => this.userService.firestoreUser());
  readonly unseen = computed(() => unseenActivityCount(
    this.tripService.activeActivity(),
    this.me()?.uid ?? '',
    this.me()?.lastSeenActivityAt ?? 0,
  ));
  readonly recent = computed(() => {
    const uid = this.me()?.uid ?? '';
    const seen = this.me()?.lastSeenActivityAt ?? 0;
    return [...this.tripService.activeActivity()]
      .filter(e => e.performedByUid !== uid && e.timestamp > seen)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  });

  /** Snapshot of unseen entries taken when the dropdown opens — opening marks
   *  everything seen (clears the badge), but the list stays readable. */
  readonly shown = signal<ActivityLogEntry[]>([]);

  text = (a: ActivityLogEntry) => activityText(a);
  ago  = (ts: number) => timeAgo(ts, this.now());

  toggle(): void {
    this.now.set(Date.now());
    if (!this.open()) {
      this.shown.set(this.recent());
      if (this.unseen() > 0) void this.userService.markActivitySeen();
    }
    this.open.update(v => !v);
  }
}
