/**
 * The pop-up keyboard checks browser tests can't make (#500, #502): on the
 * iPhone, tapping a field brings up the real keyboard and the app may scroll
 * the page to reveal it. The header and tab bar must stay put, and the tapped
 * field must show above the keyboard.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { openApp } from './session.mjs';

let app;
before(async () => { app = await openApp(); });
after(async () => { await app?.close(); });

/** Where things are on screen, read from inside the app's page. */
const measure = () => app.driver.execute(() => {
  const r = (el) => { const b = el?.getBoundingClientRect(); return b && { top: b.top, bottom: b.bottom }; };
  const field = document.activeElement;
  return {
    scrollY: window.scrollY,
    vvTop: window.visualViewport?.offsetTop ?? 0,
    innerHeight,
    visible: window.visualViewport?.height ?? innerHeight,
    header: r(document.querySelector('.app-header')),
    tabs: r(document.querySelector('nav.tab-bar')),
    field: r(field),
    card: r(document.querySelector('.modal-backdrop > *')),
    // Is the pop-up on top at its top and bottom edges, or does a bar cover it?
    uncovered: (() => {
      const card = document.querySelector('.modal-backdrop > *');
      if (!card) return null;
      const b = card.getBoundingClientRect(), x = (b.left + b.right) / 2;
      return [b.top + 8, b.bottom - 8].map(y => card.contains(document.elementFromPoint(x, y)));
    })(),
    focusedTag: field?.tagName,
  };
});

test('tapping Notes in the add-flight pop-up keeps the header put and shows Notes above the keyboard', async () => {
  const { driver } = app;
  await driver.execute(() => location.assign('/flights'));
  const add = await driver.$('button=+ Add Flight');
  await add.waitForDisplayed({ timeout: 20000 });
  await add.click();

  const before = await measure();                           // the demo build's banner sits above the header

  // Scroll the pop-up to Notes, as a person would, then tap it like a finger.
  await driver.execute(() => {
    const card = document.querySelector('.modal-backdrop > *');
    card.scrollTop = card.scrollHeight;
  });
  await app.native();
  const notes = await driver.$('-ios predicate string:placeholderValue == "e.g. Window seat confirmed"');
  await notes.waitForDisplayed({ timeout: 10000 });
  await notes.click();
  await driver.waitUntil(() => driver.isKeyboardShown(), { timeout: 10000, timeoutMsg: 'the keyboard never came up' });
  await driver.pause(1200);                                   // let the keyboard finish sliding in
  await app.shot('notes-keyboard');
  await app.page();

  const m = await measure();
  if (process.env.DEBUG_MOBILE) {
    console.log('measured', JSON.stringify(m));
    await driver.pause(2000);
    console.log('2s later', JSON.stringify(await measure()));
  }
  assert.equal(m.focusedTag && ['INPUT', 'TEXTAREA'].includes(m.focusedTag), true, 'Notes is focused');
  assert.equal(m.scrollY, 0, `the page scrolled by ${m.scrollY}px (the header and tab bar moved)`);
  assert.ok(Math.abs(m.header.top - before.header.top) < 1, `the header moved from ${before.header.top}px to ${m.header.top}px`);
  assert.ok(m.card.top >= m.header.bottom + 11, `the pop-up starts at ${Math.round(m.card.top)}px, under the header (ends ${Math.round(m.header.bottom)}px)`);
  assert.ok(m.field.top >= 0 && m.field.bottom <= m.visible,
    `Notes is at ${Math.round(m.field.top)}–${Math.round(m.field.bottom)}px, the visible part ends at ${Math.round(m.visible)}px`);
});

test('closing the keyboard with ✓ leaves the pop-up between the header and the tab bar (#497)', async () => {
  const { driver } = app;
  const before = await measure();
  await app.native();
  const done = await driver.$('~Done');
  if (await done.isExisting()) await done.click(); else await driver.hideKeyboard();
  await driver.waitUntil(async () => !(await driver.isKeyboardShown()), { timeout: 10000, timeoutMsg: 'the keyboard stayed up' });
  await driver.pause(1200);
  await app.shot('keyboard-closed');
  await app.page();

  const m = await measure();
  assert.equal(m.scrollY, 0, `the page scrolled by ${m.scrollY}px`);
  assert.deepEqual(m.uncovered, [true, true], `the pop-up's top/bottom edge is covered: ${JSON.stringify(m.uncovered)}`);
  assert.ok(m.card.top >= m.header.bottom + 11, `the pop-up starts at ${Math.round(m.card.top)}px, under the header (ends ${Math.round(m.header.bottom)}px)`);
  assert.ok(m.card.bottom <= m.tabs.top - 11, `the pop-up ends at ${Math.round(m.card.bottom)}px, under the tab bar (starts ${Math.round(m.tabs.top)}px)`);
  assert.ok(Math.abs(m.header.top - before.header.top) < 1, `the header moved from ${before.header.top}px to ${m.header.top}px`);
});

test('tapping from field to field never moves the page, not even for a moment (#507)', async () => {
  const { driver } = app;
  // Record every page scroll before anything can put it back (document listeners run before window ones).
  await driver.execute(() => {
    window.__pageScrolls = [];
    document.addEventListener('scroll', () => window.__pageScrolls.push(Math.round(scrollY)), true);
  });
  await app.native();
  for (const placeholder of ['e.g. ORD', 'e.g. Delta', 'e.g. DL 123', 'e.g. Window seat confirmed']) {
    // Scroll the pop-up (only the pop-up) so the field is in view, as a person would.
    await app.page();
    await driver.execute((p) => {
      const f = document.querySelector(`[placeholder="${p}"]`), card = f.closest('.modal-backdrop > *');
      const c = card.getBoundingClientRect(), b = f.getBoundingClientRect();
      card.scrollTop += b.top - c.top - 40;
    }, placeholder);
    await app.native();
    const field = await driver.$(`-ios predicate string:placeholderValue == "${placeholder}"`);
    await field.click();
    await driver.pause(900);
    await app.page();
    { const got = await driver.execute(() => document.activeElement?.getAttribute('placeholder') ?? document.activeElement?.tagName); assert.equal(got, placeholder, `tapped ${placeholder}, focus is on ${got}`); }
    await app.native();
  }
  await app.shot('field-to-field');
  await app.page();
  const scrolls = await driver.execute(() => window.__pageScrolls);
  assert.deepEqual(scrolls.filter(y => y !== 0), [], `the page moved: ${JSON.stringify(scrolls)}`);
});

test('a drag that starts on a field scrolls the form without focusing the field (#507)', async () => {
  const { driver } = app;
  await app.native();
  const done = await driver.$('~Done');
  if (await done.isExisting()) await done.click(); else await driver.hideKeyboard();
  await driver.pause(800);
  const field = await driver.$('-ios predicate string:placeholderValue == "e.g. Delta"');
  const { x, y, width, height } = await field.getElementRect(field.elementId);
  const cx = Math.round(x + width / 2), cy = Math.round(y + height / 2);
  await driver.action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x: cx, y: cy }).down().pause(80).move({ x: cx, y: cy - 150, duration: 300 }).up().perform();
  await driver.pause(800);
  await app.page();
  const focused = await driver.execute(() => document.activeElement?.getAttribute('placeholder') ?? null);
  assert.notEqual(focused, 'e.g. Delta', 'the drag focused the field it started on');
});
