import type { StatusTone } from '@shared/domain/models/status-tone.model';
import type { ChangeRequestStatus, ControlManagementState, ManagementAction, ManagementPerson } from '../models/control.models';

const TONES: Record<ControlManagementState, StatusTone> = {
  approved: 'ok',
  owner_approved: 'info',
  pending_approval: 'info',
  in_progress: 'neutral',
  returned: 'warn',
  non_compliant: 'bad',
};

/** Tono del chip de gestión; un valor que el backend agregue y no se conozca sale neutro. */
export function managementTone(state: string | null | undefined): StatusTone {
  return TONES[state as ControlManagementState] ?? 'neutral';
}

/** «Nombre Apellido» de quien aprobó o devolvió; «—» si no hay nada que mostrar. */
export function personLabel(person: Pick<ManagementPerson, 'name' | 'last_name'> | null | undefined): string {
  return [person?.name, person?.last_name].filter(Boolean).join(' ') || '—';
}

/** ¿Está la acción entre las que el servidor dejó hacer ahora? (`allowed_actions`; el servidor vuelve a comprobar cada escritura.) */
export function can(actions: readonly ManagementAction[] | null | undefined, action: ManagementAction): boolean {
  return !!actions && actions.includes(action);
}

/** El tono del chip de una solicitud (nivel, plan, «No aplica»): por aprobar es de atención, aprobada ok, rechazada mala. */
export function requestTone(status: ChangeRequestStatus | string): StatusTone {
  return status === 'approved' ? 'ok' : status === 'rejected' ? 'bad' : status === 'pending' ? 'warn' : 'neutral';
}

const CONFLICT_CODES = [
  'CONTROL_NOT_COMPLIANT', 'OWNER_APPROVAL_REQUIRED', 'ALREADY_APPROVED', 'NOTHING_TO_RETURN', 'TEST_NOT_MANUAL', 'LEVEL_OVERRIDE_PENDING', 'LAST_APPLICABLE_REQUIREMENT', 'ALREADY_DECIDED', 'REQUEST_NO_LONGER_VALID',
] as const;

/** La clave i18n del texto de un 409 de este flujo; `null` si el código no tiene texto propio (entonces se usa el mensaje del servidor). */
export function approvalErrorKey(code: string | null): string | null {
  return CONFLICT_CODES.some((c) => c === code) ? `COMPLIANCE.APPROVAL.ERR.${code}` : null;
}

/** Un 409 que dice que el control ya cambió: la vista se vuelve a pedir. */
export function isStaleConflict(code: string | null): boolean {
  return code === 'CONTROL_NOT_COMPLIANT' || code === 'ALREADY_APPROVED' || code === 'NOTHING_TO_RETURN' || code === 'OWNER_APPROVAL_REQUIRED' || code === 'LEVEL_OVERRIDE_PENDING' || code === 'ALREADY_DECIDED' || code === 'REQUEST_NO_LONGER_VALID';
}
