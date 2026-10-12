import { SurveyConfig, SurveyProgress, TripDoc } from '../models/trip.models';

/** Closing the Home banner this many times ends the invitation for good. */
export const SURVEY_BANNER_MAX_DISMISSALS = 3;

export type SurveyView = 'popup' | 'banner' | 'none';

/** A config the app may show: switched on, with an id, an https link and its wording. */
export function isLiveSurvey(c: SurveyConfig | null | undefined): c is SurveyConfig {
  return !!c && c.active === true && !!c.id && /^https:\/\//.test(c.url ?? '')
    && !!c.title && !!c.body && !!c.bannerText;
}

/**
 * What to show someone on Home. The pop-up comes once; after that the banner
 * shows on later visits until they tap the survey or close the banner
 * SURVEY_BANNER_MAX_DISMISSALS times. `quietThisVisit` is true once the pop-up
 * has been shown or the banner closed in this visit, so nothing reappears
 * straight away (even before the account has saved it).
 */
export function surveyView(config: SurveyConfig | null, progress: SurveyProgress | undefined, quietThisVisit: boolean): SurveyView {
  if (!isLiveSurvey(config) || progress?.takenAt || quietThisVisit) return 'none';
  if (!progress?.promptSeenAt) return 'popup';
  if ((progress.bannerDismissals ?? 0) >= SURVEY_BANNER_MAX_DISMISSALS) return 'none';
  return 'banner';
}

/**
 * The invitation isn't finished: they haven't tapped the survey or closed the
 * banner the maximum number of times. While it's pending the survey holds the
 * banner spot on Home, so closing it never makes another banner pop up instead.
 */
export function surveyPending(config: SurveyConfig | null, progress: SurveyProgress | undefined): boolean {
  return isLiveSurvey(config) && !progress?.takenAt
    && (progress?.bannerDismissals ?? 0) < SURVEY_BANNER_MAX_DISMISSALS;
}

/** Coming back to the app after this long in the background counts as a new visit. */
export const SURVEY_NEW_VISIT_AFTER_MS = 30 * 60_000;

/** Was the app away (hidden since `hiddenAt`) long enough that returning `now` is a new visit? */
export function isNewVisit(hiddenAt: number | null, now: number): boolean {
  return hiddenAt !== null && now - hiddenAt >= SURVEY_NEW_VISIT_AFTER_MS;
}

/**
 * The place to name in the survey wording: the city of the person's most
 * recently finished trip ("Berlin, Germany" → "Berlin"), or the trip's name
 * when it has no destination. Null when they have no finished trip.
 */
export function surveyTripPlace(trips: TripDoc[], todayISO: string): string | null {
  const done = trips.filter(t => t.endDate && t.endDate < todayISO)
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
  if (!done.length) return null;
  const city = (done[0].destination ?? '').split(',')[0].trim();
  return city || done[0].name || null;
}

/** Fill the `{trip}` placeholder in the survey wording: their trip, or "your trip". */
export function fillSurveyText(text: string, place: string | null): string {
  return text.split('{trip}').join(place ?? 'your trip');
}
