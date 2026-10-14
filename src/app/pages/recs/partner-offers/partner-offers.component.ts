import { Component, ElementRef, HostListener, computed, effect, inject, signal, viewChild } from '@angular/core';
import { PartnerOffer } from '../../../models/trip.models';
import { DEVICE_ZONE, PartnersService } from '../../../services/partners.service';
import { TripService } from '../../../services/trip.service';
import { UsageService } from '../../../services/usage.service';
import { countryList, countryName, foreignCountries } from '../../../utils/abroad';
import { ESIM_GOOD_TO_KNOW, ESIM_INTRO, ESIM_STEPS } from '../../../utils/esim-guide';
import { tripDestinations } from '../../../utils/trip-destinations';

type CardId = 'esim' | 'insurance';
interface OfferCard { id: CardId; icon: string; title: string; subline: string; partners: PartnerOffer[]; }

const HIDDEN_KEY = (tripId: string) => `itinerists_offers_hidden_${tripId}`;

/**
 * Partner offers for trips abroad, at the top of Tips & Recs (#474): a soft card
 * for eSIMs and one for travel insurance, each opening a pop-up. Shown only when
 * a stop is in another country from this phone; each card can be hidden per trip.
 */
@Component({
  selector: 'app-partner-offers',
  standalone: true,
  templateUrl: './partner-offers.component.html',
  styleUrl: './partner-offers.component.scss',
})
export class PartnerOffersComponent {
  private partners = inject(PartnersService);
  private trips    = inject(TripService);
  private usage    = inject(UsageService);
  private zone     = inject(DEVICE_ZONE);

  readonly guideIntro = ESIM_INTRO;
  readonly guideSteps = ESIM_STEPS;
  readonly guideNotes = ESIM_GOOD_TO_KNOW;

  private readonly tripId = computed(() => this.trips.activeTrip()?.id ?? null);
  private readonly hidden = signal<Set<CardId>>(new Set());
  readonly openCard = signal<CardId | null>(null);
  readonly tab      = signal<'pick' | 'guide'>('pick');
  readonly copied   = signal<string | null>(null);
  private trigger: HTMLElement | null = null;
  private readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');

  /** The trip's countries outside this phone's, as names. */
  readonly abroad = computed(() => {
    const t = this.trips.activeTrip();
    if (!t) return [];
    const zones = [...tripDestinations(t).map(d => d.timeZone), t.timeZone];
    return foreignCountries(zones, this.zone).map(countryName);
  });

  readonly cards = computed((): OfferCard[] => {
    const cfg = this.partners.config();
    const places = this.abroad();
    if (!cfg || !places.length) return [];
    const all: OfferCard[] = [
      { id: 'esim', icon: '📶', title: 'Need data abroad?', subline: `Skip roaming fees in ${countryList(places)}`, partners: cfg.esim },
      { id: 'insurance', icon: '🛡', title: 'Covered if plans change?', subline: 'Travel insurance for trips abroad', partners: cfg.insurance },
    ];
    return all.filter(c => c.partners.length && !this.hidden().has(c.id));
  });

  readonly open = computed(() => this.cards().find(c => c.id === this.openCard()) ?? null);

  constructor() {
    void this.partners.ensureLoaded();
    effect(() => {                                   // hidden cards, per trip, on this device
      const id = this.tripId();
      let list: CardId[] = [];
      try { list = id ? JSON.parse(localStorage.getItem(HIDDEN_KEY(id)) ?? '[]') : []; } catch { /* none */ }
      this.hidden.set(new Set(list));
    });
    effect(() => { if (this.open()) this.closeBtn()?.nativeElement.focus(); });
  }

  show(card: OfferCard, ev: Event): void {
    this.trigger = ev.currentTarget as HTMLElement;
    this.tab.set('pick');
    this.copied.set(null);
    this.openCard.set(card.id);
  }

  close(): void {
    this.openCard.set(null);
    this.trigger?.focus();
  }

  hide(card: OfferCard, ev: Event): void {
    ev.stopPropagation();
    const next = new Set(this.hidden()).add(card.id);
    this.hidden.set(next);
    const id = this.tripId();
    try { if (id) localStorage.setItem(HIDDEN_KEY(id), JSON.stringify([...next])); } catch { /* storage unavailable */ }
  }

  async copy(code: string, el: HTMLElement): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const range = document.createRange();        // can't copy: select it, so a long-press copies
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      return;
    }
    this.copied.set(code);
    setTimeout(() => { if (this.copied() === code) this.copied.set(null); }, 2000);
  }

  opened(p: PartnerOffer): void { this.usage.recordOffer(p.id); }

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.openCard()) this.close(); }
}
