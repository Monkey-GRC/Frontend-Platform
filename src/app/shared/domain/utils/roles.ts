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

const ASSIGNED_ROLES: readonly UserRole[] = ['responsable', 'delegado'];

type RoleLike = string | null | undefined;

/** Administrador de la empresa (`admin_empresa`). */
export function isCompanyAdmin(role: RoleLike): boolean {
  return role === COMPANY_ADMIN_ROLE;
}

/** Responsable o delegado: ven solo lo que se les asignó (D102). */
export function isAssignedRole(role: RoleLike): boolean {
  return role != null && ASSIGNED_ROLES.some((r) => r === role);
}

/** ¿Puede este rol declarar el contexto de la empresa (onboarding)? */
export function canDeclareCompanyContext(role: RoleLike): boolean {
  return role === ONBOARDING_ROLE;
}
