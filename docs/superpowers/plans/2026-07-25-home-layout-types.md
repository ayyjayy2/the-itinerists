# Home Layout Types (A/B) + Notification Bell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two switchable home/nav layouts — Type B (old-style quick-access grid, hamburger drawer, notification bell; the new default) and Type A (current design; opt-in via a Profile toggle visible only to Alayna).

**Architecture:** `users/{uid}.homeLayout` ('A'|'B', absent → B) drives both the home page body and the app shell chrome through pure `effectiveHomeLayout()`. Activity "seen" state is a single `lastSeenActivityAt` timestamp on the user doc. All changes additive — no migrations, no rewrites of existing docs (Makaela's account untouched).

**Tech Stack:** Angular 19 standalone + signals, @angular/fire, Jasmine/Karma (`npm run test:ci`).

**Spec:** `docs/superpowers/specs/2026-07-25-home-layout-types-design.md`

**Conventions:** run tests with `npm run test:ci` (currently 49 specs green); one feature branch, commit per task, messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Model fields + layout util

**Files:**
- Modify: `src/app/models/trip.models.ts` (FirestoreUser)
- Create: `src/app/utils/layout.ts`
- Test: `src/app/utils/layout.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/utils/layout.spec.ts
import { effectiveHomeLayout } from './layout';
import { FirestoreUser } from '../models/trip.models';

const base: FirestoreUser = {
  uid: 'u1', displayName: 'A', username: 'a', avatarEmoji: '🌸',
  color: '#fff', isAdmin: false, createdAt: 0,
};

describe('effectiveHomeLayout', () => {
  it('defaults to B with no user', () => {
    expect(effectiveHomeLayout(null)).toBe('B');
  });

  it('defaults to B when the user has no homeLayout', () => {
    expect(effectiveHomeLayout(base)).toBe('B');
  });

  it('honors an explicit choice', () => {
    expect(effectiveHomeLayout({ ...base, homeLayout: 'A' })).toBe('A');
    expect(effectiveHomeLayout({ ...base, homeLayout: 'B' })).toBe('B');
  });
});
```

- [ ] **Step 2: Run `npm run test:ci`** — Expected: FAIL, "Cannot find module './layout'".

- [ ] **Step 3: Implement**

```ts
// src/app/utils/layout.ts
import { FirestoreUser } from '../models/trip.models';

export type HomeLayout = 'A' | 'B';

/** Group default is B (user testing); A is an explicit per-account override. */
export function effectiveHomeLayout(user: FirestoreUser | null): HomeLayout {
  return user?.homeLayout ?? 'B';
}
```

In `src/app/models/trip.models.ts`, extend `FirestoreUser` (after `homePins`):

```ts
  /** Home/nav layout. Absent → 'B' (group default); 'A' is the legacy-current design. */
  homeLayout?: 'A' | 'B';
  /** High-water mark for the notification bell (unix ms). Absent → 0. */
  lastSeenActivityAt?: number;
```

- [ ] **Step 4: Run `npm run test:ci`** — Expected: `TOTAL: 52 SUCCESS`.

- [ ] **Step 5: Commit** — `feat(layout): homeLayout/lastSeenActivityAt fields + effectiveHomeLayout`

---

### Task 2: Shared activity utils + unseen count

**Files:**
- Create: `src/app/utils/activity.ts`
- Test: `src/app/utils/activity.spec.ts`
- Modify: `src/app/pages/home/home.component.ts:305-320` (delegate to the util)

- [ ] **Step 1: Write the failing test**

```ts
// src/app/utils/activity.spec.ts
import { activityText, timeAgo, unseenActivityCount } from './activity';
import { ActivityLogEntry } from '../models/trip.models';

function entry(over: Partial<ActivityLogEntry>): ActivityLogEntry {
  return {
    id: 'e1', action: 'member_added', targetUid: 't', targetName: 'Tess',
    performedByUid: 'p', performedByName: 'Pat', timestamp: 1000, ...over,
  };
}

describe('activityText', () => {
  it('describes a join', () => {
    expect(activityText(entry({}))).toBe('Tess joined the trip');
  });
});

describe('timeAgo', () => {
  it('formats minutes/hours/days against a supplied now', () => {
    const now = 1_000_000_000;
    expect(timeAgo(now - 5 * 60_000, now)).toBe('5m ago');
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(timeAgo(now - 2 * 86_400_000, now)).toBe('2d ago');
  });
});

describe('unseenActivityCount', () => {
  const entries = [
    entry({ id: 'a', performedByUid: 'me',    timestamp: 300 }),
    entry({ id: 'b', performedByUid: 'other', timestamp: 200 }),
    entry({ id: 'c', performedByUid: 'other', timestamp: 100 }),
  ];

  it('counts only others’ entries newer than lastSeenAt', () => {
    expect(unseenActivityCount(entries, 'me', 150)).toBe(1);  // only b
  });

  it('treats absent lastSeenAt (0) as everything-by-others unseen', () => {
    expect(unseenActivityCount(entries, 'me', 0)).toBe(2);    // b and c
  });
});
```

- [ ] **Step 2: Run `npm run test:ci`** — Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// src/app/utils/activity.ts
import { ActivityLogEntry } from '../models/trip.models';

/** Human line for a feed entry ("Tess joined the trip"). */
export function activityText(a: ActivityLogEntry): string {
  switch (a.action) {
    case 'member_added':    return `${a.targetName} joined the trip`;
    case 'member_removed':  return `${a.performedByName} removed ${a.targetName}`;
    case 'member_left':     return `${a.targetName} left the trip`;
    case 'member_restored': return `${a.performedByName} added ${a.targetName} back`;
    default:                return 'updated the trip';
  }
}

/** "5m ago" / "3h ago" / "2d ago" relative to a supplied now (unix ms). */
export function timeAgo(ts: number, now: number): string {
  const s = Math.floor((now - ts) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Bell badge: entries by OTHER members newer than the account's high-water mark. */
export function unseenActivityCount(
  entries: readonly ActivityLogEntry[], myUid: string, lastSeenAt: number,
): number {
  return entries.filter(e => e.performedByUid !== myUid && e.timestamp > lastSeenAt).length;
}
```

- [ ] **Step 4: Delegate in `home.component.ts`.** Add import
`import { activityText as activityLine, timeAgo as agoOf } from '../../utils/activity';`
and replace the bodies of the two methods (keep the method names — the template uses them):

```ts
  activityText(a: ActivityLogEntry): string { return activityLine(a); }

  timeAgo(ts: number): string { return agoOf(ts, this.now()); }
```

(Delete the old switch/format bodies.)

- [ ] **Step 5: Run `npm run test:ci`** — Expected: `TOTAL: 56 SUCCESS`.

- [ ] **Step 6: Commit** — `refactor(activity): shared activity text/timeAgo + unseen count util`

---

### Task 3: UserService write methods

**Files:**
- Modify: `src/app/services/user.service.ts` (below `updateHomePins`)

- [ ] **Step 1: Add methods**

```ts
  /** Persist the home/nav layout choice on the account. */
  async updateHomeLayout(layout: 'A' | 'B'): Promise<void> {
    const uid = this._firestoreUser()?.uid;
    if (!uid) return;
    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, 'users', uid), { homeLayout: layout }));
  }

  /** Stamp the bell's high-water mark — clears the badge on every device. */
  async markActivitySeen(): Promise<void> {
    const uid = this._firestoreUser()?.uid;
    if (!uid) return;
    await runInInjectionContext(this.injector, () =>
      updateDoc(doc(this.firestore, 'users', uid), { lastSeenActivityAt: Date.now() }));
  }
```

- [ ] **Step 2: Verify** — `npm run test:ci` all pass, `npx ng build` succeeds.

- [ ] **Step 3: Commit** — `feat(user): updateHomeLayout + markActivitySeen`

---

### Task 4: bell + menu icons

**Files:**
- Modify: `src/app/shared/icon/icon.component.ts` (the path map, after `trash:`)

- [ ] **Step 1: Add two entries** (same single-path stroke format as the rest):

```ts
  bell:      'M12 4a5 5 0 0 1 5 5v3.5l1.6 2.7a.5.5 0 0 1-.4.8H5.8a.5.5 0 0 1-.4-.8L7 12.5V9a5 5 0 0 1 5-5zM10 19a2 2 0 0 0 4 0',
  menu:      'M4 6.5h16M4 12h16M4 17.5h16',
```

- [ ] **Step 2: Verify** — `npx ng build` succeeds (bad SVG paths don't break builds, so also eyeball both icons in Step 4 of Task 6/8 live checks).

- [ ] **Step 3: Commit** — `feat(icons): bell + menu glyphs`

---

### Task 5: /updates page + route

**Files:**
- Create: `src/app/pages/updates/updates.component.ts`
- Test: `src/app/pages/updates/updates.component.spec.ts`
- Modify: `src/app/app.routes.ts` (auth-guarded route after `home`)

- [ ] **Step 1: Write the failing test**

```ts
// src/app/pages/updates/updates.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { UpdatesComponent } from './updates.component';
import { TripService } from '../../services/trip.service';
import { UserService } from '../../services/user.service';
import { ActivityLogEntry } from '../../models/trip.models';

const entries: ActivityLogEntry[] = [
  { id: 'e1', action: 'member_added', targetUid: 't1', targetName: 'Tess',
    performedByUid: 'p1', performedByName: 'Pat', timestamp: 2000 },
  { id: 'e2', action: 'member_left', targetUid: 't2', targetName: 'Lou',
    performedByUid: 'p2', performedByName: 'Lou', timestamp: 1000 },
];

describe('UpdatesComponent', () => {
  let userStub: { firestoreUser: any; markActivitySeen: jasmine.Spy };

  beforeEach(() => {
    userStub = { firestoreUser: signal({ uid: 'me' }), markActivitySeen: jasmine.createSpy() };
    TestBed.configureTestingModule({
      imports: [UpdatesComponent],
      providers: [
        provideRouter([]),
        { provide: TripService, useValue: { activeActivity: signal(entries), activeMembers: signal([]) } },
        { provide: UserService, useValue: userStub },
      ],
    });
  });

  it('lists entries newest-first and marks activity seen on init', () => {
    const fixture = TestBed.createComponent(UpdatesComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text.indexOf('Tess joined the trip')).toBeLessThan(text.indexOf('Lou left the trip'));
    expect(userStub.markActivitySeen).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run `npm run test:ci`** — Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// src/app/pages/updates/updates.component.ts
import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { IconComponent } from '../../shared/icon/icon.component';
import { TripService } from '../../services/trip.service';
import { UserService } from '../../services/user.service';
import { ActivityLogEntry } from '../../models/trip.models';
import { activityText, timeAgo } from '../../utils/activity';

@Component({
  selector: 'app-updates',
  imports: [IconComponent],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h2><app-icon name="bell" [size]="22" /> Latest from the group</h2>
      </div>

      <div class="card">
        @for (a of feed(); track a.entry.id) {
          <div class="feed-row">
            <div class="avatar-sm" [style.background]="a.member?.color ?? 'var(--surface-2, #eee)'">
              {{ a.member?.avatarEmoji ?? '👤' }}
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
```

- [ ] **Step 4: Route.** In `src/app/app.routes.ts`, directly after the `home` entry (guarded, same shape as its neighbors):

```ts
  {
    path: 'updates',
    loadComponent: () => import('./pages/updates/updates.component').then(m => m.UpdatesComponent),
    canActivate: [authGuard]
  },
```

- [ ] **Step 5: Run `npm run test:ci`** — Expected: `TOTAL: 57 SUCCESS`.

- [ ] **Step 6: Commit** — `feat(updates): group activity page that clears the bell`

---

### Task 6: Notification bell component

**Files:**
- Create: `src/app/shared/notification-bell/notification-bell.component.ts`
- Test: `src/app/shared/notification-bell/notification-bell.component.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/shared/notification-bell/notification-bell.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { NotificationBellComponent } from './notification-bell.component';
import { TripService } from '../../services/trip.service';
import { UserService } from '../../services/user.service';
import { ActivityLogEntry } from '../../models/trip.models';

const entries: ActivityLogEntry[] = [
  { id: 'e1', action: 'member_added', targetUid: 't', targetName: 'Tess',
    performedByUid: 'other', performedByName: 'Pat', timestamp: 2000 },
  { id: 'e2', action: 'member_added', targetUid: 't', targetName: 'Ann',
    performedByUid: 'me', performedByName: 'Me', timestamp: 3000 },
];

describe('NotificationBellComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        provideRouter([]),
        { provide: TripService, useValue: { activeActivity: signal(entries) } },
        { provide: UserService, useValue: { firestoreUser: signal({ uid: 'me', lastSeenActivityAt: 1000 }) } },
      ],
    });
  });

  it('badges only others’ unseen entries and lists them in the dropdown', () => {
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.bell-badge')?.textContent?.trim()).toBe('1');
    (el.querySelector('.bell-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.bell-head')?.textContent).toContain('1 update');
    expect(el.textContent).toContain('Tess joined the trip');
  });
});
```

- [ ] **Step 2: Run `npm run test:ci`** — Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// src/app/shared/notification-bell/notification-bell.component.ts
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
          <div class="bell-head">{{ unseen() }} {{ unseen() === 1 ? 'update' : 'updates' }}</div>
          @for (a of recent(); track a.id) {
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

  private me       = computed(() => this.userService.firestoreUser());
  readonly unseen  = computed(() => unseenActivityCount(
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

  text = (a: ActivityLogEntry) => activityText(a);
  ago  = (ts: number) => timeAgo(ts, this.now());
  toggle(): void { this.now.set(Date.now()); this.open.update(v => !v); }
}
```

- [ ] **Step 4: Run `npm run test:ci`** — Expected: `TOTAL: 58 SUCCESS`.

- [ ] **Step 5: Commit** — `feat(bell): notification bell with unseen badge + dropdown`

---

### Task 7: Home page Type B body

**Files:**
- Modify: `src/app/pages/home/home.component.ts` (layout signal + card list)
- Modify: `src/app/pages/home/home.component.html:98-207` (gate A sections, add B grid)
- Modify: `src/app/pages/home/home.component.scss` (resurrected link-card styles)

- [ ] **Step 1: Component logic.** In `home.component.ts` add imports
`import { effectiveHomeLayout } from '../../utils/layout';` and add near the pins block:

```ts
  readonly isLayoutA = computed(() => effectiveHomeLayout(this.userService.firestoreUser()) === 'A');

  /** Type B "Quick Access" — every page, old-layout style. */
  readonly quickAccess = [
    { path: '/itinerary',      label: 'Itinerary',      icon: 'itinerary', desc: 'Day-by-day plans',            accent: '#F9E4B7' },
    { path: '/flights',        label: 'Flights',        icon: 'flights',   desc: 'Arrivals & departures',       accent: '#B5D5F5' },
    { path: '/accommodations', label: 'Stays',          icon: 'stays',     desc: 'Hotels & check-in',           accent: '#D4B5F5' },
    { path: '/transportation', label: 'Transportation', icon: 'car',       desc: 'Rental car & getting around', accent: '#F5D4B5' },
    { path: '/finance',        label: 'Finance',        icon: 'finance',   desc: 'Shared expenses',             accent: '#88C9A1' },
    { path: '/expenses',       label: 'My Expenses',    icon: 'expenses',  desc: 'Your private spending',       accent: '#F4C2C2' },
    { path: '/recs',           label: 'Recs',           icon: 'recs',      desc: 'Tips & spots',                accent: '#F5B5D4' },
    { path: '/packing',        label: 'Packing',        icon: 'packing',   desc: 'Your packing list',           accent: '#B5F5D4' },
    { path: '/outfits',        label: 'Outfits',        icon: 'outfits',   desc: 'Plan your looks',             accent: '#F5B5D4' },
    { path: '/map',            label: 'Map',            icon: 'map',       desc: 'Trip map',                    accent: '#B5D5F5' },
    { path: '/profile',        label: 'Profile',        icon: 'profile',   desc: 'Settings & account',          accent: '#F9E4B7' },
  ];
```

- [ ] **Step 2: Template.** In `home.component.html`, insert `@if (isLayoutA()) {` on the
line before `<!-- Pinned quick-shortcuts -->` (line 98), and after the END of the
"Latest from the group" section (its closing `</div>`, just before the file-final
`</div>` at line 208) close the branch and add the B body:

```html
    } @else {
      <!-- Type B: Quick Access to everything (old layout, by popular demand) -->
      <h2 class="qa-heading">Quick Access</h2>
      <div class="links-grid">
        @for (link of quickAccess; track link.path) {
          <a class="link-card" [routerLink]="link.path" [style.--card-accent]="link.accent">
            <span class="link-icon"><app-icon [name]="link.icon" [size]="24" /></span>
            <span class="link-label">{{ link.label }}</span>
            <span class="link-desc">{{ link.desc }}</span>
          </a>
        }
      </div>
    }
```

(The Pinned, At a glance, and Latest sections all sit inside the `@if` branch;
the hero/switcher/destination sections above line 98 stay outside — shared.)

- [ ] **Step 3: Styles.** Append to `home.component.scss` (resurrected from
`git show 6bf6cc2:src/app/pages/home/home.component.scss`, trimmed):

```scss
// ── Type B: Quick Access grid (old layout) ──
.qa-heading { margin: 1.4rem 0 0.8rem; }

.links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.85rem;
}

.link-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
  padding: 1.1rem;
  background: var(--surface);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  text-decoration: none;
  transition: all 0.18s;
  box-shadow: var(--shadow);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 4px;
    background: var(--card-accent);
  }

  &:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg, var(--shadow)); }

  .link-icon  { color: var(--primary-dark, #3f7d58); }
  .link-label { font-weight: 800; color: var(--text); }
  .link-desc  { font-size: 0.8rem; color: var(--muted, #8a8a8a); }
}
```

- [ ] **Step 4: Verify** — `npm run test:ci` all pass; `npx ng build` succeeds. Live: with
no `homeLayout` set you now see Quick Access (B); the A sections are gone from home.

- [ ] **Step 5: Commit** — `feat(home): Type B quick-access body, Type A sections gated`

---

### Task 8: App shell Type B (top bar + drawer)

**Files:**
- Modify: `src/app/app.component.ts` (layout computed, drawer state)
- Modify: `src/app/app.component.html` (gate sidebar/tab-bar/more, add hamburger + bell + drawer)
- Modify: `src/app/app.component.scss` (drawer + menu-btn styles)

- [ ] **Step 1: Component logic.** In `app.component.ts` add imports:
`import { effectiveHomeLayout } from './utils/layout';` and
`import { NotificationBellComponent } from './shared/notification-bell/notification-bell.component';`
(add `NotificationBellComponent` to the `imports` array of the `@Component`). Add fields:

```ts
  readonly isLayoutB = computed(() => effectiveHomeLayout(this.userService.firestoreUser()) === 'B');
  drawerOpen = signal(false);
  toggleDrawer(): void { this.drawerOpen.update(v => !v); }
  closeDrawer(): void  { this.drawerOpen.set(false); }
  /** Drawer list: everything except Profile (footer chip covers it). */
  readonly drawerItems = computed(() => this.navItems().filter(i => i.path !== '/profile'));
```

In the constructor's existing `NavigationEnd` subscription, add `this.closeDrawer();`
next to `this.closeMore();`.

- [ ] **Step 2: Template.** In `app.component.html`:

a. Wrap the desktop sidebar: change `<nav class="sidebar" ...>` block (lines 8-47) to
sit inside `@if (!isLayoutB()) { ... }`.

b. Wrap the bottom tab bar AND the More sheet (lines 72-104, both blocks) in one
`@if (!isLayoutB()) { ... }`.

c. In the header, before `<a class="header-title" ...>`:

```html
        @if (isLayoutB()) {
          <button class="menu-btn" type="button" (click)="toggleDrawer()" aria-label="Menu">
            <app-icon name="menu" [size]="24" />
          </button>
        }
```

d. In `<div class="header-right">`, before the refresh button:

```html
          @if (isLayoutB()) {
            <app-notification-bell />
          }
```

e. After the header's closing `</header>` (still inside `.main-area` is fine — the
drawer is position:fixed), add the drawer:

```html
      @if (isLayoutB() && drawerOpen()) {
        <div class="drawer-scrim" (click)="closeDrawer()"></div>
        <aside class="drawer">
          <div class="drawer-head">
            <app-brand [mark]="28" />
            <span class="drawer-trip">{{ tripService.activeTrip()?.name ?? 'The Itinerists' }}</span>
          </div>
          <div class="drawer-nav">
            @for (item of drawerItems(); track item.path) {
              <a class="drawer-item" [routerLink]="item.path" routerLinkActive="active" (click)="closeDrawer()">
                <span class="drawer-icon"><app-icon [name]="item.icon" [size]="22" /></span>
                <span class="drawer-label">{{ item.label }}</span>
              </a>
            }
          </div>
          <div class="drawer-foot">
            <button class="drawer-refresh" (click)="hardRefresh()">↻ Refresh</button>
            <div class="drawer-version">🌿 Layn's Leaf {{ version }} · {{ buildDate }}</div>
            @if (currentUser()) {
              <div class="drawer-user">
                <div class="avatar" [style.background]="currentUser()!.color">{{ currentUser()!.avatarEmoji }}</div>
                <div class="user-info">
                  <a class="user-name" routerLink="/profile" (click)="closeDrawer()">{{ currentUser()!.name }}</a>
                  <span class="user-switch" (click)="logout()">Log out</span>
                </div>
              </div>
            }
          </div>
        </aside>
      }
```

- [ ] **Step 3: Styles.** Append to `app.component.scss`:

```scss
// ── Type B chrome: hamburger + slide-out drawer ──
.menu-btn {
  background: none; border: none; cursor: pointer; padding: 6px;
  display: grid; place-items: center; color: var(--text);
  margin-right: 0.35rem;
}

.drawer-scrim {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0, 0, 0, 0.35);
}

.drawer {
  position: fixed; top: 0; left: 0; bottom: 0; z-index: 201;
  width: min(300px, 84vw);
  background: var(--surface, #fff);
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.18);
  display: flex; flex-direction: column;
  padding: 1rem 0.8rem calc(0.8rem + env(safe-area-inset-bottom));
  animation: drawer-in 0.18s ease-out;
}
@keyframes drawer-in { from { transform: translateX(-100%); } to { transform: translateX(0); } }

.drawer-head {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.4rem 0.6rem 0.9rem;
  border-bottom: 1px solid var(--border, #eee);
  .drawer-trip { font-weight: 800; font-size: 1.05rem; }
}

.drawer-nav {
  flex: 1; overflow-y: auto; padding: 0.6rem 0;
  display: flex; flex-direction: column; gap: 2px;
}

.drawer-item {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.62rem 0.8rem; border-radius: 12px;
  text-decoration: none; color: var(--text);
  .drawer-label { font-weight: 600; }
  &.active { background: var(--primary-soft, #eaf3ec); color: var(--primary-dark, #3f7d58); }
}

.drawer-foot {
  border-top: 1px solid var(--border, #eee); padding-top: 0.7rem;
  display: flex; flex-direction: column; gap: 0.55rem;

  .drawer-refresh { background: none; border: none; cursor: pointer; text-align: left;
    padding: 0.3rem 0.8rem; font-size: 0.9rem; color: var(--text); }
  .drawer-version { padding: 0 0.8rem; font-size: 0.72rem; color: var(--muted, #8a8a8a); }
  .drawer-user { display: flex; align-items: center; gap: 0.6rem; padding: 0.3rem 0.8rem;
    .user-name { font-weight: 700; text-decoration: none; color: var(--text); display: block; }
    .user-switch { font-size: 0.8rem; color: var(--muted, #8a8a8a); cursor: pointer; } }
}
```

Also: the mobile stylesheet likely pads `.page-content` for the tab bar
(search `tab-bar` / `padding-bottom` in `app.component.scss`); if so, scope that
padding under a `:not` or duplicate-check visually in Step 4 — in Type B there is
no tab bar, so any reserved bottom padding shows as dead space. Fix by gating the
padding with a `.no-tabbar` class on `.app-shell`:
in the template `<div class="app-shell" [class.no-tabbar]="isLayoutB()">`, and in
scss `.app-shell.no-tabbar .page-content { padding-bottom: 1rem; }` (match the
non-mobile value used elsewhere in the file).

- [ ] **Step 4: Verify** — `npm run test:ci` all pass; `npx ng build` succeeds. Live
(default = B): no sidebar/tab bar; hamburger opens drawer, drawer navigates and
closes; bell shows in header; icons render correctly.

- [ ] **Step 5: Commit** — `feat(shell): Type B hamburger drawer + bell, gate A chrome`

---

### Task 9: Profile layout toggle (Alayna only)

**Files:**
- Modify: `src/app/pages/profile/profile.component.ts`
- Modify: `src/app/pages/profile/profile.component.html` (new card after "Account")

- [ ] **Step 1: Component logic.** Add import
`import { effectiveHomeLayout, HomeLayout } from '../../utils/layout';` and fields:

```ts
  readonly homeLayout = computed(() => effectiveHomeLayout(this.firestoreUser()));
  readonly canPickLayout = computed(() => this.firestoreUser()?.username === 'alayna');

  setLayout(layout: HomeLayout): void {
    void this.userService.updateHomeLayout(layout);
  }
```

(`computed` is already imported in this file; verify.)

- [ ] **Step 2: Markup.** In `profile.component.html`, after the "Account actions" card
(`</div>` at line ~73), add:

```html
    <!-- Home layout (Alayna-only experiment toggle) -->
    @if (canPickLayout()) {
      <div class="card section-card">
        <h2>Home Layout</h2>
        <div class="input-hint">Type B is the default for everyone; this override is yours alone.</div>
        <div class="layout-toggle">
          <button class="btn" [class.btn-primary]="homeLayout() === 'A'"
                  [class.btn-ghost]="homeLayout() !== 'A'" (click)="setLayout('A')">Type A</button>
          <button class="btn" [class.btn-primary]="homeLayout() === 'B'"
                  [class.btn-ghost]="homeLayout() !== 'B'" (click)="setLayout('B')">Type B</button>
        </div>
      </div>
    }
```

And in `profile.component.scss`:

```scss
.layout-toggle { display: flex; gap: 0.6rem; margin-top: 0.6rem; }
```

- [ ] **Step 3: Verify** — `npm run test:ci` all pass. Live: card visible on Alayna's
profile; picking Type A flips home + chrome immediately (signal-driven); Makaela's
profile (or any other account) shows no card.

- [ ] **Step 4: Commit** — `feat(profile): home layout toggle, visible to alayna only`

---

### Task 10: Full verification + ship

- [ ] **Step 1:** `npm run test:ci` → all pass (58 expected). `npx ng build` → clean.

- [ ] **Step 2: Live sweep (dev server, Alayna's account):**
  1. Default state (before toggling): home shows hero + Quick Access; hamburger
     drawer navigates; bell badges group activity; `/updates` lists the feed and
     clears the badge.
  2. Profile → Home Layout → Type A: home returns to Pinned/At a glance/Latest;
     sidebar/tab bar return; bell gone. Toggle back to B; then set A again (her
     stated preference) and leave it.
  3. Confirm no writes touched any other user's doc (only `users/<alayna-uid>`).

- [ ] **Step 3:** Push branch, `gh pr create`, squash-merge per repo convention.
