import { Component, Input, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon.component';

type GhostKind = 'timeline' | 'rows' | 'checklist' | 'tiles' | 'cards' | 'map';

interface PageCopy {
  heading: string;
  sub: string;
  ghost: GhostKind;
}

/** Per-page headline + ghost-skeleton flavour for the no-trip empty state. */
const PAGE_COPY: Record<string, PageCopy> = {
  itinerary: {
    heading: 'This is where the plan goes',
    sub: 'Set up a trip and build your days together — everyone sees the same plan.',
    ghost: 'timeline',
  },
  finance: {
    heading: 'Split costs without the spreadsheet',
    sub: 'Track shared expenses on a trip and settle up at the end.',
    ghost: 'rows',
  },
  packing: {
    heading: 'Never forget the sunscreen',
    sub: 'Build your packing list for a trip and check things off as you go.',
    ghost: 'checklist',
  },
  flights: {
    heading: "Everyone's flights, side by side",
    sub: 'Keep arrivals and departures in one place once a trip is set up.',
    ghost: 'cards',
  },
  stays: {
    heading: "Where you're staying",
    sub: 'Save accommodations with check-in details for every stop of a trip.',
    ghost: 'cards',
  },
  map: {
    heading: 'See the trip on a map',
    sub: 'Pin places and watch the plan come together once a trip is set up.',
    ghost: 'map',
  },
  transportation: {
    heading: 'Getting around, sorted',
    sub: 'Cars, trains, buses, ferries — every leg of a trip tracked here.',
    ghost: 'cards',
  },
  expenses: {
    heading: 'Your own spending, private',
    sub: 'A personal expense log just for you, once a trip is under way.',
    ghost: 'rows',
  },
  recs: {
    heading: 'Ideas from the whole group',
    sub: 'Collect recommendations for food, drinks and things to do on a trip.',
    ghost: 'tiles',
  },
  outfits: {
    heading: 'Plan the looks',
    sub: 'Outfits for every day and occasion, planned before you pack.',
    ghost: 'tiles',
  },
};

const DEFAULT_COPY: PageCopy = {
  heading: 'This fills in with a trip',
  sub: 'Set up a trip to start using this page with your group.',
  ghost: 'cards',
};

/**
 * "Ghost preview" empty state for feature pages when the user has no trip yet
 * (Option C): faded sample content hints at what the page becomes, with a
 * floating card holding the set-up / join actions. Nav stays complete so new
 * users can explore the whole app — every page funnels into creating a trip.
 */
@Component({
  selector: 'app-no-trip-state',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="ghost-wrap">
      <div class="ghost" aria-hidden="true">
        @switch (copy().ghost) {
          @case ('timeline') {
            <div class="g-day">Day 1</div>
            <div class="g-card"><span class="g-chip sage">9:00</span><div class="g-lines"><div class="g-line w60"></div><div class="g-line w40"></div></div></div>
            <div class="g-card"><span class="g-chip lav">12:30</span><div class="g-lines"><div class="g-line w75"></div><div class="g-line w40"></div></div></div>
            <div class="g-day">Day 2</div>
            <div class="g-card"><span class="g-chip sage">10:00</span><div class="g-lines"><div class="g-line w60"></div><div class="g-line w40"></div></div></div>
            <div class="g-card"><span class="g-chip lav">15:00</span><div class="g-lines"><div class="g-line w75"></div><div class="g-line w40"></div></div></div>
            <div class="g-card"><span class="g-chip sage">19:30</span><div class="g-lines"><div class="g-line w60"></div><div class="g-line w40"></div></div></div>
          }
          @case ('rows') {
            @for (r of [60, 45, 70, 50, 65]; track $index) {
              <div class="g-card">
                <span class="g-dot"></span>
                <div class="g-lines"><div class="g-line" [style.width.%]="r"></div><div class="g-line w40"></div></div>
                <span class="g-chip sage">$ ··</span>
              </div>
            }
          }
          @case ('checklist') {
            @for (r of [55, 70, 45, 65, 50, 60]; track $index) {
              <div class="g-card slim">
                <span class="g-box" [class.checked]="$index === 0">
                  @if ($index === 0) { <app-icon name="check" [size]="12" [strokeWidth]="3" /> }
                </span>
                <div class="g-lines"><div class="g-line" [style.width.%]="r"></div></div>
              </div>
            }
          }
          @case ('tiles') {
            <div class="g-grid">
              @for (t of [1, 2, 3, 4]; track t) {
                <div class="g-tile"><div class="g-img"></div><div class="g-line w60"></div><div class="g-line w40"></div></div>
              }
            </div>
          }
          @case ('cards') {
            @for (r of [65, 50, 70]; track $index) {
              <div class="g-card tall">
                <span class="g-sq" [class.lav]="$index === 1"></span>
                <div class="g-lines"><div class="g-line" [style.width.%]="r"></div><div class="g-line w40"></div><div class="g-line w75"></div></div>
              </div>
            }
          }
          @case ('map') {
            <div class="g-map">
              <span class="g-pin" style="left: 22%; top: 28%"><app-icon name="pin" [size]="20" /></span>
              <span class="g-pin lav" style="left: 58%; top: 48%"><app-icon name="pin" [size]="20" /></span>
              <span class="g-pin" style="left: 40%; top: 68%"><app-icon name="pin" [size]="20" /></span>
            </div>
            <div class="g-card"><span class="g-dot"></span><div class="g-lines"><div class="g-line w60"></div><div class="g-line w40"></div></div></div>
          }
        }
      </div>
      <div class="ghost-fade"></div>

      <div class="ghost-cta">
        <h2 class="display">{{ copy().heading }}</h2>
        <p>{{ copy().sub }}</p>
        <a class="btn btn-primary cta-main" routerLink="/trips/new">
          Set up a trip <app-icon name="plus" [size]="15" [strokeWidth]="2.6" />
        </a>
        <div><a class="btn btn-ghost cta-join" routerLink="/join">I have an invite code</a></div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .ghost-wrap { position: relative; min-height: 440px; max-width: 560px; margin: 8px auto 0; }
    .ghost { display: flex; flex-direction: column; gap: 10px; opacity: .5; pointer-events: none; }

    .g-day {
      font-weight: 800; font-size: .78rem; letter-spacing: .07em; text-transform: uppercase;
      color: var(--text-muted); margin-top: 6px;
    }
    .g-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 13px 14px; display: flex; gap: 11px; align-items: center;
    }
    .g-card.slim { padding: 10px 14px; }
    .g-card.tall { padding: 16px 14px; }
    .g-chip {
      font-weight: 800; font-size: .78rem; border-radius: 8px; padding: 4px 8px; flex: none;
    }
    .g-chip.sage { color: var(--primary-dark); background: var(--primary-tint); }
    .g-chip.lav { color: var(--lavender-dark); background: var(--lavender-tint); }
    .g-dot { width: 30px; height: 30px; border-radius: 50%; background: var(--primary-tint); flex: none; }
    .g-sq { width: 40px; height: 40px; border-radius: 12px; background: var(--primary-tint); flex: none; }
    .g-sq.lav { background: var(--lavender-tint); }
    .g-box {
      width: 20px; height: 20px; border-radius: 6px; border: 2px solid var(--border); flex: none;
      display: grid; place-items: center; color: #fff;
    }
    .g-box.checked { background: var(--primary-dark); border-color: var(--primary-dark); }
    .g-lines { flex: 1; }
    .g-line { height: 9px; border-radius: 5px; background: var(--surface-2); margin: 4px 0; }
    .g-line.w40 { width: 40%; } .g-line.w60 { width: 60%; } .g-line.w75 { width: 75%; }
    .g-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .g-tile { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px; }
    .g-img { height: 84px; border-radius: 10px; background: var(--surface-2); margin-bottom: 8px; }
    .g-map {
      position: relative; height: 240px; border-radius: var(--radius-lg);
      background: var(--primary-tint); border: 1px solid var(--border);
    }
    .g-pin { position: absolute; color: var(--primary-dark); }
    .g-pin.lav { color: var(--lavender-dark); }

    .ghost-fade {
      position: absolute; inset: 0; pointer-events: none;
      background: linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--bg) 60%, transparent) 45%, var(--bg) 82%);
    }

    .ghost-cta {
      position: absolute; left: 8px; right: 8px; bottom: 0;
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
      padding: 22px 18px 16px; text-align: center;
      box-shadow: 0 10px 26px rgba(0, 0, 0, .12);
    }
    .ghost-cta h2 { font-size: 1.22rem; color: var(--text); margin: 0 0 5px; border: none; padding: 0; }
    .ghost-cta p { font-size: .88rem; color: var(--text-muted); margin: 0 0 14px; line-height: 1.4; }
    .cta-main { display: inline-flex; align-items: center; gap: 7px; }
    .cta-join { font-size: .85rem; margin-top: 2px; }
  `],
})
export class NoTripStateComponent {
  /** Which feature page this state sits on — picks headline + ghost flavour. */
  @Input() set page(value: string) { this.pageKey.set(value); }
  private readonly pageKey = signal('');
  readonly copy = computed(() => PAGE_COPY[this.pageKey()] ?? DEFAULT_COPY);
}
