import { cleanGcpProjectNumber, isGcpProjectId, isGcpProjectNumber } from './gcp-validation';

describe('gcp-validation', () => {
  it('accepts a real project id and rejects the usual mistakes', () => {
    expect(isGcpProjectId('acme-production-42190')).toBe(true);
    expect(isGcpProjectId(' acme-prod-421905 ')).toBe(true);
    for (const bad of ['', 'Acme-Prod', 'acme_prod', '1acme-prod', 'acme-', 'abc']) expect(isGcpProjectId(bad)).toBe(false);
  });

  it('accepts only a numeric project number of a sane length', () => {
    expect(isGcpProjectNumber('407295138461')).toBe(true);
    expect(isGcpProjectNumber('12345')).toBe(false);
    expect(isGcpProjectNumber('4072-95138461')).toBe(false);
  });

  it('keeps only digits when the number is pasted', () => {
    expect(cleanGcpProjectNumber(' 4072 95138461\n')).toBe('407295138461');
  });
});
