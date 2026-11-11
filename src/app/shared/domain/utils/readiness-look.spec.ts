import { readinessLook } from './readiness-look';

describe('readinessLook', () => {
  it('gives each of the four levels its own label key', () => {
    expect(readinessLook('ready').labelKey).toBe('COMMON.READINESS.LABEL.READY');
    expect(readinessLook('almost_ready').labelKey).toBe('COMMON.READINESS.LABEL.ALMOST_READY');
    expect(readinessLook('needs_work').labelKey).toBe('COMMON.READINESS.LABEL.NEEDS_WORK');
    expect(readinessLook('not_measured').labelKey).toBe('COMMON.READINESS.LABEL.NOT_MEASURED');
  });

  it('maps the four levels to the design-system tones, «Sin medir» being neutral and not a failure', () => {
    expect(readinessLook('ready').tone).toBe('ok');
    expect(readinessLook('almost_ready').tone).toBe('warn');
    expect(readinessLook('needs_work').tone).toBe('bad');
    expect(readinessLook('not_measured').tone).toBe('neutral');
  });

  it('treats an unknown or empty value as «Sin medir», never as a failure', () => {
    for (const value of ['something_new', null, undefined, '']) {
      const look = readinessLook(value);
      expect(look.level).toBe('not_measured');
      expect(look.tone).toBe('neutral');
    }
  });

  it('explains each level in plain language (hint key)', () => {
    expect(readinessLook('not_measured').hintKey).toBe('COMMON.READINESS.HINT.NOT_MEASURED');
    expect(readinessLook('needs_work').hintKey).toBe('COMMON.READINESS.HINT.NEEDS_WORK');
  });
});
