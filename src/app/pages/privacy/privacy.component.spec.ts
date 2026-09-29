import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PrivacyComponent } from './privacy.component';

describe('PrivacyComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [PrivacyComponent], providers: [provideRouter([])] }));

  it('states the essentials: what is stored, who sees it, deletion, contact', () => {
    const fixture = TestBed.createComponent(PrivacyComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    for (const phrase of ['Effective September 29, 2026', 'What the app stores', 'Who can see what', 'Delete your account', 'Open-Meteo', 'hello@theitinerists.com']) {
      expect(text).withContext(phrase).toContain(phrase);
    }
  });
});
