import { signInByUsername } from './username-sign-in';

// #712: a username sign-in read the database (usernames/{name}) before the password
// was even checked, with no time limit, and could hang the iPhone app. Firebase Auth
// is now asked first with the usual address; the lookup only runs if Auth refuses.
describe('signInByUsername', () => {
  const wrong = Object.assign(new Error('wrong'), { code: 'auth/invalid-credential' });

  it('signs in with the usual address without reading the database', async () => {
    const attempt = jasmine.createSpy('attempt').and.resolveTo();
    const lookup = jasmine.createSpy('lookup');
    expect(await signInByUsername('Maya', attempt, lookup)).toBe('signed-in');
    expect(attempt).toHaveBeenCalledOnceWith('maya@the-itinerists.local');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('looks the username up when Auth refuses, and tries the address it names', async () => {
    const attempt = jasmine.createSpy('attempt').and.callFake(async (a: string) => { if (a === 'maya@the-itinerists.local') throw wrong; });
    const lookup = jasmine.createSpy('lookup').and.resolveTo({ authEmail: 'maya.2@the-itinerists.local' });
    expect(await signInByUsername('maya', attempt, lookup)).toBe('signed-in');
    expect(attempt.calls.allArgs()).toEqual([['maya@the-itinerists.local'], ['maya.2@the-itinerists.local']]);
  });

  it('says to use the email when the account has moved to one', async () => {
    const attempt = jasmine.createSpy('attempt').and.rejectWith(wrong);
    expect(await signInByUsername('maya', attempt, async () => ({}))).toBe('use-email');
  });

  it('passes the wrong-password error on when the lookup names the same address, or none', async () => {
    const attempt = jasmine.createSpy('attempt').and.rejectWith(wrong);
    await expectAsync(signInByUsername('maya', attempt, async () => ({ authEmail: 'maya@the-itinerists.local' }))).toBeRejectedWith(wrong);
    await expectAsync(signInByUsername('maya', attempt, async () => null)).toBeRejectedWith(wrong);
    await expectAsync(signInByUsername('maya', attempt, () => Promise.reject(new Error('offline')))).toBeRejectedWith(wrong);
  });

  it('passes any other error straight on, without a lookup', async () => {
    const tooMany = Object.assign(new Error('slow down'), { code: 'auth/too-many-requests' });
    const lookup = jasmine.createSpy('lookup');
    await expectAsync(signInByUsername('maya', () => Promise.reject(tooMany), lookup)).toBeRejectedWith(tooMany);
    expect(lookup).not.toHaveBeenCalled();
  });
});
