import { controlStateTone } from './control-state-look';

describe('controlStateTone', () => {
  it('maps each control state to a status tone', () => {
    expect(controlStateTone('effective')).toBe('ok');
    expect(controlStateTone('ineffective')).toBe('bad');
    expect(controlStateTone('error')).toBe('bad');
    expect(controlStateTone('expired')).toBe('warn');
    expect(controlStateTone('incomplete')).toBe('warn');
    expect(controlStateTone('evaluating')).toBe('info');
    expect(controlStateTone('no_tests')).toBe('neutral');
  });

  it('shows an unknown or missing state as neutral', () => {
    expect(controlStateTone('brand_new')).toBe('neutral');
    expect(controlStateTone(null)).toBe('neutral');
  });
});
