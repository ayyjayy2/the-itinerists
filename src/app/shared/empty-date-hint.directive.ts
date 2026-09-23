import { Directive, ElementRef, HostListener, Optional, inject, AfterViewInit, DestroyRef } from '@angular/core';
import { NgControl } from '@angular/forms';

/**
 * Marks a native date/time input with `data-empty` while it has no value, so
 * the stylesheet can draw a "Pick a date" hint inside it. Needed on iOS, where
 * removing the native appearance (so the field can shrink to fit its column)
 * also removes Safari's own mm/dd/yyyy hint.
 */
@Directive({ selector: 'input[type=date], input[type=time]' })
export class EmptyDateHintDirective implements AfterViewInit {
  private el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  constructor(@Optional() private control: NgControl | null) {}

  ngAfterViewInit(): void {
    const input = this.el.nativeElement;
    if (!input.dataset['hint']) {
      input.dataset['hint'] = input.type === 'time' ? 'Pick a time' : 'Pick a date';
    }
    // ngModel writes the initial value a tick later; check after that.
    queueMicrotask(() => this.sync());
    const sub = this.control?.valueChanges?.subscribe(() => queueMicrotask(() => this.sync()));
    if (sub) this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  @HostListener('input') @HostListener('change') onInput(): void { this.sync(); }

  private sync(): void {
    const input = this.el.nativeElement;
    if (input.value) delete input.dataset['empty'];
    else input.dataset['empty'] = '';
  }
}
