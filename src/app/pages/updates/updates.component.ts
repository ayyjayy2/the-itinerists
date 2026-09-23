import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { IconComponent } from '../../shared/icon/icon.component';
import { TripService } from '../../services/trip.service';
import { UserService } from '../../services/user.service';
import { ActivityLogEntry } from '../../models/trip.models';
import { activityText, timeAgo } from '../../utils/activity';
import { AvatarGlyphComponent } from '../../shared/avatar-glyph/avatar-glyph.component';

@Component({
  selector: 'app-updates',
  imports: [IconComponent, AvatarGlyphComponent],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h2><app-icon name="bell" [size]="22" /> Latest from the group</h2>
      </div>

      <div class="card">
        @for (a of feed(); track a.entry.id) {
          <div class="feed-row">
            <div class="avatar-sm" [style.background]="a.member?.color ?? 'var(--surface-2, #eee)'">
              <app-avatar-glyph [emoji]="a.member?.avatarEmoji ?? '👤'" [letterColor]="a.member?.avatarLetterColor" />
            </div>
            <span class="feed-text">
              <b>{{ a.entry.performedByName }}</b> — {{ text(a.entry) }} · {{ ago(a.entry.timestamp) }}
            </span>
          </div>
        } @empty {
          <div class="feed-empty">No activity yet — invite friends and start planning.</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .feed-row { display: flex; align-items: center; gap: 0.7rem; padding: 0.55rem 0; }
    .feed-row + .feed-row { border-top: 1px solid var(--border, #eee); }
    .avatar-sm { width: 32px; height: 32px; border-radius: 50%; display: grid;
      place-items: center; font-size: 1rem; flex: none; }
    .feed-text { font-size: 0.92rem; line-height: 1.4; }
    .feed-empty { padding: 1rem 0; color: var(--muted, #8a8a8a); font-size: 0.92rem; }
  `],
})
export class UpdatesComponent implements OnInit, OnDestroy {
  private tripService = inject(TripService);
  private userService = inject(UserService);

  private now = signal(Date.now());
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly feed = computed(() => {
    const byUid = new Map(this.tripService.activeMembers().map(m => [m.uid, m]));
    return [...this.tripService.activeActivity()]
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(entry => ({ entry, member: byUid.get(entry.performedByUid) }));
  });

  text = (a: ActivityLogEntry) => activityText(a);
  ago  = (ts: number) => timeAgo(ts, this.now());

  ngOnInit(): void {
    void this.userService.markActivitySeen();
    this.timer = setInterval(() => this.now.set(Date.now()), 60_000);
  }
  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }
}
