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

  readonly open = computed(() => this.cards().find(c => c.id === this.openCard()) ?? null);

  constructor() {
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
    this.offers.hide(card.id);
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
