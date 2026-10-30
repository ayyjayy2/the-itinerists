import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PartnerOffersComponent } from './partner-offers.component';
import { OfferCard, OfferCardsService } from '../../../services/offer-cards.service';
import { UsageService } from '../../../services/usage.service';

const CARDS: OfferCard[] = [
  { id: 'esim', icon: '📶', title: 'Need data abroad?', subline: 'Skip roaming fees in Germany',
    partners: [{ id: 'esim-a', name: 'eSIM A', offer: '$3 off', code: 'CODE3', url: 'https://example.com/a' }] },
  { id: 'insurance', icon: '🛡', title: 'Medical cover abroad?', subline: 'Travel medical insurance for trips abroad',
    partners: [{ id: 'cover', name: 'Cover', offer: 'By the week', url: 'https://example.com/c' }] },
];

describe('PartnerOffersComponent', () => {
  let fixture: ComponentFixture<PartnerOffersComponent>;
  let el: HTMLElement;
  let usage: jasmine.SpyObj<UsageService>;

  beforeEach(() => {
    usage = jasmine.createSpyObj<UsageService>('UsageService', ['recordOffer']);
    TestBed.configureTestingModule({
      imports: [PartnerOffersComponent],
      providers: [
        { provide: OfferCardsService, useValue: { cards: signal(CARDS) } },
        { provide: UsageService, useValue: usage },
      ],
    });
    fixture = TestBed.createComponent(PartnerOffersComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  const openFirst = () => { (el.querySelector('.offer-card') as HTMLElement).click(); fixture.detectChanges(); };

  it('shows each card as a rec card, with its title and line', () => {
    const cards = [...el.querySelectorAll('.offer-card.rec-card')];
    expect(cards.map(c => c.querySelector('.offer-name')!.textContent!.trim())).toEqual(['Need data abroad?', 'Medical cover abroad?']);
    expect(cards[0].textContent).toContain('Skip roaming fees in Germany');
  });

  // US FTC: people know a card is a paid offer before they tap it (#575)
  it('tags each card as a partner offer', () => {
    const tags = [...el.querySelectorAll('.offer-card .offer-tag')].map(t => t.textContent!.trim());
    expect(tags).toEqual(['Partner offer', 'Partner offer']);
  });

  it('has no Hide button: the cards stay, like the other tips (#480)', () => {
    expect(el.querySelector('.offer-hide')).toBeNull();
    expect([...el.querySelectorAll('.offer-card button')].map(b => b.textContent!.trim())).not.toContain('Hide');
  });

  it('opens the eSIM pop-up with two tabs, and switches to the guide', () => {
    openFirst();
    expect(el.querySelector('[role=dialog]')!.textContent).toContain('CODE3');
    (el.querySelector('[data-tab=guide]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Pick a plan before you go');
    expect(el.textContent).toContain('We earn a commission if you buy through these links or use these codes');
  });

  // US FTC: the commission note sits before the links, so it's seen before anyone taps Open (#571).
  it('puts the commission note above the partner links, on both pop-ups', () => {
    for (const i of [0, 1]) {
      (el.querySelectorAll('.offer-card')[i] as HTMLElement).click();
      fixture.detectChanges();
      const note = el.querySelector('.offer-disclosure')!;
      const list = el.querySelector('.offer-list')!;
      // the eSIM partner shows a code, the insurance one doesn't (#575)
      expect(note.textContent!.trim()).toBe(i === 0
        ? "We earn a commission if you buy through these links or use these codes. It doesn't add to your price."
        : "We earn a commission if you buy through these links. It doesn't add to your price.");
      expect(note.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      (el.querySelector('.offer-close') as HTMLButtonElement).click();
      fixture.detectChanges();
    }
  });

  it('on the eSIM guide, puts the commission note just above the Pick an eSIM button', () => {
    openFirst();
    (el.querySelector('[data-tab=guide]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const button = el.querySelector('.offer-guide > button.btn')!;
    expect(button.textContent!.trim()).toBe('Pick an eSIM');
    expect(button.previousElementSibling!.classList).toContain('offer-disclosure');
    expect(el.querySelectorAll('.offer-disclosure').length).toBe(1);
  });

  it('counts a tap on Open, under the partner id', () => {
    openFirst();
    const open = el.querySelector('a.offer-open') as HTMLAnchorElement;
    expect(open.href).toBe('https://example.com/a');
    expect(open.rel).toContain('sponsored');
    open.addEventListener('click', e => e.preventDefault());
    open.click();
    expect(usage.recordOffer).toHaveBeenCalledOnceWith('esim-a');
  });

  it('copies a code, and says so', async () => {
    spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    openFirst();
    (el.querySelector('.offer-code') as HTMLButtonElement).click();
    await new Promise(r => setTimeout(r));      // the copy finishes
    fixture.detectChanges();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('CODE3');
    expect(el.querySelector('.offer-code')!.textContent).toContain('Copied');
  });

  it('closes with Escape', () => {
    openFirst();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('[role=dialog]')).toBeNull();
  });
});
