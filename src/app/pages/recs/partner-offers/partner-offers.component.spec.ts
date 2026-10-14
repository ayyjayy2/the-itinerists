import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PartnerOffersComponent } from './partner-offers.component';
import { DEVICE_ZONE, PartnersService } from '../../../services/partners.service';
import { TripService } from '../../../services/trip.service';
import { UsageService } from '../../../services/usage.service';

const OFFERS = {
  active: true,
  esim: [{ id: 'esim-a', name: 'eSIM A', offer: '$3 off', code: 'CODE3', url: 'https://example.com/a' }],
  insurance: [{ id: 'cover', name: 'Cover', offer: 'By the week', url: 'https://example.com/c' }],
};

describe('PartnerOffersComponent', () => {
  let fixture: ComponentFixture<PartnerOffersComponent>;
  let el: HTMLElement;
  let usage: jasmine.SpyObj<UsageService>;
  const config = signal<any>(OFFERS);
  const trip = signal<any>({ id: 'T1', timeZone: 'Europe/Berlin', destination: 'Berlin, Germany', startDate: '2026-11-01', endDate: '2026-11-05', currency: 'EUR' });

  function make(zone = 'America/Chicago'): void {
    usage = jasmine.createSpyObj<UsageService>('UsageService', ['recordOffer']);
    TestBed.configureTestingModule({
      imports: [PartnerOffersComponent],
      providers: [
        { provide: PartnersService, useValue: { config, ensureLoaded: () => Promise.resolve() } },
        { provide: TripService, useValue: { activeTrip: trip } },
        { provide: UsageService, useValue: usage },
        { provide: DEVICE_ZONE, useValue: zone },
      ],
    });
    fixture = TestBed.createComponent(PartnerOffersComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }
  const titles = () => [...el.querySelectorAll('.offer-card .offer-title')].map(t => t.textContent!.trim());
  const openFirst = () => { (el.querySelector('.offer-card') as HTMLElement).click(); fixture.detectChanges(); };

  beforeEach(() => { localStorage.removeItem('itinerists_offers_hidden_T1'); config.set(OFFERS); });

  it('shows both cards when the trip is abroad for this phone, naming the country', () => {
    make();
    expect(titles()).toEqual(['Need data abroad?', 'Covered if plans change?']);
    expect(el.querySelector('.offer-card')!.textContent).toContain('Germany');
  });

  it('shows nothing when the trip is in the phone\'s own country', () => {
    make('Europe/Berlin');
    expect(titles()).toEqual([]);
  });

  it('shows nothing when the offers are off, and skips a card with no partners', () => {
    config.set(null);
    make();
    expect(titles()).toEqual([]);
    TestBed.resetTestingModule();
    config.set({ ...OFFERS, insurance: [] });
    make();
    expect(titles()).toEqual(['Need data abroad?']);
  });

  it('Hide removes a card for this trip, and it stays hidden', () => {
    make();
    (el.querySelector('.offer-card .offer-hide') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(titles()).toEqual(['Covered if plans change?']);
    expect(el.querySelector('[role=dialog]')).toBeNull();
    TestBed.resetTestingModule();
    make();
    expect(titles()).toEqual(['Covered if plans change?']);
  });

  it('opens the eSIM pop-up with two tabs, and switches to the guide', () => {
    make();
    openFirst();
    expect(el.querySelector('[role=dialog]')).toBeTruthy();
    expect(el.querySelector('[role=dialog]')!.textContent).toContain('CODE3');
    (el.querySelector('[data-tab=guide]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Pick a plan before you go');
    expect(el.textContent).toContain('We may earn a small commission');
  });

  it('counts a tap on Open, under the partner id', () => {
    make();
    openFirst();
    const open = el.querySelector('a.offer-open') as HTMLAnchorElement;
    expect(open.href).toBe('https://example.com/a');
    expect(open.rel).toContain('sponsored');
    open.addEventListener('click', e => e.preventDefault());
    open.click();
    expect(usage.recordOffer).toHaveBeenCalledOnceWith('esim-a');
  });

  it('copies a code, and says so', async () => {
    make();
    spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    openFirst();
    (el.querySelector('.offer-code') as HTMLButtonElement).click();
    await new Promise(r => setTimeout(r));      // the copy finishes
    fixture.detectChanges();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('CODE3');
    expect(el.querySelector('.offer-code')!.textContent).toContain('Copied');
  });

  it('closes with Escape', () => {
    make();
    openFirst();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('[role=dialog]')).toBeNull();
  });
});
