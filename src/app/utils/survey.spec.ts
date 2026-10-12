import { SURVEY_BANNER_MAX_DISMISSALS, SURVEY_NEW_VISIT_AFTER_MS, fillSurveyText, surveyAvailable, isLiveSurvey, isNewVisit, surveyPending, surveyTripPlace, surveyView } from './survey';
import { TripDoc } from '../models/trip.models';
import { SurveyConfig } from '../models/trip.models';

const config: SurveyConfig = {
  id: 'trip-2026', active: true, url: 'https://example.com/form',
  title: 'Hi', body: 'Tell us how it went', bannerText: 'Got 5 minutes?',
};

describe('isLiveSurvey', () => {
  it('needs an active config with an id, an https link and wording', () => {
    expect(isLiveSurvey(config)).toBeTrue();
    expect(isLiveSurvey(null)).toBeFalse();
    expect(isLiveSurvey({ ...config, active: false })).toBeFalse();
    expect(isLiveSurvey({ ...config, id: '' })).toBeFalse();
    expect(isLiveSurvey({ ...config, url: 'http://example.com' })).toBeFalse();
    expect(isLiveSurvey({ ...config, url: 'javascript:alert(1)' })).toBeFalse();
    expect(isLiveSurvey({ ...config, title: '' })).toBeFalse();
  });
});

describe('surveyView', () => {
  it('shows nothing without a live survey', () => {
    expect(surveyView(null, undefined, false)).toBe('none');
    expect(surveyView({ ...config, active: false }, undefined, false)).toBe('none');
  });

  it('opens the pop-up for someone who has not seen it', () => {
    expect(surveyView(config, undefined, false)).toBe('popup');
    expect(surveyView(config, {}, false)).toBe('popup');
  });

  it('shows the banner on a later visit after the pop-up was closed', () => {
    expect(surveyView(config, { promptSeenAt: 1 }, false)).toBe('banner');
  });

  it('keeps quiet for the rest of a visit once the pop-up or banner was closed', () => {
    expect(surveyView(config, undefined, true)).toBe('none');   // shown this visit, not yet saved
    expect(surveyView(config, { promptSeenAt: 1 }, true)).toBe('none');
    expect(surveyView(config, { promptSeenAt: 1, bannerDismissals: 1 }, true)).toBe('none');
  });

  it('stops the banner for good after it has been closed the maximum number of times', () => {
    expect(SURVEY_BANNER_MAX_DISMISSALS).toBe(3);
    expect(surveyView(config, { promptSeenAt: 1, bannerDismissals: 2 }, false)).toBe('banner');
    expect(surveyView(config, { promptSeenAt: 1, bannerDismissals: 3 }, false)).toBe('none');
  });

  it('never shows again once they tapped the survey', () => {
    expect(surveyView(config, { takenAt: 1 }, false)).toBe('none');
    expect(surveyView(config, { promptSeenAt: 1, takenAt: 2 }, false)).toBe('none');
  });
});

describe('isNewVisit', () => {
  it('counts coming back to the app after 30 minutes away as a new visit', () => {
    expect(SURVEY_NEW_VISIT_AFTER_MS).toBe(30 * 60_000);
    expect(isNewVisit(1_000, 1_000 + 30 * 60_000)).toBeTrue();
    expect(isNewVisit(1_000, 1_000 + 2 * 60 * 60_000)).toBeTrue();
  });

  it('treats a quick switch away and back as the same visit', () => {
    expect(isNewVisit(1_000, 1_000 + 29 * 60_000)).toBeFalse();
    expect(isNewVisit(1_000, 1_000 + 5_000)).toBeFalse();
  });

  it('is not a new visit when the app was never hidden', () => {
    expect(isNewVisit(null, 5_000)).toBeFalse();
  });
});

describe('surveyPending', () => {
  it('is pending from the start until they tap it or close the banner the maximum number of times', () => {
    expect(surveyPending(config, undefined)).toBeTrue();
    expect(surveyPending(config, { promptSeenAt: 1 })).toBeTrue();
    expect(surveyPending(config, { promptSeenAt: 1, bannerDismissals: 2 })).toBeTrue();
    expect(surveyPending(config, { promptSeenAt: 1, bannerDismissals: 3 })).toBeFalse();
    expect(surveyPending(config, { promptSeenAt: 1, takenAt: 2 })).toBeFalse();
  });

  it('is never pending without a live survey', () => {
    expect(surveyPending(null, undefined)).toBeFalse();
    expect(surveyPending({ ...config, active: false }, undefined)).toBeFalse();
  });
});

describe('surveyTripPlace', () => {
  const trip = (o: Partial<TripDoc>) => ({ id: 't', name: 'Trip', destination: 'Lisbon, Portugal', startDate: '2026-05-01', endDate: '2026-05-05', ...o }) as TripDoc;

  it("names the city of the person's most recently finished trip", () => {
    const trips = [
      trip({ id: 'a', destination: 'Lisbon, Portugal', endDate: '2026-05-05' }),
      trip({ id: 'b', destination: 'Berlin, Germany', endDate: '2026-10-09' }),
      trip({ id: 'c', destination: 'Tokyo, Japan', startDate: '2026-12-01', endDate: '2026-12-10' }),   // not reached its last day
    ];
    expect(surveyTripPlace(trips, '2026-10-12')).toBe('Berlin');
  });

  it('counts a trip from its last day on', () => {
    expect(surveyTripPlace([trip({ destination: 'Berlin, Germany', endDate: '2026-10-13' })], '2026-10-12')).toBeNull();
    expect(surveyTripPlace([trip({ destination: 'Berlin, Germany', endDate: '2026-10-12' })], '2026-10-12')).toBe('Berlin');   // the last day
    expect(surveyTripPlace([trip({ destination: 'Berlin, Germany', endDate: '2026-10-11' })], '2026-10-12')).toBe('Berlin');
  });

  it('falls back to the trip name when there is no destination, and to nothing without a finished trip', () => {
    expect(surveyTripPlace([trip({ destination: '', name: 'Girls weekend' })], '2026-10-12')).toBe('Girls weekend');
    expect(surveyTripPlace([], '2026-10-12')).toBeNull();
  });
});

describe('fillSurveyText', () => {
  it('puts their trip in place of {trip}, or "your trip" when they have none', () => {
    expect(fillSurveyText('Tell me how {trip} went.', 'Berlin')).toBe('Tell me how Berlin went.');
    expect(fillSurveyText('How did {trip} go? Tell me how {trip} went.', null)).toBe('How did your trip go? Tell me how your trip went.');
    expect(fillSurveyText('No placeholder here.', 'Berlin')).toBe('No placeholder here.');
  });
});

describe('surveyAvailable', () => {
  it('is only for people with a finished trip, once their trips have loaded', () => {
    expect(surveyAvailable(config, true, 'Berlin')).toBeTrue();
    expect(surveyAvailable(config, true, null)).toBeFalse();     // no finished trip yet
    expect(surveyAvailable(config, false, null)).toBeFalse();    // still loading
  });

  it('needs a live survey', () => {
    expect(surveyAvailable(null, true, 'Berlin')).toBeFalse();
    expect(surveyAvailable({ ...config, active: false }, true, 'Berlin')).toBeFalse();
  });
});
