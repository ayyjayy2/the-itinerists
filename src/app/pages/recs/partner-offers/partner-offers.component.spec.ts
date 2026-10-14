import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PartnerOffersComponent } from './partner-offers.component';
import { OfferCard, OfferCardsService } from '../../../services/offer-cards.service';
import { UsageService } from '../../../services/usage.service';

const CARDS: OfferCard[] = [
  { id: 'esim', icon: '📶', title: 'Need data abroad?', subline: 'Skip roaming fees in Germany',
    partners: [{ id: 'esim-a', name: 'eSIM A', offer: '$3 off', code: 'CODE3', url: 'https://example.com/a' }] },
  { id: 'insurance', icon: '🛡', title: 'Covered if plans change?', subline: 'Travel insurance for trips abroad',
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
    expect(cards.map(c => c.querySelector('.offer-name')!.textContent!.trim())).toEqual(['Need data abroad?', 'Covered if plans change?']);
    expect(cards[0].textContent).toContain('Skip roaming fees in Germany');
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
    expect(el.textContent).toContain('We may earn a small commission');
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
