import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

// #464: the strip above the header (status bar, browser chrome) follows the theme's header colour.
describe('ThemeService: top-of-screen colour', () => {
  let style: HTMLStyleElement;
  let meta: HTMLMetaElement;

  beforeEach(() => {
    style = document.createElement('style');
    style.textContent = `:root { --surface: #FFFFFF; } [data-theme="golden-hour"] { --surface: #F1E4C8; }`;
    document.head.appendChild(style);
    meta = document.querySelector('meta[name="theme-color"]') ?? Object.assign(document.createElement('meta'), { name: 'theme-color' });
    meta.content = '#8BAF7C';
    document.head.appendChild(meta);
    try { localStorage.removeItem('tripplanner_theme'); } catch { /* fine */ }
  });

  afterEach(() => { style.remove(); document.documentElement.removeAttribute('data-theme'); });

  it("sets the browser's theme colour to the theme's header colour, and follows a change", () => {
    const themes = TestBed.inject(ThemeService);
    TestBed.tick();
    expect(meta.content.toUpperCase()).toBe('#FFFFFF');
    themes.set('golden-hour');
    TestBed.tick();
    expect(meta.content.toUpperCase()).toBe('#F1E4C8');
  });
});
