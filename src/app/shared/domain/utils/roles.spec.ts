import { isAssignedRole, isCompanyAdmin } from './roles';

describe('roles (preguntas puras sobre el rol)', () => {
  it('recognises the company administrator and nobody else', () => {
    expect(isCompanyAdmin('admin_empresa')).toBe(true);
    for (const r of ['responsable', 'delegado', 'auditor', 'admin_monkey', '', null, undefined]) expect(isCompanyAdmin(r)).toBe(false);
  });

  it('recognises the assigned roles (responsable and delegado)', () => {
    expect(isAssignedRole('responsable')).toBe(true);
    expect(isAssignedRole('delegado')).toBe(true);
    for (const r of ['admin_empresa', 'auditor', '', null, undefined]) expect(isAssignedRole(r)).toBe(false);
  });
});
