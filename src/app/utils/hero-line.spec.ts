import { heroLine } from './hero-line';

const leg = (destination: string, startDate: string, endDate: string) => ({ destination, startDate, endDate } as any);
const legs = [leg('Panama, Panama', '2026-10-01', '2026-10-05'), leg('Costa Rica', '2026-10-06', '2026-10-09'), leg('Guatemala', '2026-10-09', '2026-10-15')];
const trip = { destination: 'Panama, Panama', name: 'Central America Tour', startDate: '2026-10-01', endDate: '2026-10-15' };

describe('heroLine', () => {
  it('names the first stop before the trip', () => {
    expect(heroLine(trip, legs, '2026-09-20')).toBe('Ready for Panama? ✨');
  });
  it('follows the stop you are in during the trip', () => {
    expect(heroLine(trip, legs, '2026-10-02')).toBe('Enjoy Panama ✨');
    expect(heroLine(trip, legs, '2026-10-07')).toBe('Enjoy Costa Rica ✨');
  });
  it('on a travel day inside two stops, names the one you are heading to', () => {
    expect(heroLine(trip, legs, '2026-10-09')).toBe('Enjoy Guatemala ✨');
  });
  it('a one-stop trip uses its destination', () => {
    expect(heroLine({ ...trip, destination: 'Lisbon, Portugal' }, [leg('Lisbon, Portugal', '2026-10-01', '2026-10-15')], '2026-10-03')).toBe('Enjoy Lisbon ✨');
  });
  it('after the trip, welcomes you back', () => {
    expect(heroLine(trip, legs, '2026-10-20')).toBe('Back from Panama ✨');
  });
  it('without dates, stays on the ready line', () => {
    expect(heroLine({ destination: 'Bali' }, [], '2026-10-02')).toBe('Ready for Bali? ✨');
  });
});
