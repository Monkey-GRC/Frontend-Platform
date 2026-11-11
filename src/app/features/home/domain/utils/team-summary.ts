import { HomeTeamMember, HomeTeamRole } from '../models/team.models';

export const SUMMARY_ROLES: readonly HomeTeamRole[] = ['admin_empresa', 'responsable', 'delegado', 'auditor'];

/** Días sin ingresar a partir de los cuales una cuenta activa se cuenta como «sin ingreso reciente». Umbral operativo, pendiente de confirmar por el comité. */
export const STALE_LOGIN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface TeamSummary {
  /** Las personas que cuentan hoy: cuentas activas e invitaciones pendientes (las desactivadas y suspendidas no). */
  total: number;
  active: number;
  pending: number;
  byRole: Record<HomeTeamRole, number>;
  /** Cuentas activas sin segundo factor. Una invitación pendiente aún no puede tenerlo: no se cuenta. */
  withoutSecondFactor: number;
  /** Cuentas activas sin `last_login_at` o con el último ingreso hace más de `STALE_LOGIN_DAYS` días. */
  withoutRecentLogin: number;
  /** Cuentas suspendidas o desactivadas (no cuentan en `total`). */
  blocked: number;
  /** Administradores (`admin_empresa`) con cuenta activa. */
  activeAdmins: number;
}

// Lo que el Inicio cuenta del equipo, sobre la lista que ya devuelve `GET /v1/users`: no hay un resumen en el servidor ni se calcula nada de cumplimiento.
export function summarizeTeam(members: HomeTeamMember[], now: Date = new Date()): TeamSummary {
  const summary: TeamSummary = { total: 0, active: 0, pending: 0, byRole: { admin_empresa: 0, responsable: 0, delegado: 0, auditor: 0 }, withoutSecondFactor: 0, withoutRecentLogin: 0, blocked: 0, activeAdmins: 0 };
  const limit = now.getTime() - STALE_LOGIN_DAYS * DAY_MS;
  for (const m of members) {
    if (m.status === 'inactive' || m.status === 'suspended') {
      summary.blocked++;
      continue;
    }
    if (m.status !== 'active' && m.status !== 'pending') continue;
    summary.total++;
    summary.byRole[m.role]++;
    if (m.status === 'pending') summary.pending++;
    else {
      summary.active++;
      if (!m.mfaEnabled) summary.withoutSecondFactor++;
      if (m.role === 'admin_empresa') summary.activeAdmins++;
      const last = m.lastLoginAt ? Date.parse(m.lastLoginAt) : NaN;
      if (Number.isNaN(last) || last < limit) summary.withoutRecentLogin++;
    }
  }
  return summary;
}
