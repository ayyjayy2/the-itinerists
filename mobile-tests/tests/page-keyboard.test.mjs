/**
 * Fields on a page, outside a pop-up (#513): the app puts the page back
 * whenever the phone scrolls it (#501), so the page's own scroller must bring a
 * tapped field above the keyboard. Checked on the sign-in page's password.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { openApp } from './session.mjs';

let app;
before(async () => { app = await openApp(); });
after(async () => { await app?.close(); });

test('tapping the password on the sign-in page shows it above the keyboard (#513)', async () => {
  const { driver } = app;
  await driver.execute(() => location.assign('/login'));
  await app.native();
  const password = await driver.$('-ios predicate string:placeholderValue == "Enter your password"');
  await password.waitForDisplayed({ timeout: 20000 });
  await password.click();
  await driver.waitUntil(() => driver.isKeyboardShown(), { timeout: 10000, timeoutMsg: 'the keyboard never came up' });
  await driver.pause(1200);                                   // let the keyboard finish sliding in
  await app.shot('signin-password');
  await app.page();

  const m = await driver.execute(() => {
    const b = document.activeElement?.getBoundingClientRect();
    const screen = document.querySelector('.auth-screen');
    return { id: document.activeElement?.id, top: b?.top, bottom: b?.bottom, scrollY,
      screenBottom: screen?.getBoundingClientRect().bottom, scrolls: screen ? screen.scrollHeight > screen.clientHeight : false,
      visible: window.visualViewport?.height ?? innerHeight, innerHeight };
  });
  if (process.env.DEBUG_MOBILE) console.log('measured', JSON.stringify(m));
  assert.equal(m.id, 'password', 'the password field is focused');
  assert.equal(m.scrollY, 0, `the page scrolled by ${m.scrollY}px`);
  // The screen ends at the keyboard, so a finger can scroll the whole form into view
  // (#513: on an iPhone the form couldn't scroll at all).
  assert.ok(m.screenBottom <= m.visible + 1, `the sign-in screen ends at ${Math.round(m.screenBottom)}px, under the keyboard (visible part ends at ${Math.round(m.visible)}px)`);
  assert.ok(m.scrolls, 'the sign-in form can scroll');
  assert.ok(m.top >= 0 && m.bottom <= m.visible,
    `the password is at ${Math.round(m.top)}–${Math.round(m.bottom)}px, the visible part ends at ${Math.round(m.visible)}px`);
});

test('the keyboard bar\'s next arrow moves from the email to the password (#516)', async () => {
  const { driver } = app;
  await app.page();
  await driver.execute(() => { document.activeElement?.blur(); location.assign('/login'); });
  await app.native();
  const email = await driver.$('-ios predicate string:placeholderValue == "you@example.com"');
  await email.waitForDisplayed({ timeout: 20000 });
  await email.click();
  await driver.waitUntil(() => driver.isKeyboardShown(), { timeout: 10000, timeoutMsg: 'the keyboard never came up' });
  await driver.pause(1000);
  await email.addValue('maya@example.com');                    // typed first, as people do (#516)
  await driver.pause(800);
  if (process.env.DEBUG_MOBILE) console.log('bar', JSON.stringify(await driver.execute('mobile: source', { format: 'description' })).match(/Button[^\n]{0,120}/g)?.slice(0, 12));
  const next = await driver.$('-ios predicate string:type == "XCUIElementTypeButton" AND (name == "Next" OR label == "Next" OR name == "Next Field")');
  await next.click();
  await driver.pause(1200);
  await app.shot('next-arrow');
  await app.page();
  const m = await driver.execute(() => {
    const b = document.activeElement?.getBoundingClientRect();
    return { id: document.activeElement?.id, bottom: b?.bottom, visible: window.visualViewport?.height ?? innerHeight };
  });
  if (process.env.DEBUG_MOBILE) console.log('after next', JSON.stringify(m));
  assert.equal(m.id, 'password', 'the next arrow moved to the password');
  assert.ok(m.bottom <= m.visible, `the password ends at ${Math.round(m.bottom)}px, the visible part at ${Math.round(m.visible)}px`);
});
