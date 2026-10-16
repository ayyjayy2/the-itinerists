import { TestBed } from '@angular/core/testing';
import { IS_NATIVE_APP, VISUAL_VIEWPORT, VisibleAreaService } from './visible-area.service';

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

  describe('keeps the page still in the iPhone app (#500)', () => {
    const page = document.scrollingElement as HTMLElement;
    let tall: HTMLElement;
    beforeEach(() => {
      tall = document.createElement('div');
      tall.style.height = '5000px';
      document.body.appendChild(tall);
      page.style.overflow = 'auto';                                    // the test page can scroll at all
      document.body.style.overflow = 'visible';
    });
    afterEach(() => {
      TestBed.resetTestingModule();                                    // stops the service's listeners
      tall.remove();
      page.style.overflow = '';
      document.body.style.overflow = '';
      page.scrollTop = 0;
    });

    const startAs = (native: boolean) => {
      TestBed.configureTestingModule({ providers: [
        { provide: VISUAL_VIEWPORT, useValue: new FakeViewport(innerHeight) },
        { provide: IS_NATIVE_APP, useValue: native },
      ] });
      TestBed.inject(VisibleAreaService).start();
    };
    const scrolledBy = async (px: number) => {
      const fired = new Promise(r => addEventListener('scroll', r, { once: true }));
      page.scrollTop = px;
      await fired;                                                       // the service's listener ran first
      return page.scrollTop;
    };

    it('puts the page back when the phone scrolls it to reveal a field', async () => {
      startAs(true);
      expect(await scrolledBy(334)).toBe(0);
    });

    it('leaves the website to the browser', async () => {
      startAs(false);
      expect(await scrolledBy(334)).toBe(334);
    });
  });

  describe('the room between the header and the tab bar (#497)', () => {
    const chrome = () => [root.getPropertyValue('--chrome-top'), root.getPropertyValue('--chrome-bottom')];
    let bars: HTMLElement[] = [];
    afterEach(() => {
      bars.forEach(b => b.remove());
      bars = [];
      root.removeProperty('--chrome-top');
      root.removeProperty('--chrome-bottom');
    });

    /** A bar fixed at the top or bottom of the screen, like the app's header and tab bar. */
    const bar = (edge: 'top' | 'bottom', height: number) => {
      const el = document.createElement('div');
      Object.assign(el.style, { position: 'fixed', left: '0', right: '0', [edge]: '0', height: `${height}px` });
      document.body.appendChild(el);
      bars.push(el);
      return el;
    };

    const startWithBars = (vv: FakeViewport) => {
      start(vv);
      TestBed.inject(VisibleAreaService).setChrome(bar('top', 60), bar('bottom', 70));
    };

    it('publishes how much of the visible area the header and tab bar cover', () => {
      startWithBars(new FakeViewport(innerHeight));
      expect(chrome()).toEqual(['60px', '70px']);
    });

    it('drops the tab bar once the keyboard covers it', () => {
      const vv = new FakeViewport(innerHeight);
      startWithBars(vv);
      vv.move(innerHeight - 300);
      expect(chrome()).toEqual(['60px', '0px']);
    });

    it('counts only the part of the header still in view when the visible area moves down', () => {
      const vv = new FakeViewport(innerHeight);
      startWithBars(vv);
      vv.move(innerHeight - 300, 40);
      expect(chrome()[0]).toBe('20px');
    });

    it('is zero without a header or tab bar (sign-in pages, the menu layout)', () => {
      start(new FakeViewport(innerHeight));
      TestBed.inject(VisibleAreaService).setChrome(null, null);
      expect(chrome()).toEqual(['0px', '0px']);
    });
  });

  describe('focuses a tapped pop-up field without scrolling the page (#507)', () => {
    let host: HTMLElement;
    afterEach(() => { TestBed.resetTestingModule(); host?.remove(); });

    const startAs = (native: boolean) => {
      TestBed.configureTestingModule({ providers: [
        { provide: VISUAL_VIEWPORT, useValue: new FakeViewport(innerHeight) },
        { provide: IS_NATIVE_APP, useValue: native },
      ] });
      TestBed.inject(VisibleAreaService).start();
    };
    /** A field of the given type, in a pop-up or on the page; focus() is watched. */
    const field = (type: string, inPopup = true) => {
      host = document.createElement('div');
      if (inPopup) host.className = 'modal-backdrop';
      const el = document.createElement(type === 'textarea' ? 'textarea' : 'input');
      if (el instanceof HTMLInputElement) el.type = type;
      host.appendChild(el);
      document.body.appendChild(host);
      return { el, focus: spyOn(el, 'focus').and.callThrough() };
    };
    /** A finger down at (10, 10) and up `moved` px lower; whether the tap's default was cancelled. */
    const touch = (el: HTMLElement, moved = 0) => {
      const at = (y: number) => new Touch({ identifier: 1, target: el, clientX: 10, clientY: y });
      el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [at(10)], changedTouches: [at(10)] }));
      const end = new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], changedTouches: [at(10 + moved)] });
      el.dispatchEvent(end);
      return end.defaultPrevented;
    };

    it('focuses a tapped text field itself, without scrolling', () => {
      startAs(true);
      for (const type of ['text', 'textarea']) {
        const { el, focus } = field(type);
        expect(touch(el)).withContext(type).toBeTrue();
        expect(focus).withContext(type).toHaveBeenCalledWith({ preventScroll: true });
        host.remove();
      }
    });

    it('leaves a drag that starts on a field to scroll the form', () => {
      startAs(true);
      const { el, focus } = field('text');
      expect(touch(el, 40)).toBeFalse();
      expect(focus).not.toHaveBeenCalled();
    });

    it('leaves pickers, page fields and the website to the browser', () => {
      startAs(true);
      for (const [type, inPopup] of [['date', true], ['time', true], ['checkbox', true], ['text', false]] as const) {
        const { el, focus } = field(type, inPopup);
        expect(touch(el)).withContext(`${type} ${inPopup}`).toBeFalse();
        expect(focus).not.toHaveBeenCalled();
        host.remove();
      }
      TestBed.resetTestingModule();
      startAs(false);
      const { el, focus } = field('text');
      expect(touch(el)).toBeFalse();
      expect(focus).not.toHaveBeenCalled();
    });
  });
});

