import { safeReturnUrl } from './safe-return-url';

describe('safeReturnUrl', () => {
  it('accepts an internal path with its query', () => {
    expect(safeReturnUrl('/integraciones/aws?tab=connections', '/services')).toBe('/integraciones/aws?tab=connections');
  });

  it('falls back when there is nothing', () => {
    expect(safeReturnUrl(null, '/services')).toBe('/services');
    expect(safeReturnUrl('', '/services')).toBe('/services');
  });

  it('rejects external, protocol-relative and scripted destinations', () => {
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', 'services', '/a\nb']) {
      expect(safeReturnUrl(bad, '/services')).toBe('/services');
    }
  });
});
