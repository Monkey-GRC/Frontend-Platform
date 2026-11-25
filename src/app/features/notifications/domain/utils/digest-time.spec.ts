import { digestLocalTime } from './digest-time';

describe('digestLocalTime', () => {
  const day = new Date('2026-12-16T00:00:00Z');

  it('turns the UTC hour into the hour of the browser zone', () => {
    const expected = new Intl.DateTimeFormat('es', { hour: 'numeric', minute: '2-digit' }).format(new Date(Date.UTC(2026, 11, 16, 12, 0)));
    expect(digestLocalTime('12:00', 'es', day)).toBe(expected);
  });

  it('is empty when the text is not an hour', () => {
    expect(digestLocalTime('', 'es', day)).toBe('');
    expect(digestLocalTime(null, 'es', day)).toBe('');
    expect(digestLocalTime('25:00', 'es', day)).toBe('');
    expect(digestLocalTime('noon', 'es', day)).toBe('');
  });
});
