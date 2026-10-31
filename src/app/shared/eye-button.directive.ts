import { Directive } from '@angular/core';

/**
 * A password field's eye button (`button.eye-btn`) shows or hides what was
 * typed without taking focus from the field: on a phone, the field losing
 * focus closes the keyboard mid-password (#645). Stopping the press's default
 * keeps focus where it is; the click still toggles.
 */
@Directive({
  selector: 'button.eye-btn',
  host: { '(mousedown)': '$event.preventDefault()' },
})
export class EyeButtonDirective {}
