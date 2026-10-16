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
    visible: window.visualViewport?.height ?? innerHeight,
    header: r(document.querySelector('.app-header')),
    field: r(field),
    focusedTag: field?.tagName,
  };
});

test('tapping Notes in the add-flight pop-up keeps the header put and shows Notes above the keyboard', async () => {
  const { driver } = app;
  await driver.execute(() => location.assign('/flights'));
  const add = await driver.$('button=+ Add Flight');
  await add.waitForDisplayed({ timeout: 20000 });
  await add.click();

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
  assert.equal(m.focusedTag && ['INPUT', 'TEXTAREA'].includes(m.focusedTag), true, 'Notes is focused');
  assert.equal(m.scrollY, 0, `the page scrolled by ${m.scrollY}px (the header and tab bar moved)`);
  assert.ok(Math.abs(m.header.top) < 1, `the header moved to ${m.header.top}px`);
  assert.ok(m.field.top >= 0 && m.field.bottom <= m.visible,
    `Notes is at ${Math.round(m.field.top)}–${Math.round(m.field.bottom)}px, the visible part ends at ${Math.round(m.visible)}px`);
});
