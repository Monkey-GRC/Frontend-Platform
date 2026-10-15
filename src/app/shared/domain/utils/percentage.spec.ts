import { formatPercent, percentOf } from './percentage';

describe('percentage', () => {
  it('computes the share with whole numbers', () => {
    expect(percentOf(3, 5)).toBe(60);
    expect(percentOf(29, 100)).toBe(29);
    expect(percentOf(0, 5)).toBe(0);
    expect(percentOf(5, 5)).toBe(100);
  });

  it('truncates and never rounds up to 100 % before everything is met', () => {
    expect(percentOf(995, 1000)).toBe(99);
    expect(percentOf(199, 200)).toBe(99);
    expect(percentOf(2, 3)).toBe(66);
  });

  it('has no percentage without a total', () => {
    expect(percentOf(0, 0)).toBeNull();
    expect(percentOf(3, -1)).toBeNull();
  });

  it('stays between 0 and 100 even with inconsistent counts', () => {
    expect(percentOf(7, 5)).toBe(100);
    expect(percentOf(-2, 5)).toBe(0);
  });

  it('formats for the language and shows a dash when there is none', () => {
    expect(formatPercent(60, 'en').replace(/\s/g, '')).toBe('60%');
    expect(formatPercent(60, 'es').replace(/\s/g, '')).toBe('60%');
    expect(formatPercent(null, 'es')).toBe('—');
  });
});
