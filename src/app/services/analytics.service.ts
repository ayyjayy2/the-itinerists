import { Injectable, inject, effect } from '@angular/core';
import { Analytics, ScreenTrackingService, UserTrackingService, logEvent, setUserProperties } from '@angular/fire/analytics';
import { Capacitor } from '@capacitor/core';
import { TripContextService } from './trip-context.service';
import { usagePlatform } from '../utils/usage';

/**
 * Google Analytics 4, on top of what @angular/fire's screen and user tracking
 * already report. Adds three user properties (platform, timezone, trip_id) so
 * GA can slice by where and when people are, and a few named events the
 * automatic screen views can't express. Does nothing when Analytics is not
 * provided (native shell, demo build, no measurementId) and never throws:
 * analytics must not get in a user's way.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private analytics   = inject(Analytics, { optional: true });
  private tripContext = inject(TripContextService);
  // Provided in app.config but only instantiated when injected: screen views
  // per route change, and the signed-in user's id on every event.
  private screens     = inject(ScreenTrackingService, { optional: true });
  private users       = inject(UserTrackingService, { optional: true });

  constructor() {
    if (!this.analytics) return;
    this.safely(() => setUserProperties(this.analytics!, {
      platform: usagePlatform(Capacitor.isNativePlatform(), matchMedia('(display-mode: standalone)').matches),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    }));
    effect(() => {
      const tripId = this.tripContext.activeTripId() ?? '';
      this.safely(() => setUserProperties(this.analytics!, { trip_id: tripId }));
    });
  }

  /** A named event: `trip_created`, `trip_joined`, `invite_shared`. */
  event(name: 'trip_created' | 'trip_joined' | 'invite_shared', params?: Record<string, string | number>): void {
    if (!this.analytics) return;
    this.safely(() => logEvent(this.analytics!, name, params));
  }

  private safely(fn: () => void): void {
    try { fn(); } catch (err) { console.warn('[Analytics]', (err as Error)?.message ?? err); }
  }
}
