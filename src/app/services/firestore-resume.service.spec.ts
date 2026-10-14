import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { FirestoreResumeService } from './firestore-resume.service';
import { RECONNECT_AFTER_HIDDEN_MS } from '../utils/firestore-resume';

describe('FirestoreResumeService', () => {
  let service: FirestoreResumeService;
  let visibility: DocumentVisibilityState;
  let now: number;
  let calls: string[];

  function show(state: DocumentVisibilityState): void {
    visibility = state;
    document.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(() => {
    visibility = 'visible';
    now = 1_000_000;
    calls = [];
    spyOnProperty(document, 'visibilityState', 'get').and.callFake(() => visibility);
    spyOn(Date, 'now').and.callFake(() => now);
    TestBed.configureTestingModule({ providers: [{ provide: Firestore, useValue: {} }] });
    service = TestBed.inject(FirestoreResumeService);
    spyOn<any>(service, 'goOffline').and.callFake(async () => { calls.push('offline'); });
    spyOn<any>(service, 'goOnline').and.callFake(async () => { calls.push('online'); });
    service.start();
  });

  afterEach(() => service.stop());

  it('restarts the connection when the app comes back after a long time hidden', async () => {
    show('hidden');
    now += RECONNECT_AFTER_HIDDEN_MS + 1;
    show('visible');
    await service.settled;
    expect(calls).toEqual(['offline', 'online']);
  });

  it('leaves the connection alone after a quick switch away and back', async () => {
    show('hidden');
    now += 1_000;
    show('visible');
    await service.settled;
    expect(calls).toEqual([]);
  });

  it('turns the connection back on even if turning it off failed', async () => {
    (service as any).goOffline.and.callFake(async () => { calls.push('offline'); throw new Error('boom'); });
    show('hidden');
    now += RECONNECT_AFTER_HIDDEN_MS + 1;
    show('visible');
    await service.settled;
    expect(calls).toEqual(['offline', 'online']);
  });

  it('restarts once per return, not again on the next visible event', async () => {
    show('hidden');
    now += RECONNECT_AFTER_HIDDEN_MS + 1;
    show('visible');
    await service.settled;
    show('visible');
    await service.settled;
    expect(calls).toEqual(['offline', 'online']);
  });

  it('does nothing once stopped', async () => {
    service.stop();
    show('hidden');
    now += RECONNECT_AFTER_HIDDEN_MS + 1;
    show('visible');
    await service.settled;
    expect(calls).toEqual([]);
  });
});
