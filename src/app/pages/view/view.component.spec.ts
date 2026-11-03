import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ViewComponent } from './view.component';
import { ShareViewService } from '../../services/share-view.service';
import { FirestoreResumeService } from '../../services/firestore-resume.service';

// #683: on a phone, Save as PDF did nothing for a minute or more. The button now
// shows it's working straight away, and the page's live connection is closed
// while the print sheet opens (Safari waits for open requests before showing it).
describe('ViewComponent: Save as PDF', () => {
  let calls: string[];
  const view = { tripName: 'Chiang Mai, November', dates: '', places: [], people: [], flights: { departures: [], returns: [] }, days: [], stays: [] };

  function create() {
    const log: string[] = calls = [];   // each test's own log: a print left over from another can't add to it
    const connection = {
      pause: jasmine.createSpy('pause').and.callFake(async () => { log.push('pause'); }),
      resume: jasmine.createSpy('resume').and.callFake(async () => { log.push('resume'); }),
    };
    TestBed.configureTestingModule({
      imports: [ViewComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { fragment: 'abcdefghij1234567890ab' } } },
        { provide: ShareViewService, useValue: { watch: (_t: string, next: (v: unknown) => void) => { next(view); return () => {}; } } },
        { provide: FirestoreResumeService, useValue: connection },
      ],
    });
    const fixture = TestBed.createComponent(ViewComponent);
    fixture.detectChanges();
    spyOn(window, 'print').and.callFake(() => { log.push('print'); });
    return { fixture, comp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, connection };
  }
  const button = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('.view-pdf')!;

  it('shows it is working straight away, with a note that it can take a minute', async () => {
    const { fixture, comp, el } = create();
    const printing = comp.savePdf();
    fixture.detectChanges();
    expect(button(el).textContent).toContain('Preparing PDF');
    expect(button(el).disabled).toBeTrue();
    expect(el.querySelector('.view-pdf-note')!.textContent).toContain('can take a minute');
    await printing;
    window.dispatchEvent(new Event('afterprint'));   // finish, so nothing carries into the next test
  });

  it('closes the live connection before printing, and reopens it afterwards', async () => {
    const { fixture, comp, el } = create();
    await comp.savePdf();
    expect(calls).toEqual(['pause', 'print']);
    window.dispatchEvent(new Event('afterprint'));
    await Promise.resolve();
    fixture.detectChanges();
    expect(calls).toEqual(['pause', 'print', 'resume']);
    expect(button(el).textContent).toContain('Save as PDF');
    expect(el.querySelector('.view-pdf-note')).toBeNull();
  });

  it('still prints if the connection can\'t be closed', async () => {
    const { comp, connection } = create();
    connection.pause.and.rejectWith(new Error('offline'));
    await comp.savePdf();
    expect(window.print).toHaveBeenCalled();
    window.dispatchEvent(new Event('afterprint'));
  });
});
