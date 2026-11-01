import { Capacitor } from '@capacitor/core';
import { publicLink } from './public-link';

/** #658: invite and share links copied in the iPhone app must open for other people. */
describe('publicLink', () => {
  it('uses this site on the web', () => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
    expect(publicLink('/join?code=ABC')).toBe(`${location.origin}/join?code=ABC`);
  });

  it('uses the public site in the iPhone app, never capacitor://localhost', () => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    expect(publicLink('/join?code=ABC')).toMatch(/^https:\/\/(theitinerists\.com|the-itinerists-staging\.web\.app)\/join\?code=ABC$/);
  });
});
