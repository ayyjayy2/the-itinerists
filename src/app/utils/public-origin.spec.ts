import { publicOrigin } from './public-origin';

describe('publicOrigin (#611)', () => {
  it('keeps the website’s own address', () => {
    expect(publicOrigin('https://the-itinerists.web.app', false, 'trip-planner-ayyjayy2')).toBe('https://the-itinerists.web.app');
    expect(publicOrigin('http://localhost:4400', false, 'demo')).toBe('http://localhost:4400');
  });

  it('uses the public site in the iPhone app, by project', () => {
    expect(publicOrigin('capacitor://localhost', true, 'trip-planner-ayyjayy2')).toBe('https://theitinerists.com');
    expect(publicOrigin('capacitor://localhost', true, 'the-itinerists-staging')).toBe('https://the-itinerists-staging.web.app');
  });
});
