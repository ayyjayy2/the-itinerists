import { Directive, HostListener, input } from '@angular/core';

/**
 * Put on a start-date field and give it the matching end-date field:
 *
 *   <input type="date" [(ngModel)]="startDate" [appThenEndDate]="endInput" />
 *   <input #endInput type="date" [(ngModel)]="endDate" />
 *
 * When a start date is picked, the end date moves to it if it is empty or
 * earlier (so the end picker opens on the start's month, not today's), and
 * the end-date picker opens straight away.
 */
@Directive({ selector: 'input[type=date][appThenEndDate]' })
export class ThenEndDateDirective {
  readonly appThenEndDate = input.required<HTMLInputElement>();

  @HostListener('change', ['$event.target'])
  onStartPicked(start: HTMLInputElement): void {
    const end = this.appThenEndDate();
    const startValue = start.value;
    if (!startValue || !end) return;
    if (!end.value || end.value < startValue) {
      end.value = startValue;
      end.dispatchEvent(new Event('input', { bubbles: true }));   // let ngModel see it
    }
    // After the start picker has closed and the page has updated.
    setTimeout(() => {
      end.focus();
      try { end.showPicker?.(); } catch { /* needs a fresh tap on some browsers: focus is enough there */ }
    }, 0);
  }
}
