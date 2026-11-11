import { evidenceStateTone } from './evidence.models';

describe('evidenceStateTone', () => {
  it('maps the state the server computed to the status tone that goes next to its word', () => {
    expect(evidenceStateTone('compliant')).toBe('ok');
    expect(evidenceStateTone('non_compliant')).toBe('bad');
    expect(evidenceStateTone('expired')).toBe('bad');
    expect(evidenceStateTone('pending')).toBe('warn');
    expect(evidenceStateTone('in_review')).toBe('warn');
  });

  it('does not count what was never delivered as compliant or as failed', () => {
    expect(evidenceStateTone(null)).toBe('neutral');
    expect(evidenceStateTone(undefined)).toBe('neutral');
  });
});
