import { Component, ElementRef, HostListener, computed, effect, inject, signal, viewChild } from '@angular/core';
import { PartnerOffer } from '../../../models/trip.models';
import { OfferCard, OfferCardId, OfferCardsService } from '../../../services/offer-cards.service';
import { UsageService } from '../../../services/usage.service';
import { ESIM_GOOD_TO_KNOW, ESIM_INTRO, ESIM_STEPS } from '../../../utils/esim-guide';

/**
 * Partner offers for trips abroad (#474), shown as rec cards in the Tips group of
 * Tips & Recs (#476): an eSIM card and an insurance card (OfferCardsService
 * decides which), each opening a pop-up. Host is `display: contents`, so the
 * cards sit in the group's grid like the other recs.
 */
/** Space between the pop-up and the header above it / the tab bar below it. */
const SHEET_GAP = 12;

@Component({
  selector: 'app-partner-offers',
  standalone: true,
  templateUrl: './partner-offers.component.html',
  styleUrl: './partner-offers.component.scss',
})
export class PartnerOffersComponent {
  private offers = inject(OfferCardsService);
  private usage  = inject(UsageService);

  readonly guideIntro = ESIM_INTRO;
  readonly guideSteps = ESIM_STEPS;
  readonly guideNotes = ESIM_GOOD_TO_KNOW;

  readonly cards    = this.offers.cards;
  readonly openCard = signal<OfferCardId | null>(null);
  readonly tab      = signal<'pick' | 'guide'>('pick');
  readonly copied   = signal<string | null>(null);
  private trigger: HTMLElement | null = null;
  private readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');

  readonly open = computed(() => this.cards().find(c => c.id === this.openCard()) ?? null);

  /** The commission note (US FTC, #575): it names the codes only when the pop-up shows some. */
  readonly disclosure = computed(() =>
    `We earn a commission if you buy through these links${this.open()?.partners.some(p => p.code) ? ' or use these codes' : ''}. It doesn't add to your price.`);

  /** The room between the app's header and its tab bar (#478): the pop-up sits in it
   *  with the same gap at both ends, and scrolls inside rather than running under a bar. */
  readonly room = signal({ top: SHEET_GAP, bottom: SHEET_GAP });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.measureRoom();
      this.closeBtn()?.nativeElement.focus();
    });
  }

  @HostListener('window:resize')
  measureRoom(): void {
    const header = document.querySelector('.app-header')?.getBoundingClientRect();
    const tabs = document.querySelector('nav.tab-bar')?.getBoundingClientRect();
    const top = header && header.height ? header.bottom : 0;
    const bottom = tabs && tabs.height ? window.innerHeight - tabs.top : 0;
    this.room.set({ top: Math.max(0, top) + SHEET_GAP, bottom: Math.max(0, bottom) + SHEET_GAP });
  }

  show(card: OfferCard, ev: Event): void {
    this.trigger = ev.currentTarget as HTMLElement;
    this.tab.set('pick');
    this.copied.set(null);
    this.openCard.set(card.id);
  }

  /** Switch tabs, starting the new one from its top. */
  setTab(t: 'pick' | 'guide'): void {
    this.tab.set(t);
    this.body()?.nativeElement.scrollTo({ top: 0 });
  }

  close(): void {
    this.openCard.set(null);
    this.trigger?.focus();
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
