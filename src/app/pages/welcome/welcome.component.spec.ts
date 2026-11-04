import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WelcomeComponent } from './welcome.component';
import { WaitlistService } from '../../services/waitlist.service';

describe('WelcomeComponent', () => {
  let waitlist: { join: jasmine.Spy; joined: () => boolean };

  beforeEach(() => {
    waitlist = { join: jasmine.createSpy('join').and.resolveTo(), joined: () => false };
    TestBed.configureTestingModule({
      imports: [WelcomeComponent],
      providers: [provideRouter([]), { provide: WaitlistService, useValue: waitlist }],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(WelcomeComponent);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows short, silent, looping demo clips that play inline', () => {
    const videos = [...render().el.querySelectorAll('video')];
    expect(videos.length).toBeGreaterThanOrEqual(3);
    for (const v of videos) {
      expect(v.muted).toBeTrue();
      // Safari (Mac and iPhone) only autoplays when the muted ATTRIBUTE is in
      // the markup; Angular's [muted] binding sets only the property.
      expect(v.hasAttribute('muted')).toBeTrue();
      expect(v.loop).toBeTrue();
      expect(v.hasAttribute('playsinline')).toBeTrue();
      expect(v.getAttribute('poster')).toBeTruthy();
    }
  });

  it('has a handwritten "Join waitlist!" pointer for the stacked layout, kept out of screen readers', () => {
    const note = render().el.querySelector('.waitlist-note')!;
    expect((note as HTMLElement).innerText ?? note.textContent).toMatch(/Join\s*waitlist!/);   // two lines
    expect(note.getAttribute('aria-hidden')).toBe('true');   // the card itself is the real information
    expect(note.querySelector('svg.arrow')).not.toBeNull();
  });

  it('uses no emoji in its own words', () => {
    const text = render().el.textContent ?? '';
    expect(/\p{Extended_Pictographic}/u.test(text)).toBeFalse();
  });

  it('points out outfit planning with a handwritten note and an arrow to More', () => {
    const { el } = render();
    expect(el.querySelector('.lede')?.textContent).toContain('outfits');
    const note = el.querySelector('.outfit-note')!;
    expect(note.textContent).toMatch(/outfits/i);
    expect(note.querySelector('svg.arrow')).not.toBeNull();
    expect(note.getAttribute('aria-hidden')).toBeNull();   // read out: it's real information
    const captions = [...el.querySelectorAll('figcaption')].map(c => c.textContent ?? '');
    expect(captions.some(c => /cost|money/i.test(c))).toBeTrue();
  });

  it('says the iPhone app is coming soon, and offers only the preview and the waitlist', () => {
    const { el } = render();
    expect(el.querySelector('.app-card')?.textContent).toContain('Coming soon');
    const links = [...el.querySelectorAll<HTMLAnchorElement>('a[href]')].map(a => a.getAttribute('href'));
    expect(links).not.toContain('/signup');                     // no "Continue in browser"
    expect(links).not.toContain('/login');                      // no "Sign in"
    expect(el.textContent).not.toContain('Already have an account');
  });

  it('asks for a real email before adding someone to the launch list', async () => {
    const { fixture, el } = render();
    await fixture.whenStable();                                 // ngModel connects asynchronously
    const input = el.querySelector<HTMLInputElement>('.app-card input[type=email]')!;
    input.value = 'not-an-email'; input.dispatchEvent(new Event('input'));
    (el.querySelector('.app-card form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable(); fixture.detectChanges();
    expect(waitlist.join).not.toHaveBeenCalled();
    expect(el.querySelector('.app-card .field-error')?.textContent).toContain('email');
  });

  it('adds the email to the iPhone launch list and says so', async () => {
    const { fixture, el } = render();
    await fixture.whenStable();                                 // ngModel connects asynchronously
    const input = el.querySelector<HTMLInputElement>('.app-card input[type=email]')!;
    input.value = ' Maya@Example.com '; input.dispatchEvent(new Event('input'));
    (el.querySelector('.app-card form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable(); fixture.detectChanges();
    expect(waitlist.join).toHaveBeenCalledWith('maya@example.com');
    expect(el.querySelector('.app-card')?.textContent).toContain("You're on the list");
  });

  it('says what signing up means: launch news, occasional updates, no spam, unsubscribe any time', () => {
    const { el } = render();
    const text = el.querySelector('.app-card')?.textContent ?? '';
    expect(text).toContain('occasional updates');
    expect(text).toContain('No spam');
    expect(text).toContain('unsubscribe any time');
  });

  it('remembers someone already on the list', () => {
    waitlist.joined = () => true;
    const { el } = render();
    expect(el.querySelector('.app-card form')).toBeNull();
    expect(el.querySelector('.app-card')?.textContent).toContain("You're on the list");
  });
});
