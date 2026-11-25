// Preguntas sobre el rol de la sesión, en un solo lugar. Funciones puras: aceptan lo que entrega la sesión (`string | null | undefined`)
// y no importan nada de features ni de auth. El backend vuelve a comprobar cada permiso; esto solo decide qué se muestra.

import type { UserRole } from '@core/domain/models/auth.models';

export const COMPANY_ADMIN_ROLE: UserRole = 'admin_empresa';
// Qué roles reciben la vista técnica: el auditor (D63, SEG-54) y el administrador de la empresa (D81, D96; mientras no se definan los permisos por pantalla, P3),
// que que es quien conoce el cumplimiento y necesita ver todo lo que cada control pide (pruebas incluidas). Debe coincidir con
// `TECHNICAL_ROLES` del backend (`view-access.ts`), que responde 403 a `?view=technical` para cualquier otro rol.
export const TECHNICAL_VIEW_ROLES: readonly UserRole[] = ['auditor', 'admin_empresa'];

/** Quien declara el contexto de la empresa (el backend responde 403 al resto). */
export const ONBOARDING_ROLE: UserRole = COMPANY_ADMIN_ROLE;

// La matriz de permisos (D136, D150; `modelo-datos.md` §5.5): qué roles entran a cada área. El colaborador no entra a ninguna de las de cumplimiento (SEG-85):
// solo a «Mis documentos» y a sus Ajustes. Estas listas alimentan el menú y los guards de las rutas, para que no se contradigan.
/** Cumplimiento (riesgos, causas, controles, evidencias, exclusiones) y Servicios en lectura: cada rol ve lo suyo, el servidor acota. */
export const COMPLIANCE_ROLES: readonly UserRole[] = ['admin_empresa', 'responsable', 'delegado', 'auditor'];
/** El Resumen de cumplimiento (el tablero): el delegado ya no lo recibe (`403`, D136). */
export const COMPLIANCE_SUMMARY_ROLES: readonly UserRole[] = ['admin_empresa', 'responsable', 'auditor'];
/** Documentos de la empresa (lista, detalle y versiones): el administrador, y el auditor en solo lectura. */
export const DOCUMENT_LIBRARY_ROLES: readonly UserRole[] = ['admin_empresa', 'auditor'];
/** «Mis documentos»: quien puede recibir una asignación y aceptarla. El auditor no acepta (D133). */
export const MY_DOCUMENTS_ROLES: readonly UserRole[] = ['admin_empresa', 'responsable', 'delegado', 'colaborador'];
/** Equipo (personas, grupos, organigrama): el administrador y el responsable (su equipo). */
export const TEAM_ROLES: readonly UserRole[] = ['admin_empresa', 'responsable'];

const ASSIGNED_ROLES: readonly UserRole[] = ['responsable', 'delegado'];

type RoleLike = string | null | undefined;

const isOneOf = (roles: readonly UserRole[], role: RoleLike): boolean => role != null && roles.some((r) => r === role);

/** Administrador de la empresa (`admin_empresa`). */
export function isCompanyAdmin(role: RoleLike): boolean {
  return role === COMPANY_ADMIN_ROLE;
}

/** Responsable o delegado: ven solo lo que se les asignó (D102). */
export function isAssignedRole(role: RoleLike): boolean {
  return isOneOf(ASSIGNED_ROLES, role);
}

/** Colaborador: solo lee y acepta los documentos que le asignan (D136). */
export function isCollaborator(role: RoleLike): boolean {
  return role === 'colaborador';
}

/** ¿Puede este rol declarar el contexto de la empresa (onboarding)? */
export function canDeclareCompanyContext(role: RoleLike): boolean {
  return role === ONBOARDING_ROLE;
}

/** ¿Recibe el Resumen de cumplimiento del servicio? El delegado no (`403`, D136). */
export function canSeeComplianceSummary(role: RoleLike): boolean {
  return isOneOf(COMPLIANCE_SUMMARY_ROLES, role);
}

/** La pantalla de entrada del rol (la misma que decide `workLandingGuard`): el responsable y el delegado, «Mi trabajo»; el colaborador, «Mis documentos»; el resto, el inicio. */
export function landingPath(role: RoleLike): string {
  if (isAssignedRole(role)) return '/mi-trabajo';
  if (isCollaborator(role)) return '/mis-documentos';
  return '/';
}
