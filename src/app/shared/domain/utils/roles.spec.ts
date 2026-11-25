import { COMPLIANCE_ROLES, DOCUMENT_LIBRARY_ROLES, MY_DOCUMENTS_ROLES, canSeeComplianceSummary, isAssignedRole, isCollaborator, isCompanyAdmin, landingPath } from './roles';

const ALL = ['admin_empresa', 'responsable', 'delegado', 'auditor', 'colaborador', 'admin_monkey'] as const;
const NOBODY = ['', null, undefined];
const only = (fn: (r: string | null | undefined) => boolean): string[] => ALL.filter((r) => fn(r));

describe('roles (preguntas puras sobre el rol)', () => {
  it('recognises the company administrator and nobody else', () => {
    expect(isCompanyAdmin('admin_empresa')).toBe(true);
    for (const r of ['responsable', 'delegado', 'auditor', 'colaborador', 'admin_monkey', ...NOBODY]) expect(isCompanyAdmin(r)).toBe(false);
  });

  it('recognises the assigned roles (responsable and delegado)', () => {
    expect(isAssignedRole('responsable')).toBe(true);
    expect(isAssignedRole('delegado')).toBe(true);
    for (const r of ['admin_empresa', 'auditor', 'colaborador', ...NOBODY]) expect(isAssignedRole(r)).toBe(false);
  });

  it('recognises the collaborator and nobody else', () => {
    expect(isCollaborator('colaborador')).toBe(true);
    for (const r of ['admin_empresa', 'responsable', 'delegado', 'auditor', 'admin_monkey', ...NOBODY]) expect(isCollaborator(r)).toBe(false);
  });

  it('follows the permission matrix: the collaborator never sees compliance, and the delegate no longer gets the summary', () => {
    expect([...COMPLIANCE_ROLES]).toEqual(['admin_empresa', 'responsable', 'delegado', 'auditor']);
    expect(only(canSeeComplianceSummary)).toEqual(['admin_empresa', 'responsable', 'auditor']);
    for (const r of NOBODY) expect(canSeeComplianceSummary(r)).toBe(false);
  });

  it('gives the document library to the administrator and the auditor, and «Mis documentos» to whoever can accept (never the auditor)', () => {
    expect([...DOCUMENT_LIBRARY_ROLES]).toEqual(['admin_empresa', 'auditor']);
    expect([...MY_DOCUMENTS_ROLES]).toEqual(['admin_empresa', 'responsable', 'delegado', 'colaborador']);
  });

  it('lands each role on its own screen', () => {
    expect(landingPath('responsable')).toBe('/mi-trabajo');
    expect(landingPath('delegado')).toBe('/mi-trabajo');
    expect(landingPath('colaborador')).toBe('/mis-documentos');
    for (const r of ['admin_empresa', 'auditor', ...NOBODY]) expect(landingPath(r)).toBe('/');
  });
});
