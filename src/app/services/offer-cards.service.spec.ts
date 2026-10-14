import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { OfferCardsService } from './offer-cards.service';
import { DEVICE_ZONE, PartnersService } from './partners.service';
import { TripService } from './trip.service';

const OFFERS = {
  active: true,
  esim: [{ id: 'esim-a', name: 'eSIM A', offer: '$3 off', code: 'CODE3', url: 'https://example.com/a' }],
  insurance: [{ id: 'cover', name: 'Cover', offer: 'By the week', url: 'https://example.com/c' }],
};

describe('OfferCardsService', () => {
  const config = signal<any>(OFFERS);
  const trip = signal<any>({ id: 'T1', timeZone: 'Europe/Berlin', destination: 'Berlin, Germany', startDate: '2026-11-01', endDate: '2026-11-05', currency: 'EUR' });

  function make(zone = 'America/Chicago'): OfferCardsService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PartnersService, useValue: { config, ensureLoaded: () => Promise.resolve() } },
        { provide: TripService, useValue: { activeTrip: trip } },
        { provide: DEVICE_ZONE, useValue: zone },
      ],
    });
    const s = TestBed.inject(OfferCardsService);
    TestBed.flushEffects();
    return s;
  }
  const titles = (s: OfferCardsService) => s.cards().map(c => c.title);

  beforeEach(() => { localStorage.removeItem('itinerists_offers_hidden_T1'); config.set(OFFERS); });

  it('offers both cards when the trip is abroad for this phone, naming the country', () => {
    const s = make();
    expect(titles(s)).toEqual(['Need data abroad?', 'Covered if plans change?']);
    expect(s.cards()[0].subline).toContain('Germany');
  });

  it('offers nothing when the trip is in the phone\'s own country', () => {
    expect(titles(make('Europe/Berlin'))).toEqual([]);
  });

  it('offers nothing when the offers are off, and skips a card with no partners', () => {
    config.set(null);
    expect(titles(make())).toEqual([]);
    config.set({ ...OFFERS, insurance: [] });
    expect(titles(make())).toEqual(['Need data abroad?']);
  });

  it('Hide removes a card for this trip, and it stays hidden', () => {
    const s = make();
    s.hide('esim');
    expect(titles(s)).toEqual(['Covered if plans change?']);
    expect(titles(make())).toEqual(['Covered if plans change?']);
  });
});
