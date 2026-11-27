import { todayIso } from './today';

describe('todayIso', () => {
  it('gives the local calendar day with zero padding', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(todayIso(new Date(2026, 10, 26, 0, 1))).toBe('2026-11-26');
  });
});
