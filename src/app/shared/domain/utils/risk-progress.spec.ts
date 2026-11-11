import { firstPendingIndex, nextPendingIndex, riskProgress } from './risk-progress';

const risk = (likelihood: number | null, impact: number | null, is_active = true) => ({ is_active, likelihood, impact });

describe('riskProgress (D89)', () => {
  it('counts a risk as evaluated only when it has both probability and impact', () => {
    const p = riskProgress([risk(3, 4), risk(null, null), risk(3, null), risk(null, 2)]);
    expect(p).toEqual({ total: 4, evaluated: 1, pending: 3, ready: false });
  });

  it('is ready when none is missing', () => {
    expect(riskProgress([risk(1, 1), risk(5, 5)])).toEqual({ total: 2, evaluated: 2, pending: 0, ready: true });
  });

  it('ignores the risks that were taken down', () => {
    expect(riskProgress([risk(2, 2), risk(null, null, false)])).toEqual({ total: 1, evaluated: 1, pending: 0, ready: true });
  });

  it('does not block a service with no active risks: there is nothing to evaluate', () => {
    expect(riskProgress([])).toEqual({ total: 0, evaluated: 0, pending: 0, ready: true });
    expect(riskProgress([risk(null, null, false)]).ready).toBeTrue();
  });
});

describe('which risk comes next (D89)', () => {
  const done = { likelihood: 3, impact: 3 };
  const todo = { likelihood: null, impact: null };

  it('starts at the first risk without an evaluation, so a person can resume where they left', () => {
    expect(firstPendingIndex([done, done, todo, todo])).toBe(2);
    expect(firstPendingIndex([todo, done])).toBe(0);
  });

  it('has no first one when nothing is missing', () => {
    expect(firstPendingIndex([done, done])).toBeNull();
    expect(firstPendingIndex([])).toBeNull();
  });

  it('goes to the next missing one after the current, and wraps to one left behind', () => {
    expect(nextPendingIndex([done, todo, done, todo], 1)).toBe(3);
    expect(nextPendingIndex([todo, done, done], 2)).toBe(0);
  });

  it('has no next one when nothing is missing', () => {
    expect(nextPendingIndex([done, done, done], 1)).toBeNull();
    expect(nextPendingIndex([], 0)).toBeNull();
  });
});