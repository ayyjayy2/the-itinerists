import { Component, Input } from '@angular/core';
import { isLetterAvatar } from '../../utils/avatar-letters';

/**
 * The thing inside an avatar circle: the member's emoji, or — when they chose
 * a letter — that letter set in the chunky display face in their letter color.
 * The circle itself (size, background color) stays with the caller.
 */
@Component({
  selector: 'app-avatar-glyph',
  template: `
    @if (isLetter) {
      <span class="letter" [style.color]="letterColor || '#3A3A3A'">{{ emoji }}</span>
    } @else {
      {{ emoji }}
    }
  `,
  styles: [`
    :host { display: contents; }
    .letter {
      font-family: var(--font-display);
      font-weight: 400;
      font-size: 1.15em;
      line-height: 1;
      -webkit-text-stroke: 0.02em currentColor;
      user-select: none;
    }
  `],
})
export class AvatarGlyphComponent {
  @Input() emoji: string | undefined = '';
  @Input() letterColor: string | undefined = '';

  get isLetter(): boolean { return isLetterAvatar(this.emoji); }
}
