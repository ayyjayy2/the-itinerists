import { Pipe, PipeTransform } from '@angular/core';
import { normalizeTime } from '../utils/time-format';

/** Shows any stored time string as "h:mm AM/PM", so old hand-typed values match the picker's format. */
@Pipe({ name: 'time12' })
export class Time12Pipe implements PipeTransform {
  transform(value: string | undefined | null): string { return normalizeTime(value ?? ''); }
}
