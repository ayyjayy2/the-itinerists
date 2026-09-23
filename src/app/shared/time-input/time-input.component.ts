import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { fromInputTime, toInputTime } from '../../utils/time-format';

/**
 * The app's one time picker. Wraps the native `<input type="time">` so every
 * page gets the same control, and writes the model as "h:mm AM/PM" so every
 * stored time shares the same format. Works with `[(ngModel)]` like any input;
 * a legacy value in another format ("14:30", "4:20pm") is read correctly and
 * re-saved in the canonical form the first time it is touched.
 */
@Component({
  selector: 'app-time-input',
  template: `
    <input
      type="time"
      [value]="value"
      [disabled]="disabled"
      [attr.name]="name"
      [attr.aria-label]="label"
      [attr.data-empty]="value ? null : ''"
      data-hint="Pick a time"
      (input)="onInput($any($event.target).value)"
      (blur)="onTouched()"
    />
  `,
  styles: [`
    :host { display: block; }
    input { width: 100%; }
  `],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TimeInputComponent), multi: true }],
})
export class TimeInputComponent implements ControlValueAccessor {
  @Input() name = '';
  @Input() label = 'Time';

  value = '';
  disabled = false;

  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(v: string | null | undefined): void { this.value = toInputTime(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }

  onInput(raw: string): void {
    this.value = raw;
    this.onChange(fromInputTime(raw));
  }
}
