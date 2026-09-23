import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ALL_LETTERS, isLetterAvatar, starterLetters } from '../../utils/avatar-letters';
import { BACKGROUND_COLORS, LETTER_COLORS, pickLetterColor } from '../../utils/avatar-contrast';

export const EMOJI_OPTIONS: readonly string[] = [
  '🌸','🌿','✨','🦋','🐘','🌼','🍑','🌺','🦊','🐬',
  '🌙','⭐','🎵','🌈','🦁','🐻','🌻','🍀','🦅','🐙',
];

/** Avatar background choices — see `BACKGROUND_COLORS` for the palette itself. */
export const COLOR_OPTIONS: readonly string[] = BACKGROUND_COLORS;

/** How many letters show in the icon grid before "More". */
const STARTER_COUNT = 6;

/**
 * Avatar picker shared by signup, join, and profile. One icon grid holds the
 * emoji options followed by a few letters (initials first) and a "More"
 * toggle for the whole alphabet; then the background color; then, when a
 * letter is chosen, its color. Every shade stays selectable — the first time a
 * letter is picked with no color set, the most readable shade is chosen as a
 * starting point, and after that the choice is entirely the person's.
 *
 * The chosen emoji *or* letter lives in the same `avatarEmoji` field, so every
 * avatar circle in the app renders either one on the chosen color unchanged.
 * Two-way bindable via `[(emoji)]`, `[(color)]` and `[(letterColor)]`.
 * Pass `taken` to grey out options another member already uses.
 */
@Component({
  selector: 'app-avatar-picker',
  imports: [CommonModule],
  templateUrl: './avatar-picker.component.html',
  styleUrl: './avatar-picker.component.scss',
})
export class AvatarPickerComponent {
  @Input() set emoji(value: string) { this.emojiSig.set(value ?? ''); }
  @Output() emojiChange = new EventEmitter<string>();

  @Input() set color(value: string) { this.colorSig.set(value ?? ''); }
  @Output() colorChange = new EventEmitter<string>();

  @Input() set letterColor(value: string | undefined) { this.letterColorSig.set(value ?? ''); }
  @Output() letterColorChange = new EventEmitter<string>();

  /** Display name, used to put the person's initials first among the letters. */
  @Input() set name(value: string) { this.nameSig.set(value ?? ''); }

  /** Emoji / letters other members already use — shown disabled. */
  @Input() taken: ReadonlySet<string> = new Set();

  readonly emojiOptions = EMOJI_OPTIONS;
  readonly colorOptions = COLOR_OPTIONS;
  readonly letterColorOptions = LETTER_COLORS;

  readonly emojiSig       = signal('');
  readonly colorSig       = signal('');
  readonly letterColorSig = signal('');
  private readonly nameSig = signal('');
  readonly showAllLetters  = signal(false);

  readonly letters = computed(() =>
    this.showAllLetters() ? ALL_LETTERS : starterLetters(this.nameSig(), STARTER_COUNT));

  readonly isLetter = computed(() => isLetterAvatar(this.emojiSig()));

  isTaken(opt: string): boolean { return this.taken.has(opt); }

  pick(opt: string): void {
    if (this.isTaken(opt)) return;
    this.emojiSig.set(opt);
    this.emojiChange.emit(opt);
    if (isLetterAvatar(opt) && !this.letterColorSig()) this.defaultLetterColor();
  }

  pickColor(c: string): void {
    this.colorSig.set(c);
    this.colorChange.emit(c);
  }

  pickLetterColor(c: string): void {
    this.letterColorSig.set(c);
    this.letterColorChange.emit(c);
  }

  toggleLetters(): void { this.showAllLetters.update(v => !v); }

  /** First letter pick with no color yet: start from the shade that reads best on the background. */
  private defaultLetterColor(): void {
    const next = pickLetterColor(this.colorSig() || '#FFFFFF', '');
    this.letterColorSig.set(next);
    this.letterColorChange.emit(next);
  }
}
