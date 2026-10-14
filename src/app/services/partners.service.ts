import { Injectable, InjectionToken, Injector, inject, runInInjectionContext, signal } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { PartnerOffer, PartnersConfig } from '../models/trip.models';
import { safeLink } from '../utils/safe-link';
import { deviceZone } from '../utils/zones';

/** The phone's own time zone (a token so tests can choose it). */
export const DEVICE_ZONE = new InjectionToken<string>('DEVICE_ZONE', { factory: deviceZone });

const ID = /^[a-z0-9-]{1,32}$/;

function cleanOffer(p: Partial<PartnerOffer> | null | undefined): PartnerOffer | null {
  if (!p || !ID.test(p.id ?? '') || !p.name || !p.offer) return null;
  const url = safeLink(p.url);
  if (!url || !url.startsWith('https://')) return null;
  return { id: p.id!, name: p.name, offer: p.offer, url, ...(p.code ? { code: p.code } : {}) };
}

/** Only well-formed offers survive; switched off or missing means none. */
export function cleanPartners(raw: Partial<PartnersConfig> | null | undefined): PartnersConfig | null {
  if (!raw?.active) return null;
  const list = (l: unknown) => (Array.isArray(l) ? l : []).map(cleanOffer).filter((p): p is PartnerOffer => !!p);
  return { active: true, esim: list(raw.esim), insurance: list(raw.insurance) };
}

/**
 * Partner offers for trips abroad (Tips & Recs, #474), from `_config/partners`
 * (scripts/set-partners.js). Read once per session: offers rarely change.
 */
@Injectable({ providedIn: 'root' })
export class PartnersService {
  private firestore = inject(Firestore);
  private injector  = inject(Injector);
  private readonly _config = signal<PartnersConfig | null>(null);
  readonly config = this._config.asReadonly();
  private loading?: Promise<void>;

  ensureLoaded(): Promise<void> {
    return this.loading ??= this.load()
      .then(raw => this._config.set(cleanPartners(raw)))
      .catch(err => console.warn('[Partners] offers unavailable:', (err as Error).message));
  }

  private async load(): Promise<Partial<PartnersConfig> | null> {
    const snap = await runInInjectionContext(this.injector, () => getDoc(doc(this.firestore, '_config', 'partners')));
    return snap.exists() ? snap.data() as Partial<PartnersConfig> : null;
  }
}
