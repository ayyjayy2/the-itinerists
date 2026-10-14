import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { PartnerOffer } from '../models/trip.models';
import { countryList, countryName, foreignCountries } from '../utils/abroad';
import { tripDestinations } from '../utils/trip-destinations';
import { DEVICE_ZONE, PartnersService } from './partners.service';
import { TripService } from './trip.service';

export type OfferCardId = 'esim' | 'insurance';
export interface OfferCard { id: OfferCardId; icon: string; title: string; subline: string; partners: PartnerOffer[]; }

const HIDDEN_KEY = (tripId: string) => `itinerists_offers_hidden_${tripId}`;

/**
 * Which partner offer cards Tips & Recs shows (#474, #476): an eSIM card and an
 * insurance card, only when a stop is in another country from this phone, minus
 * the ones this person hid on this trip (kept on this device).
 */
@Injectable({ providedIn: 'root' })
export class OfferCardsService {
  private partners = inject(PartnersService);
  private trips    = inject(TripService);
  private zone     = inject(DEVICE_ZONE);

  private readonly tripId = computed(() => this.trips.activeTrip()?.id ?? null);
  private readonly hidden = signal<Set<OfferCardId>>(new Set());

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

  constructor() {
    void this.partners.ensureLoaded();
    effect(() => {                                   // hidden cards, per trip, on this device
      const id = this.tripId();
      let list: OfferCardId[] = [];
      try { list = id ? JSON.parse(localStorage.getItem(HIDDEN_KEY(id)) ?? '[]') : []; } catch { /* none */ }
      this.hidden.set(new Set(list));
    });
  }

  hide(id: OfferCardId): void {
    const next = new Set(this.hidden()).add(id);
    this.hidden.set(next);
    const trip = this.tripId();
    try { if (trip) localStorage.setItem(HIDDEN_KEY(trip), JSON.stringify([...next])); } catch { /* storage unavailable */ }
  }
}
