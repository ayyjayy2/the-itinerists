import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AccountPromptService } from './account-prompt.service';
import { UserService } from './user.service';

/** #610: a guest's tap on a control that changes the trip asks for an account instead. */
describe('AccountPromptService', () => {
  const isGuest = signal(false);
  let prompt: AccountPromptService;
  let host: HTMLElement;
  let clicked: jasmine.Spy;

  beforeAll(() => {
    TestBed.configureTestingModule({ providers: [{ provide: UserService, useValue: { isGuest } }] });
    prompt = TestBed.inject(AccountPromptService);
    prompt.start();
  });

  beforeEach(() => {
    prompt.open.set(false);
    host = document.createElement('div');
    host.innerHTML = '<button data-needs-account><span>Add</span></button><button class="plain">Read</button>';
    document.body.appendChild(host);
    clicked = jasmine.createSpy('clicked');
    host.querySelectorAll('button').forEach(b => b.addEventListener('click', clicked));
  });
  afterEach(() => host.remove());

  it('stops a guest’s tap on a marked control and opens the sheet', () => {
    isGuest.set(true);
    host.querySelector('span')!.click();
    expect(clicked).not.toHaveBeenCalled();
    expect(prompt.open()).toBeTrue();
  });

  it('lets a guest use controls that change nothing', () => {
    isGuest.set(true);
    (host.querySelector('.plain') as HTMLElement).click();
    expect(clicked).toHaveBeenCalled();
    expect(prompt.open()).toBeFalse();
  });

  it('never gets in the way of someone with an account', () => {
    isGuest.set(false);
    (host.querySelector('[data-needs-account]') as HTMLElement).click();
    expect(clicked).toHaveBeenCalled();
    expect(prompt.open()).toBeFalse();
  });

  it('stops Enter in a marked field for a guest', () => {
    isGuest.set(true);
    const input = document.createElement('input');
    input.setAttribute('data-needs-account', '');
    const typed = jasmine.createSpy('typed');
    input.addEventListener('keydown', typed);
    host.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(typed).not.toHaveBeenCalled();
    expect(prompt.open()).toBeTrue();
  });
});
