import { NAV_ITEMS } from '@config/navigation.config';
import { filterNavByRole } from './sidebar-groups';

// Qué menú ve cada rol (D136, D150; `modelo-datos.md` §5.5): el menú sale de `NAV_ITEMS` filtrado por rol, así que esta es la matriz del menú.
const visible = (role: string): string[] =>
  filterNavByRole(NAV_ITEMS, role).flatMap((item) => (item.subItems ? item.subItems.map((c) => c.path) : item.path ? [item.path] : []));

describe('the menu of each role (permission matrix)', () => {
  it('shows the collaborator only «Mis documentos»: no compliance, services, team, assignment, integrations nor technical control', () => {
    expect(visible('colaborador')).toEqual(['/mis-documentos']);
  });

  it('gives the administrator everything, with the document library and «Mis documentos»', () => {
    const paths = visible('admin_empresa');
    for (const p of ['/', '/mis-documentos', '/documentos', '/services', '/cumplimiento/resumen', '/cumplimiento/controles', '/equipo/personas', '/asignacion', '/integraciones']) expect(paths).toContain(p);
    // MD-529 · El administrador solo ve «Por aprobar» dentro de «Mi trabajo».
    expect(paths).toContain('/mi-trabajo');
  });

  it('gives the owner «Mi trabajo», its compliance with the summary, its team (read) and «Mis documentos», but no library, services nor integrations', () => {
    const paths = visible('responsable');
    for (const p of ['/mi-trabajo', '/mis-documentos', '/cumplimiento/resumen', '/cumplimiento/controles', '/equipo/personas', '/asignacion']) expect(paths).toContain(p);
    for (const p of ['/documentos', '/services', '/integraciones', '/']) expect(paths).not.toContain(p);
  });

  it('gives the delegate its compliance without the summary (the dashboard answers 403 to them), and «Mis documentos»', () => {
    const paths = visible('delegado');
    expect(paths).toContain('/cumplimiento/controles');
    expect(paths).toContain('/mis-documentos');
    expect(paths).toContain('/mi-trabajo');
    for (const p of ['/cumplimiento/resumen', '/documentos', '/equipo/personas', '/asignacion', '/integraciones', '/services']) expect(paths).not.toContain(p);
  });

  it('gives the auditor the library to read and the summary, but not «Mis documentos» (it does not accept, D133)', () => {
    const paths = visible('auditor');
    for (const p of ['/', '/documentos', '/cumplimiento/resumen', '/integraciones', '/responsables']) expect(paths).toContain(p);
    for (const p of ['/mis-documentos', '/equipo/personas', '/services']) expect(paths).not.toContain(p);
  });
});
