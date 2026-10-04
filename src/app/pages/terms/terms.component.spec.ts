import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TermsComponent } from './terms.component';

describe('TermsComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [TermsComponent], providers: [provideRouter([])] }));

  it('states the essentials: age, content, travel disclaimer, deletion, governing law, contact', () => {
    const fixture = TestBed.createComponent(TermsComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    for (const phrase of ['Effective October 4, 2026', 'at least 13', 'Your content', 'not a travel agent', 'delete your account', 'State of Illinois', 'hello@theitinerists.com']) {
      expect(text).withContext(phrase).toContain(phrase);
    }
  });

  it('links to the privacy policy', () => {
    const fixture = TestBed.createComponent(TermsComponent);
    fixture.detectChanges();
    const hrefs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).map(a => a.getAttribute('href'));
    expect(hrefs).toContain('/privacy');
  });
});
