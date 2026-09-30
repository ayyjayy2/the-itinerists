import { Injectable, inject, effect } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Firestore, collection, addDoc, serverTimestamp } from '@angular/fire/firestore';
import { Capacitor } from '@capacitor/core';
import { filter } from 'rxjs';
import { UserService } from './user.service';
import { TripContextService } from './trip-context.service';
import { usagePage, usagePlatform, localClock, isRepeatPageView, UsagePlatform } from '../utils/usage';
import { DEMO } from '../demo-flag';
import { APP_VERSION } from '../../version';

export type UsageEventType = 'session' | 'page' | 'ping';

/** One row of the `_activity` collection. Field set is enforced by firestore.rules. */
export interface UsageEvent {
  uid: string;
  tripId: string | null;
  type: UsageEventType;
  page: string;
  at: ReturnType<typeof serverTimestamp>;
  localHour: number;
  tz: string;
  tzOffsetMin: number;
  platform: UsagePlatform;
  sessionId: string;
  appVersion: string;
}

/** A user counts as "still here" if a ping lands this often while the page is visible.
 *  Two minutes keeps the owner's dashboard close to live at ~30 writes an hour per person. */
const PING_EVERY_MS = 2 * 60_000;

/**
 * Records how the app is used — one `_activity` doc per app open (`session`),
 * per page visited (`page`), and per five minutes spent on a visible page
 * (`ping`) — so the admin-only Activity page can show who is in the app, when,
 * and where. Nothing is written while signed out or in the demo build, and a
 * failed write is never surfaced: analytics must not get in a user's way.
 */
@Injectable({ providedIn: 'root' })
export class UsageService {
  private firestore   = inject(Firestore);
  private router      = inject(Router);
  private userService = inject(UserService);
  private tripContext = inject(TripContextService);

  /** New on every app open; lets the Activity page group one visit's events. */
  readonly sessionId = crypto.randomUUID();

  private readonly platform = usagePlatform(
    Capacitor.isNativePlatform(),
    typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches,
  );
  private readonly tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  private currentPage = usagePage(location.pathname);
  private sessionSent = false;
  private lastEventAt = 0;
  private lastPageView: { page: string; at: number } | null = null;
  private lastTripRecorded: string | null = null;
  private pingTimer: ReturnType<typeof setInterval> | undefined;

  /** Wire up the listeners. Called once from the root component. */
  start(): void {
    if (DEMO) return;

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        this.currentPage = usagePage(e.urlAfterRedirects);
        if (this.userService.hasUser()) this.record('page');
      });

    // The session starts when we know who this is; a sign-out ends it.
    effect(() => {
      const user = this.userService.currentUser();
      if (user && !this.sessionSent) {
        this.sessionSent = true;
        this.record('session');
        this.record('page');
        this.startPinging();
      } else if (!user && this.sessionSent) {
        this.sessionSent = false;
        this.stopPinging();
      }
    });

    // The first events of a visit often fire before the active trip is known
    // (it loads with the trip list), so they carry no trip. As soon as the
    // trip settles or changes, one ping records where this person is.
    effect(() => {
      const trip = this.tripContext.activeTripId();
      if (this.sessionSent && trip && trip !== this.lastTripRecorded) this.record('ping');
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.pingIfDue();
    });
  }

  private startPinging(): void {
    this.stopPinging();
    this.pingTimer = setInterval(() => this.pingIfDue(), 30_000);
  }

  private stopPinging(): void {
    if (this.pingTimer !== undefined) clearInterval(this.pingTimer);
    this.pingTimer = undefined;
  }

  /** A ping only says "still here": it is sent when nothing else has been for two minutes. */
  private pingIfDue(): void {
    if (!this.sessionSent || document.visibilityState !== 'visible') return;
    if (Date.now() - this.lastEventAt < PING_EVERY_MS) return;
    this.record('ping');
  }

  private record(type: UsageEventType): void {
    const uid = this.userService.currentUser()?.uid;
    if (!uid) return;
    const now = Date.now();
    if (type === 'page') {
      if (isRepeatPageView(this.lastPageView, this.currentPage, now)) return;
      this.lastPageView = { page: this.currentPage, at: now };
    }
    this.lastEventAt = now;
    this.lastTripRecorded = this.tripContext.activeTripId();
    const event: UsageEvent = {
      uid,
      tripId: this.lastTripRecorded,
      type,
      page: this.currentPage,
      at: serverTimestamp(),
      ...localClock(new Date(), this.tz),
      platform: this.platform,
      sessionId: this.sessionId,
      appVersion: APP_VERSION,
    };
    addDoc(collection(this.firestore, '_activity'), event).catch(err => {
      console.warn('[Usage] event not recorded:', err?.message ?? err);
    });
  }
}
