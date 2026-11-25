import { earliestPeriodEnd, periodProblem } from './evaluation-period';

describe('evaluation period rules', () => {
  it('the earliest end is start + 6 months − 1 day', () => {
    expect(earliestPeriodEnd('2026-01-01', 6)).toBe('2026-06-30');
    expect(earliestPeriodEnd('2026-03-15', 6)).toBe('2026-09-14');
  });

  it('does not overflow into the next month when the day does not exist', () => {
    expect(earliestPeriodEnd('2026-08-31', 6)).toBe('2027-02-27');
  });

  it('an invalid date gives no minimum', () => {
    expect(earliestPeriodEnd('nope', 6)).toBe('');
  });

  it('is silent while a date is missing', () => {
    expect(periodProblem(6, '', '2026-12-31')).toBeNull();
    expect(periodProblem(6, '2026-01-01', '')).toBeNull();
  });

  it('the end must be after the start, in any framework', () => {
    expect(periodProblem(null, '2026-05-01', '2026-05-01')).toBe('range');
    expect(periodProblem(6, '2026-12-31', '2026-01-01')).toBe('range');
  });

  it('with a 6 month minimum, under it is too short; exactly 6 months is fine', () => {
    expect(periodProblem(6, '2026-01-01', '2026-06-29')).toBe('too_short');
    expect(periodProblem(6, '2026-01-01', '2026-06-30')).toBeNull();
    expect(periodProblem(null, '2026-01-01', '2026-02-01')).toBeNull();
  });
});
