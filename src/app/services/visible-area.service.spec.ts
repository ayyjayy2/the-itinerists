import { TestBed } from '@angular/core/testing';
import { VISUAL_VIEWPORT, VisibleAreaService } from './visible-area.service';

/** A stand-in for window.visualViewport: the part of the page the person can see. */
class FakeViewport extends EventTarget {
  constructor(public height: number, public offsetTop = 0) { super(); }
  move(height: number, offsetTop = 0) { this.height = height; this.offsetTop = offsetTop; this.dispatchEvent(new Event('resize')); }
}

describe('VisibleAreaService (#470)', () => {
  const root = document.documentElement.style;
  const vars = () => [root.getPropertyValue('--visible-height'), root.getPropertyValue('--visible-top')];
  afterEach(() => { root.removeProperty('--visible-height'); root.removeProperty('--visible-top'); });

  const start = (vv: FakeViewport | null) => {
    TestBed.configureTestingModule({ providers: [{ provide: VISUAL_VIEWPORT, useValue: vv }] });
    TestBed.inject(VisibleAreaService).start();
  };

  it('publishes the visible height and top as CSS variables', () => {
    start(new FakeViewport(664));
    expect(vars()).toEqual(['664px', '0px']);
  });

  it('follows the keyboard: the visible area shrinks and may scroll down', () => {
    const vv = new FakeViewport(664);
    start(vv);
    vv.move(330, 40);
    expect(vars()).toEqual(['330px', '40px']);
    vv.move(664, 0);                                   // keyboard closed
    vv.dispatchEvent(new Event('scroll'));
    expect(vars()).toEqual(['664px', '0px']);
  });

  it('sets nothing where the browser has no visual viewport (CSS falls back to the full screen)', () => {
    start(null);
    expect(vars()).toEqual(['', '']);
  });

  describe('scrolls a pop-up to the tapped field when the keyboard opens (#500)', () => {
    let host: HTMLElement;
    let card: HTMLElement;
    let input: HTMLInputElement;
    afterEach(() => host.remove());

    /** A focused field low in a 100px scrolling card, inside a pop-up or on the page. */
    const focusedField = (inPopup: boolean) => {
      host = document.createElement('div');
      if (inPopup) host.className = 'modal-backdrop';
      card = document.createElement('div');
      Object.assign(card.style, { height: '100px', overflowY: 'auto' });
      const above = document.createElement('div');
      above.style.height = '600px';
      input = document.createElement('input');
      card.append(above, input, above.cloneNode());
      host.appendChild(card);
      document.body.appendChild(host);
      input.focus({ preventScroll: true });
      card.scrollTop = 0;
    };
    const inView = () => {
      const c = card.getBoundingClientRect(), f = input.getBoundingClientRect();
      return f.top >= c.top && f.bottom <= c.bottom;
    };

    it('scrolls the pop-up down so the tapped field shows', () => {
      const vv = new FakeViewport(664);
      start(vv);
      focusedField(true);
      vv.move(330);
      expect(inView()).toBeTrue();
    });

    it('scrolls only the pop-up, never the page behind it', () => {
      const vv = new FakeViewport(664);
      start(vv);
      focusedField(true);
      const page = document.scrollingElement!.scrollTop;
      vv.move(330);
      expect(document.scrollingElement!.scrollTop).toBe(page);
    });

    it('leaves fields on the page itself alone', () => {
      const vv = new FakeViewport(664);
      start(vv);
      focusedField(false);
      vv.move(330);
      expect(card.scrollTop).toBe(0);
    });

    it('does not pull the form back while the person scrolls it', () => {
      const vv = new FakeViewport(330);
      start(vv);
      focusedField(true);
      vv.dispatchEvent(new Event('scroll'));
      expect(card.scrollTop).toBe(0);
    });
  });
});
