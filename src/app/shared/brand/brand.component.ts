import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

let uid = 0;

/**
 * Getaway Club brand lockup (DP2-8): the "4b" passport-stamp mark (dashed/inner
 * ring lettered "GETAWAY CLUB · EST 2026 ·" with a sage leaf) + the wordmark
 * ("getaway" in Caprasimo over/next to "club" in Nunito, lavender).
 *
 * `variant="inline"` for chrome (header/sidebar); `variant="stacked"` for the
 * big auth screens. `[mark]` sizes the stamp in px. The working name isn't
 * final — change the copy here to rebrand app-wide.
 */
@Component({
  selector: 'app-brand',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="brand" [class.stacked]="variant === 'stacked'">
      <svg class="brand-mark" [style.width.px]="mark" [style.height.px]="mark"
           viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <defs><path [attr.id]="ringId" d="M24 7.5a16.5 16.5 0 1 1 0 33 16.5 16.5 0 0 1 0-33"/></defs>
        <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="1.7"/>
        <circle cx="24" cy="24" r="11.6" stroke="currentColor" stroke-width="1.7"/>
        <text font-family="Nunito, sans-serif" font-size="5.4" font-weight="800"
              fill="currentColor" letter-spacing="1.1">
          <textPath [attr.href]="'#' + ringId">GETAWAY CLUB · EST 2026 ·</textPath>
        </text>
        <path d="M29.5 18.8c-6.2 0-9.9 3.3-9.9 8.3 1-3.6 3.4-5.9 7.2-7-3.4 2-5.5 4.5-6.2 7.8 5.7.9 8.9-3.3 8.9-9.1z"
              fill="currentColor"/>
      </svg>
      @if (showWordmark) {
        <span class="wordmark">
          <span class="wm-getaway">getaway</span><span class="wm-club">club</span>
        </span>
      }
    </span>
  `,
  styles: [`
    .brand { display: inline-flex; align-items: center; gap: 0.5rem; }
    .brand.stacked { flex-direction: column; gap: 0.55rem; }
    .brand-mark { color: var(--primary-dark); flex-shrink: 0; }
    .wordmark { display: inline-flex; align-items: baseline; gap: 0.32rem; line-height: 1; }
    .brand.stacked .wordmark { flex-direction: column; align-items: center; gap: 0.15rem; }
    .wm-getaway { font-family: var(--font-display); font-size: 1.15rem; color: var(--text); line-height: 1; }
    .wm-club {
      font-family: var(--font); font-weight: 800; font-size: 0.68rem;
      letter-spacing: 0.2em; text-transform: uppercase; color: var(--lavender-dark);
    }
    .brand.stacked .wm-getaway { font-size: 2.1rem; }
    .brand.stacked .wm-club { font-size: 0.9rem; letter-spacing: 0.42em; }
  `],
})
export class BrandComponent {
  @Input() mark = 28;
  @Input() variant: 'inline' | 'stacked' = 'inline';
  @Input() showWordmark = true;

  readonly ringId = `gc-ring-${uid++}`;
}
