import { Injectable, Injector, computed, effect, inject, runInInjectionContext, signal } from '@angular/core';
import { DocumentData, Firestore, doc, increment, onSnapshot, updateDoc, Unsubscribe } from '@angular/fire/firestore';
import { SurveyConfig } from '../models/trip.models';
import { fillSurveyText, isLiveSurvey, shouldOpenSurveyPopup, surveyAvailable, isNewVisit, surveyPending, surveyTripPlace, surveyView } from '../utils/survey';
import { localTodayISO } from '../utils/trip-destinations';
import { TripService } from './trip.service';
import { UserService } from './user.service';

/**
 * The survey invitation: a pop-up once (SurveyPopupComponent, in the app
 * shell), then a Home banner on later visits
 * (see utils/survey.ts). The wording and link come from `_config/survey`
 * (scripts/set-survey.js); each person's progress is kept on their account,
 * so it follows them across devices. A "visit" is one launch (or reload) of
 * the app, or a return to it after SURVEY_NEW_VISIT_AFTER_MS in the
 * background (an iPhone app can stay open for days).
 */
@Injectable({ providedIn: 'root' })
export class SurveyService {
  private firestore   = inject(Firestore);
  private injector    = inject(Injector);
  private userService = inject(UserService);
  private tripService = inject(TripService);

  private readonly _config = signal<SurveyConfig | null>(null);
  readonly config = this._config.asReadonly();

  /** Whether the app is on screen (not a background tab or a backgrounded phone app). */
  private readonly visibility = signal<DocumentVisibilityState>(document.visibilityState);

  /** Survey ids already shown and closed in this visit (kept in memory: a relaunch is a new visit). */
  private readonly quietIds = signal<ReadonlySet<string>>(new Set());
  /** The pop-up stays up until it is answered, even after it is recorded as seen. */
  readonly popupOpen = signal(false);

  private readonly uid = computed(() => this.userService.firestoreUser()?.uid ?? null);

  /** The survey is on and meant for them: they have a finished trip. */
  readonly available = computed(() => surveyAvailable(this._config(), this.tripsLoaded(), this.tripPlace()));

  readonly view = computed(() => {
    const config = this._config();
    if (!this.available() || !config) return 'none';
    const progress = this.userService.firestoreUser()?.surveys?.[config.id];
    return surveyView(config, progress, this.isQuiet(config.id));
  });


  /** Where their most recently finished trip went (null: none), once their trips have loaded. */
  private readonly tripPlace = signal<string | null>(null);
  private readonly tripsLoaded = signal(false);

  /** The wording with `{trip}` filled in for this person. */
  readonly text = computed(() => {
    const c = this._config();
    if (!c) return null;
    const place = this.tripPlace();
    return { title: fillSurveyText(c.title, place), body: fillSurveyText(c.body, place), bannerText: fillSurveyText(c.bannerText, place) };
  });

  /** The bell's "New survey" notice badges once, until they next open the bell. */
  readonly noticeUnseen = computed(() => {
    const c = this._config();
    return this.available() && !!c && !this.userService.firestoreUser()?.surveys?.[c.id]?.noticeSeenAt;
  });

  /** The invitation isn't finished yet (see surveyPending): Home keeps its banner spot. */
  readonly pending = computed(() => {
    const config = this._config();
    return this.available()
      && surveyPending(config, config ? this.userService.firestoreUser()?.surveys?.[config.id] : undefined);
  });

  constructor() {
    let hiddenAt: number | null = null;
    document.addEventListener('visibilitychange', () => {
      this.visibility.set(document.visibilityState);
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
      if (isNewVisit(hiddenAt, Date.now())) this.newVisit();
      hiddenAt = null;
    });

    // Settings are readable only when signed in: listen while someone is.
    let unsub: Unsubscribe | null = null;
    effect(onCleanup => {
      if (!this.uid()) { this._config.set(null); return; }
      unsub = runInInjectionContext(this.injector, () =>
        onSnapshot(doc(this.firestore, '_config', 'survey'),
          snap => this._config.set(snap.exists() ? snap.data() as SurveyConfig : null),
          err => { console.warn('[SurveyService] settings:', err.message); this._config.set(null); }));
      onCleanup(() => { unsub?.(); unsub = null; });
    });

    // Their trips name the place in the wording. Loaded once per account,
    // only while a survey is on.
    let tripsFor: string | null = null;
    effect(() => {
      const uid = this.uid();
      if (!uid || !isLiveSurvey(this._config()) || tripsFor === uid) return;
      tripsFor = uid;
      this.tripService.getUserTrips(uid)
        .then(trips => this.tripPlace.set(surveyTripPlace(trips, localTodayISO())))
        .catch(err => console.warn('[SurveyService] trips:', (err as Error).message))
        .finally(() => this.tripsLoaded.set(true));
    });

    // Open the pop-up once, and record it straight away so closing the app
    // without answering moves them on to the banner rather than the pop-up again.
    effect(() => {
      // view waits for their trips (so the wording is settled); only open on screen.
      if (!shouldOpenSurveyPopup(this.view(), this.popupOpen(), this.visibility())) return;
      const id = this._config()!.id;
      this.popupOpen.set(true);
      this.quiet(id);
      void this.record({ [`surveys.${id}.promptSeenAt`]: Date.now() });
    });
  }

  /** They tapped "Take the survey" (the link opens it): never ask again. */
  take(): void {
    const id = this._config()?.id;
    this.popupOpen.set(false);
    if (id) void this.record({ [`surveys.${id}.takenAt`]: Date.now() });
  }

  /** They opened the bell: the survey notice stops badging (it stays in the list). */
  markNoticeSeen(): void {
    const id = this._config()?.id;
    if (id && this.noticeUnseen()) void this.record({ [`surveys.${id}.noticeSeenAt`]: Date.now() });
  }

  /** The pop-up's X: the banner takes over from their next visit. */
  closePopup(): void { this.popupOpen.set(false); }

  /** The banner's X: hidden for this visit; after the third time, for good. */
  dismissBanner(): void {
    const id = this._config()?.id;
    if (!id) return;
    this.quiet(id);
    void this.record({ [`surveys.${id}.bannerDismissals`]: increment(1) });
  }

  private newVisit(): void { this.quietIds.set(new Set()); }

  private isQuiet(id: string): boolean { return this.quietIds().has(id); }

  private quiet(id: string): void { this.quietIds.update(s => new Set(s).add(id)); }

  private async record(patch: DocumentData): Promise<void> {
    const uid = this.uid();
    if (!uid) return;
    try {
      await runInInjectionContext(this.injector, () => updateDoc(doc(this.firestore, 'users', uid), patch));
    } catch (err) {
      console.warn('[SurveyService] could not save progress:', (err as Error).message);
    }
  }
}
