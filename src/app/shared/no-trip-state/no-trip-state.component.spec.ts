import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NoTripStateComponent } from './no-trip-state.component';

describe('NoTripStateComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NoTripStateComponent],
      providers: [provideRouter([])],
    });
  });

  function create(page: string) {
    const fixture = TestBed.createComponent(NoTripStateComponent);
    fixture.componentRef.setInput('page', page);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows page-specific copy and both CTAs', () => {
    const el = create('itinerary');
    expect(el.textContent).toContain('This is where the plan goes');
    const setUp = el.querySelector('a.cta-main') as HTMLAnchorElement;
    const join  = el.querySelector('a.cta-join') as HTMLAnchorElement;
    expect(setUp.getAttribute('href')).toBe('/trips/new');
    expect(setUp.textContent).toContain('Set up a trip');
    expect(join.getAttribute('href')).toBe('/join');
  });

  it('picks the ghost flavour for the page', () => {
    expect(create('itinerary').querySelector('.g-day')).toBeTruthy();
    expect(create('packing').querySelector('.g-box')).toBeTruthy();
    expect(create('map').querySelector('.g-map')).toBeTruthy();
    expect(create('recs').querySelector('.g-grid')).toBeTruthy();
    expect(create('finance').querySelector('.g-dot')).toBeTruthy();
  });

  it('falls back to generic copy for an unknown page', () => {
    const el = create('mystery');
    expect(el.textContent).toContain('This fills in with a trip');
    expect(el.querySelector('.g-sq')).toBeTruthy();
  });
});
