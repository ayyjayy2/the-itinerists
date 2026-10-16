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
    return { id: document.activeElement?.id, top: b?.top, bottom: b?.bottom, scrollY,
      visible: window.visualViewport?.height ?? innerHeight, innerHeight };
  });
  if (process.env.DEBUG_MOBILE) console.log('measured', JSON.stringify(m));
  assert.equal(m.id, 'password', 'the password field is focused');
  assert.equal(m.scrollY, 0, `the page scrolled by ${m.scrollY}px`);
  assert.ok(m.top >= 0 && m.bottom <= m.visible,
    `the password is at ${Math.round(m.top)}–${Math.round(m.bottom)}px, the visible part ends at ${Math.round(m.visible)}px`);
});
