import { Component, Input } from '@angular/core';

/**
 * Custom line-icon set (Design Phase 2) — 2.2px round strokes, drawn on a
 * 24×24 grid, coloured via `currentColor`. Replaces the emoji section icons.
 * Each icon is a single SVG path; add new ones to ICON_PATHS by name.
 */
const ICON_PATHS: Record<string, string> = {
  home:      'M3 10.5 12 3l9 7.5M5 9.7V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.7M9.5 21v-6h5v6',
  trips:     'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-1.8 5.2-5.2 1.8 1.8-5.2z',
  flights:   'M21 3 3 10.5l7.5 3M21 3l-6 18-4.5-7.5M21 3 10.5 13.5',
  itinerary: 'M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM4 10h16M8 3v4M16 3v4',
  stays:     'M3 21h18M5 21V6a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v15M16 21v-8h3a1 1 0 0 1 1 1v7M8.5 9h1M12.5 9h1M8.5 13h1M12.5 13h1',
  finance:   'M9 4a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM16.8 8a5.5 5.5 0 1 1-6.9 8.4',
  expenses:  'M6 3h12v18l-2-1.5-2 1.5-2-1.5L10 21l-2-1.5L6 21zM9.5 8h5M9.5 12h5M9.5 16h3',
  recs:      'M12 9.5V4M12 14.5V20M9.8 10.2 5.5 6.5M14.2 13.8l4.3 3.7M9.8 13.8 5.5 17.5M14.2 10.2l4.3-3.7M12 12m-2.5 0a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0',
  packing:   'M5 8h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M9 8v12M15 8v12',
  outfits:   'M12 7a2 2 0 1 1 2-2M12 7v1.8l8.2 5.7a1.4 1.4 0 0 1-.8 2.5H4.6a1.4 1.4 0 0 1-.8-2.5L12 8.8',
  settings:  'M4 7h6M16 7h4M4 17h4M12 17h8M16 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0M12 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  profile:   'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4.5 21a7.5 7.5 0 0 1 15 0',
  admin:     'M12 3l7 3v5.5c0 4.3-3 7.6-7 8.5-4-.9-7-4.2-7-8.5V6z',
  more:      'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
};

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" [attr.stroke-width]="strokeWidth"
         stroke-linecap="round" stroke-linejoin="round"
         [style.width.px]="size" [style.height.px]="size" aria-hidden="true">
      <path [attr.d]="d" />
    </svg>
  `,
})
export class IconComponent {
  @Input() name = '';
  @Input() size = 24;
  @Input() strokeWidth = 2.2;

  get d(): string {
    return ICON_PATHS[this.name] ?? '';
  }
}
