import { UPDATE_CHECK_MIN_GAP_MS, isNewerBuild, isTyping, shouldCheckForUpdate } from './app-update';

describe('shouldCheckForUpdate', () => {
  it('checks on the first return to the screen', () => {
    expect(shouldCheckForUpdate(null, 1_000)).toBeTrue();
  });

  it('checks again only after a minute, so flicking between apps stays quiet', () => {
    expect(shouldCheckForUpdate(10_000, 10_000 + UPDATE_CHECK_MIN_GAP_MS - 1)).toBeFalse();
    expect(shouldCheckForUpdate(10_000, 10_000 + UPDATE_CHECK_MIN_GAP_MS)).toBeTrue();
  });
});

describe('isTyping', () => {
  const el = (html: string) => {
    const host = document.createElement('div');
    host.innerHTML = html;
    return host.firstElementChild as Element;
  };

  it('is true while a text field, text area, picker or editable area has focus', () => {
    expect(isTyping(el('<input type="text">'))).toBeTrue();
    expect(isTyping(el('<input>'))).toBeTrue();
    expect(isTyping(el('<input type="number">'))).toBeTrue();
    expect(isTyping(el('<textarea></textarea>'))).toBeTrue();
    expect(isTyping(el('<select></select>'))).toBeTrue();
    expect(isTyping(el('<div contenteditable="true"></div>'))).toBeTrue();
  });

  it('is false for nothing focused, the page itself, buttons and checkboxes', () => {
    expect(isTyping(null)).toBeFalse();
    expect(isTyping(document.body)).toBeFalse();
    expect(isTyping(el('<button>Save</button>'))).toBeFalse();
    expect(isTyping(el('<input type="checkbox">'))).toBeFalse();
    expect(isTyping(el('<a href="/">Home</a>'))).toBeFalse();
  });
});

describe('isNewerBuild', () => {
  it('is true only when the live build number is higher than the running one', () => {
    expect(isNewerBuild('651', '650')).toBeTrue();
    expect(isNewerBuild('1000', '999')).toBeTrue();   // compared as numbers, not text
    expect(isNewerBuild('650', '650')).toBeFalse();
    expect(isNewerBuild('649', '650')).toBeFalse();   // a rollback doesn't bounce people back
  });

  it('is false for anything that is not a build number', () => {
    expect(isNewerBuild(undefined, '650')).toBeFalse();
    expect(isNewerBuild('', '650')).toBeFalse();
    expect(isNewerBuild('<!doctype html>', '650')).toBeFalse();
    expect(isNewerBuild('651', 'dev')).toBeFalse();
  });
});
