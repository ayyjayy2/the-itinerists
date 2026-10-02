import { calendarNote } from './itinerary.component';

describe('calendarNote', () => {
  it('says what happened in Calendar', () => {
    expect(calendarNote({ kind: 'synced', added: 5, updated: 0, removed: 0 })).toBe('In Calendar: added 5.');
    expect(calendarNote({ kind: 'synced', added: 1, updated: 2, removed: 1 })).toBe('In Calendar: added 1, updated 2, removed 1.');
    expect(calendarNote({ kind: 'synced', added: 0, updated: 0, removed: 0 })).toBe('Calendar is already up to date.');
    expect(calendarNote({ kind: 'no-access' })).toContain('Settings');
    expect(calendarNote({ kind: 'downloaded' })).toContain('Downloaded');
  });
});
