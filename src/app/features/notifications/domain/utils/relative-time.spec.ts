import { relativeTime } from './relative-time';

describe('relativeTime', () => {
  const now = Date.parse('2026-12-16T12:00:00Z');

  it('says «ahora» under a minute (a clock a little ahead too) and counts minutes, hours and days after that', () => {
    expect(relativeTime('2026-12-16T11:59:40Z', 'es', now)).toBe('ahora');
    expect(relativeTime('2026-12-16T11:55:00Z', 'es', now)).toBe('hace 5 minutos');
    expect(relativeTime('2026-12-16T09:00:00Z', 'es', now)).toBe('hace 3 horas');
    expect(relativeTime('2026-12-13T12:00:00Z', 'es', now)).toBe('hace 3 días');
    expect(relativeTime('2026-12-15T11:00:00Z', 'es', now)).toBe('ayer');
  });

  it('follows the language', () => {
    expect(relativeTime('2026-12-16T11:55:00Z', 'en', now)).toBe('5 minutes ago');
  });

  it('is empty for a missing or unreadable value', () => {
    expect(relativeTime(null, 'es', now)).toBe('');
    expect(relativeTime('not a date', 'es', now)).toBe('');
  });

  it('never goes into the future when the clock of the server is a bit ahead', () => {
    expect(relativeTime('2026-12-16T12:00:30Z', 'en', now)).toBe('now');
  });
});
