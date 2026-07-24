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
  map:       'M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5zM9 4v13M15 6.5v13',
  car:       'M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11M5 11h14a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0h-4a2 2 0 0 1-4 0H5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1zM7 15h.01M17 15h.01',
  sparkle:   'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  pin:       'M12 21c-4.5-3.8-7-7.2-7-10.5a7 7 0 0 1 14 0c0 3.3-2.5 6.7-7 10.5zM12 8a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
  people:    'M8.5 11a3.25 3.25 0 1 1 0-6.5 3.25 3.25 0 0 1 0 6.5zM3 19.5a5.5 5.5 0 0 1 11 0M15.5 5a3.25 3.25 0 0 1 0 6.3M17 14a5.5 5.5 0 0 1 4 5.5',
  link:      'M9.5 14.5l5-5M10.5 6.8l1.7-1.7a3.6 3.6 0 0 1 5.1 5.1l-1.7 1.7M13.5 17.2l-1.7 1.7a3.6 3.6 0 0 1-5.1-5.1l1.7-1.7',
  edit:      'M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3zM14 7l3 3',
  // Rec category icons
  food:      'M7 3v3.5a2 2 0 0 0 4 0V3M9 6.5V21M15.5 3c-1.6 1.6-1.6 5.2 0 7V21',
  drink:     'M5 5h14l-7 7.5zM12 12.5V19M8.5 19h7',
  culture:   'M3.5 9 12 4l8.5 5M5 9.5v8M9.5 9.5v8M14.5 9.5v8M19 9.5v8M3 20.5h18',
  activity:  'M2.5 19.5h19M4 19l5.5-8.5 4 5.5M10 14.5 14.5 8 20 19',
  star:      'M12 3.5l2.5 5.6 6.1.6-4.6 4 1.4 6L12 16.8 6.2 19.7l1.4-6-4.6-4 6.1-.6z',
  check:     'M5 12.5l4.5 4.5L19 7',
  inbox:     'M4 13l2.4-7.2a1 1 0 0 1 1-.7h9.2a1 1 0 0 1 1 .7L20 13M4 13v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5M4 13h4l1.5 2.5h5L16 13h4',
  camera:    'M4 8h3l1.6-2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  trash:     'M5 7h14M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M6.5 7l1 12a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1l1-12M10.5 11v6M13.5 11v6',
  eye:       'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12zM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z',
  'eye-off': 'M3 3l18 18M10.6 10.7a2.8 2.8 0 0 0 3.8 3.8M9.9 5.7A9.7 9.7 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17.9 17.9 0 0 1-3 3.9M6.5 6.7C3.8 8.3 2 12 2 12s3.6 6.5 10 6.5a10 10 0 0 0 3-.5',
  // Transportation modes
  train:     'M7 4h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM5 10h14M9 16l-2.5 4M15 16l2.5 4M9.5 13h.01M14.5 13h.01',
  bus:       'M5 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6zM5 11h14M7 21v-2M17 21v-2M8.5 14h.01M15.5 14h.01',
  boat:      'M3 14l1.5 5a1 1 0 0 0 1 .8h11a1 1 0 0 0 1-.8L20 14M4.5 14 12 11l7.5 3M12 11V6M12 6H8l4-3z',
  plus:      'M12 5v14M5 12h14',
  close:     'M6 6l12 12M18 6L6 18',
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
