import { Injectable, Injector, computed, effect, inject, runInInjectionContext, signal } from '@angular/core';
import { DocumentData, Firestore, doc, increment, onSnapshot, updateDoc, Unsubscribe } from '@angular/fire/firestore';
import { SurveyConfig } from '../models/trip.models';
import { isLiveSurvey, isNewVisit, surveyPending, surveyView } from '../utils/survey';
import { UserService } from './user.service';

/**
 * The survey invitation: a pop-up once (SurveyPopupComponent, in the app
 * shell), then a Home banner on later visits
 * (see utils/survey.ts). The wording and link come from `_config/survey`
 * (scripts/set-survey.js); each person's progress is kept on their account,
 * so it follows them across devices. A "visit" is one app session, or a
 * return to the app after SURVEY_NEW_VISIT_AFTER_MS in the background (an
 * iPhone app can stay open for days).
 */
@Injectable({ providedIn: 'root' })
export class SurveyService {
  private firestore   = inject(Firestore);
  private injector    = inject(Injector);
  private userService = inject(UserService);

  private readonly _config = signal<SurveyConfig | null>(null);
  readonly config = this._config.asReadonly();

  /** Survey ids already shown and closed in this visit. */
  private readonly quietIds = signal<ReadonlySet<string>>(new Set());
  /** The pop-up stays up until it is answered, even after it is recorded as seen. */
  readonly popupOpen = signal(false);

  private readonly uid = computed(() => this.userService.firestoreUser()?.uid ?? null);

  readonly view = computed(() => {
    const config = this._config();
    if (!isLiveSurvey(config)) return 'none';
    const progress = this.userService.firestoreUser()?.surveys?.[config.id];
    return surveyView(config, progress, this.isQuiet(config.id));
  });

  /** The invitation isn't finished yet (see surveyPending): Home keeps its banner spot. */
  readonly pending = computed(() => {
    const config = this._config();
    return surveyPending(config, config ? this.userService.firestoreUser()?.surveys?.[config.id] : undefined);
  });

  constructor() {
    let hiddenAt: number | null = null;
    document.addEventListener('visibilitychange', () => {
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

    // Open the pop-up once, and record it straight away so closing the app
    // without answering moves them on to the banner rather than the pop-up again.
    effect(() => {
      if (this.view() !== 'popup' || this.popupOpen()) return;
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

  /** The pop-up's X: the banner takes over from their next visit. */
  closePopup(): void { this.popupOpen.set(false); }

  /** The banner's X: hidden for this visit; after the third time, for good. */
  dismissBanner(): void {
    const id = this._config()?.id;
    if (!id) return;
    this.quiet(id);
    void this.record({ [`surveys.${id}.bannerDismissals`]: increment(1) });
  }

  private newVisit(): void {
    try {
      for (const key of Object.keys(sessionStorage)) if (key.startsWith('surveyQuiet:')) sessionStorage.removeItem(key);
    } catch { /* private mode */ }
    this.quietIds.set(new Set());
  }

  private isQuiet(id: string): boolean {
    if (this.quietIds().has(id)) return true;
    try { return sessionStorage.getItem(`surveyQuiet:${id}`) === '1'; } catch { return false; }
  }

  private quiet(id: string): void {
    try { sessionStorage.setItem(`surveyQuiet:${id}`, '1'); } catch { /* private mode */ }
    this.quietIds.update(s => new Set(s).add(id));
  }

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
