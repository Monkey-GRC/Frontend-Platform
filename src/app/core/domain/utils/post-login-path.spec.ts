import { postLoginPath } from './post-login-path';

describe('postLoginPath', () => {
  it('sends only the company admin with the context pending to the onboarding', () => {
    expect(postLoginPath('admin_empresa', { next_step: 'organizational_context' })).toBe('/onboarding');
  });

  it('sends every other role to the home, even with the context pending', () => {
    for (const role of ['responsable', 'delegado', 'auditor', null, undefined]) {
      expect(postLoginPath(role, { next_step: 'organizational_context' })).toBe('/');
    }
  });

  it('sends the admin to the home when nothing is pending', () => {
    expect(postLoginPath('admin_empresa', { next_step: null })).toBe('/');
    expect(postLoginPath('admin_empresa', null)).toBe('/');
    expect(postLoginPath('admin_empresa', undefined)).toBe('/');
  });
});
