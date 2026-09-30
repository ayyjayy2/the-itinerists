import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon.component';
import { TripService } from '../../services/trip.service';
import { UserService } from '../../services/user.service';
import { timeAgo } from '../../utils/activity';
import { TripEventsService } from '../../services/trip-events.service';
import { AvatarGlyphComponent } from '../../shared/avatar-glyph/avatar-glyph.component';

@Component({
  selector: 'app-updates',
  imports: [IconComponent, AvatarGlyphComponent, RouterLink],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h2><app-icon name="bell" [size]="22" /> Latest from the group</h2>
      </div>

      <div class="card">
        @for (a of feed(); track a.event.id) {
          <a class="feed-row" [class.mine]="a.mine" [routerLink]="a.event.path" [queryParams]="a.event.itemId ? { focus: a.event.itemId } : null">
            <div class="avatar-sm" [style.background]="a.member?.color ?? 'var(--surface-2, #eee)'">
              <app-avatar-glyph [emoji]="a.member?.avatarEmoji ?? '👤'" [letterColor]="a.member?.avatarLetterColor" />
            </div>
            <span class="feed-text">
              <b>{{ a.mine ? 'You' : a.event.actorName }}</b> {{ a.event.summary }} <span class="feed-ago">· {{ ago(a.event.timestamp) }}</span>
            </span>
          </a>
        } @empty {
          <div class="feed-empty">No activity yet — invite friends and start planning.</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .feed-row { display: flex; align-items: center; gap: 0.7rem; padding: 0.55rem 0; color: inherit; text-decoration: none; }
    .feed-row.mine { opacity: 0.65; }
    .feed-ago { color: var(--muted, #8a8a8a); white-space: nowrap; }
    .feed-row + .feed-row { border-top: 1px solid var(--border, #eee); }
    .avatar-sm { width: 32px; height: 32px; border-radius: 50%; display: grid;
      place-items: center; font-size: 1rem; flex: none; }
    .feed-text { font-size: 0.92rem; line-height: 1.4; }
    .feed-empty { padding: 1rem 0; color: var(--muted, #8a8a8a); font-size: 0.92rem; }
  `],
})
export class UpdatesComponent implements OnInit, OnDestroy {
  private tripService   = inject(TripService);
  private userService   = inject(UserService);
  private eventsService = inject(TripEventsService);

  private now = signal(Date.now());
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Everything aimed at me plus my own actions (greyed), newest first. */
  readonly feed = computed(() => {
    const me    = this.userService.firestoreUser()?.uid ?? '';
    const byUid = new Map(this.tripService.activeMembers().map(m => [m.uid, m]));
    return this.eventsService.events()
      .filter(e => e.actorUid === me || e.audience === 'all' || e.audience.includes(me))
      .map(event => ({ event, member: byUid.get(event.actorUid), mine: event.actorUid === me }));
  });

  ago = (ts: number) => timeAgo(ts, this.now());

  ngOnInit(): void {
    void this.userService.markActivitySeen();
    this.timer = setInterval(() => this.now.set(Date.now()), 60_000);
  }
  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }
}
