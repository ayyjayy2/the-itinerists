import { activityText, timeAgo, unseenActivityCount } from './activity';
import { ActivityLogEntry } from '../models/trip.models';

function entry(over: Partial<ActivityLogEntry>): ActivityLogEntry {
  return {
    id: 'e1', action: 'member_added', targetUid: 't', targetName: 'Tess',
    performedByUid: 'p', performedByName: 'Pat', timestamp: 1000, ...over,
  };
}

describe('activityText', () => {
  it('describes a join', () => {
    expect(activityText(entry({}))).toBe('Tess joined the trip');
  });
});

describe('timeAgo', () => {
  it('formats minutes/hours/days against a supplied now', () => {
    const now = 1_000_000_000;
    expect(timeAgo(now - 5 * 60_000, now)).toBe('5m ago');
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(timeAgo(now - 2 * 86_400_000, now)).toBe('2d ago');
  });
});

describe('unseenActivityCount', () => {
  const entries = [
    entry({ id: 'a', performedByUid: 'me',    timestamp: 300 }),
    entry({ id: 'b', performedByUid: 'other', timestamp: 200 }),
    entry({ id: 'c', performedByUid: 'other', timestamp: 100 }),
  ];

  it('counts only others’ entries newer than lastSeenAt', () => {
    expect(unseenActivityCount(entries, 'me', 150)).toBe(1);  // only b
  });

  it('treats absent lastSeenAt (0) as everything-by-others unseen', () => {
    expect(unseenActivityCount(entries, 'me', 0)).toBe(2);    // b and c
  });
});
