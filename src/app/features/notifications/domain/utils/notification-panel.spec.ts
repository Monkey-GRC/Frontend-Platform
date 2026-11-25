import { makeNotification } from '@features/notifications/testing/notification-fixtures';
import { RECENT_DAYS, groupByRecency, titleParts } from './notification-panel';

describe('notification panel utils', () => {
  const now = Date.parse('2026-12-20T12:00:00Z');

  it('puts the notices of the last days in «recent» and the rest in «older», keeping their order', () => {
    const a = makeNotification({ id: 'a', created_at: '2026-12-20T09:00:00Z' });
    const b = makeNotification({ id: 'b', created_at: '2026-12-10T09:00:00Z' });
    const c = makeNotification({ id: 'c', created_at: new Date(now - RECENT_DAYS * 24 * 3600 * 1000).toISOString() });
    const groups = groupByRecency([a, b, c], now);
    expect(groups.recent.map((n) => n.id)).toEqual(['a', 'c']);
    expect(groups.older.map((n) => n.id)).toEqual(['b']);
  });

  it('keeps a notice with an unreadable date among the recent ones (never hides it)', () => {
    expect(groupByRecency([makeNotification({ created_at: 'x' })], now).recent.length).toBe(1);
  });

  it('splits the control code from the rest of the title', () => {
    expect(titleParts(makeNotification())).toEqual({ code: 'IAC-12', text: 'La ventana trimestral cierra el 31/12/2026 y falta evidencia' });
  });

  it('leaves the title whole when it does not start with the control code or there is no control', () => {
    expect(titleParts(makeNotification({ title: 'Otro aviso' }))).toEqual({ code: null, text: 'Otro aviso' });
    expect(titleParts(makeNotification({ control: null }))).toEqual({ code: null, text: 'IAC-12 · La ventana trimestral cierra el 31/12/2026 y falta evidencia' });
  });
});
