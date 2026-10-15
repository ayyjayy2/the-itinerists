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

  describe('keeps the tapped field in view when the keyboard opens (#495)', () => {
    let host: HTMLElement;
    afterEach(() => host.remove());

    /** A field, focused, inside a pop-up (or not); scrollIntoView is watched. */
    const focusedField = (inPopup: boolean) => {
      host = document.createElement('div');
      if (inPopup) host.className = 'modal-backdrop';
      const input = document.createElement('input');
      host.appendChild(input);
      document.body.appendChild(host);
      input.focus();
      return spyOn(input, 'scrollIntoView');
    };

    it('scrolls a pop-up so the focused field shows above the keyboard', () => {
      const vv = new FakeViewport(664);
      start(vv);
      const scrolled = focusedField(true);
      vv.move(330);
      expect(scrolled).toHaveBeenCalledWith({ block: 'center' });
    });

    it('leaves fields on the page itself to the browser', () => {
      const vv = new FakeViewport(664);
      start(vv);
      const scrolled = focusedField(false);
      vv.move(330);
      expect(scrolled).not.toHaveBeenCalled();
    });

    it('does not pull the form back while the person scrolls it', () => {
      const vv = new FakeViewport(330);
      start(vv);
      const scrolled = focusedField(true);
      vv.dispatchEvent(new Event('scroll'));
      expect(scrolled).not.toHaveBeenCalled();
    });
  });
});
