import { SurveyConfig, SurveyProgress } from '../models/trip.models';

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
