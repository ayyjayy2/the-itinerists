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
      expect(v.loop).toBeTrue();
      expect(v.hasAttribute('playsinline')).toBeTrue();
      expect(v.getAttribute('poster')).toBeTruthy();
    }
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

  it('says the iPhone app is coming soon, and the browser link is the quiet option', () => {
    const { el } = render();
    expect(el.querySelector('.app-card')?.textContent).toContain('Coming soon');
    const browser = el.querySelector<HTMLAnchorElement>('a.continue-browser')!;
    expect(browser.getAttribute('href')).toBe('/signup');
    expect(browser.classList.contains('btn')).toBeFalse();     // a link, not a button
    expect(el.querySelector<HTMLAnchorElement>('a.sign-in')!.getAttribute('href')).toBe('/login');
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

  it('remembers someone already on the list', () => {
    waitlist.joined = () => true;
    const { el } = render();
    expect(el.querySelector('.app-card form')).toBeNull();
    expect(el.querySelector('.app-card')?.textContent).toContain("You're on the list");
  });
});
