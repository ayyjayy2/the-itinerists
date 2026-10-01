import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { FocusService, focusDate } from './focus.service';

@Component({ template: '' }) class Blank {}

describe('FocusService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: Blank }])] });
  });

  it('reads ?focus from each navigation and clears it once consumed', async () => {
    const router = TestBed.inject(Router);
    const focus  = TestBed.inject(FocusService);
    expect(focus.id()).toBeNull();
    await router.navigateByUrl('/itinerary?focus=i1');
    expect(focus.id()).toBe('i1');
    focus.clear();
    expect(focus.id()).toBeNull();
    await router.navigateByUrl('/recs');
    expect(focus.id()).toBeNull();
  });

  it('markMissing raises the notice and drops the id; the next navigation resets the notice', async () => {
    const router = TestBed.inject(Router);
    const focus  = TestBed.inject(FocusService);
    await router.navigateByUrl('/itinerary?focus=gone');
    focus.markMissing();
    expect(focus.missing()).toBeTrue();
    expect(focus.id()).toBeNull();
    await router.navigateByUrl('/itinerary');
    expect(focus.missing()).toBeFalse();
  });
});

describe('focusDate', () => {
  const items = [{ id: 'a', date: '2026-10-03' }, { id: 'b', date: '2026-10-04' }];
  it('finds the day of the focused item', () => {
    expect(focusDate(items, 'b')).toBe('2026-10-04');
    expect(focusDate(items, 'zzz')).toBeNull();
    expect(focusDate(items, null)).toBeNull();
  });
});
