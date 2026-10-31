import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PrivacyComponent } from './privacy.component';

describe('PrivacyComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [PrivacyComponent], providers: [provideRouter([])] }));

  it('states the essentials: what is stored, who sees it, deletion, contact', () => {
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    for (const phrase of ['Effective October 31, 2026', 'what the weather was on the trip', 'only changes what each person', 'stay with the trip', 'kept after you delete your account', 'stay addresses', 'iPhone app launches', 'What the app stores', 'Who can see what', 'Delete your account', 'Open-Meteo', 'OpenStreetMap tiles', 'OpenFreeMap', 'your account id', 'Cookies and storage', 'Your rights', 'hello@theitinerists.com']) {
      expect(text).withContext(phrase).toContain(phrase);
    }
  });

  it('links to the terms of service', () => {
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();
    const hrefs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).map(a => a.getAttribute('href'));
    expect(hrefs).toContain('/terms');
  });
});
