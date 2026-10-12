import { SURVEY_BANNER_MAX_DISMISSALS, isLiveSurvey, surveyView } from './survey';
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
