import { TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { SurveyPopupComponent } from './survey-popup.component';
import { SurveyService } from '../../services/survey.service';

describe('SurveyPopupComponent', () => {
  let survey: { config: WritableSignal<any>; popupOpen: WritableSignal<boolean>; take: jasmine.Spy; closePopup: jasmine.Spy };

  beforeEach(() => {
    survey = {
      config: signal({ id: 's1', active: true, url: 'https://example.com/form', title: 'Hi, I made this', body: 'How did it go?', bannerText: 'Got 5 minutes?' }),
      popupOpen: signal(false),
      take: jasmine.createSpy('take'), closePopup: jasmine.createSpy('closePopup'),
    };
    TestBed.configureTestingModule({
      imports: [SurveyPopupComponent],
      providers: [{ provide: SurveyService, useValue: survey }],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(SurveyPopupComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows nothing until the pop-up is due', () => {
    expect(render().querySelector('.survey-popup')).toBeNull();
  });

  it('shows the wording, a link to the survey and a close button', () => {
    survey.popupOpen.set(true);
    const pop = render().querySelector('.survey-popup')!;
    expect(pop.getAttribute('role')).toBe('dialog');
    expect(pop.textContent).toContain('Hi, I made this');
    expect(pop.textContent).toContain('How did it go?');
    const link = pop.querySelector<HTMLAnchorElement>('a.btn')!;
    expect(link.href).toBe('https://example.com/form');
    expect(link.target).toBe('_blank');
    link.addEventListener('click', e => e.preventDefault());   // stay on the test page
    link.click();
    expect(survey.take).toHaveBeenCalled();
  });

  it('closes with the X, handing over to the banner', () => {
    survey.popupOpen.set(true);
    (render().querySelector('.survey-popup button[aria-label=Close]') as HTMLButtonElement).click();
    expect(survey.closePopup).toHaveBeenCalled();
  });
});
