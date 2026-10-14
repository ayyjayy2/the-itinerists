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
});
