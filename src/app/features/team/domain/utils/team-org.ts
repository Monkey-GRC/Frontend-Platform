import { Group } from '@features/team/domain/models/group.models';
import { TeamMember } from '@shared/domain/models/team.models';

/** Lo que se sabe de la carga de una persona cuando el Backend la entregue (MD-195): cuántos controles tiene y cuánto lleva. Mientras no llegue, el organigrama no muestra nada de esto. */
export interface OrgWorkload {
  controls: number;
  progress: { done: number; total: number } | null;
}

/** Un responsable y su equipo. `member` es nulo cuando quien mira no ve a esa persona (un responsable ve solo su equipo): entonces el nombre sale del líder del grupo. */
export interface OrgResponsible {
  id: string;
  name: string;
  member: TeamMember | null;
  team: Group | null;
  delegates: TeamMember[];
}

export interface OrgChart {
  admins: TeamMember[];
  responsibles: OrgResponsible[];
  /** Fuera de la cadena: el auditor lee, no recibe controles ni tiene equipo (D102). */
  auditors: TeamMember[];
  /** Delegados cuyo responsable no está a la vista (por ejemplo, desactivado). Se muestran aparte para que nadie desaparezca del organigrama. */
  orphans: TeamMember[];
  hiddenInactive: number;
}

const fullName = (p: { name: string | null; last_name: string | null; email?: string }): string => [p.name, p.last_name].filter(Boolean).join(' ') || p.email || '';
const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name, 'es');
const memberSort = (a: TeamMember, b: TeamMember): number => fullName(a).localeCompare(fullName(b), 'es');

/** Quien mira, si es responsable: su nodo se dibuja aunque la lista no lo traiga (un responsable ve solo su equipo, y aún puede no tener equipo). */
export interface OrgSelf {
  id: string;
  name: string | null;
  last_name: string | null;
}

/**
 * Arma el organigrama de la empresa con las personas y los grupos que ya entrega el servidor: administradores arriba, bajo cada responsable sus delegados, y los auditores aparte.
 * Es una vista: no inventa ni guarda nada. Las cuentas desactivadas se ocultan salvo que se pidan (y se cuentan, para poder decirlo).
 */
export function buildOrgChart(members: readonly TeamMember[], groups: readonly Group[], showInactive = false, self: OrgSelf | null = null): OrgChart {
  const visible = (m: TeamMember) => showInactive || m.status !== 'inactive';
  const people = members.filter(visible);
  const teams = groups.filter((g) => g.kind === 'team');

  const responsibles = new Map<string, OrgResponsible>();
  for (const m of people.filter((p) => p.role === 'responsable')) {
    responsibles.set(m.id, { id: m.id, name: fullName(m), member: m, team: teams.find((t) => t.leader.id === m.id) ?? null, delegates: [] });
  }
  // Un equipo cuyo líder no viene en la lista (un responsable que mira solo ve su equipo) también se dibuja, con el nombre del líder. Si el líder viene pero está desactivado y oculto,
  // no se dibuja: sus delegados salen aparte para que se vea que hay que moverlos.
  const known = new Set(members.map((m) => m.id));
  for (const t of teams) {
    if (!responsibles.has(t.leader.id) && !known.has(t.leader.id)) {
      responsibles.set(t.leader.id, { id: t.leader.id, name: fullName(t.leader), member: null, team: t, delegates: [] });
    }
  }

  if (self && !responsibles.has(self.id)) {
    responsibles.set(self.id, { id: self.id, name: fullName(self), member: null, team: teams.find((t) => t.leader.id === self.id) ?? null, delegates: [] });
  }

  const orphans: TeamMember[] = [];
  for (const d of people.filter((p) => p.role === 'delegado')) {
    const leaderId = d.responsible?.id ?? teams.find((t) => t.id === d.group?.id)?.leader.id;
    const node = leaderId ? responsibles.get(leaderId) : undefined;
    if (node) node.delegates.push(d);
    else orphans.push(d);
  }
  for (const node of responsibles.values()) node.delegates.sort(memberSort);

  return {
    admins: people.filter((p) => p.role === 'admin_empresa').sort(memberSort),
    responsibles: [...responsibles.values()].sort(byName),
    auditors: people.filter((p) => p.role === 'auditor').sort(memberSort),
    orphans: orphans.sort(memberSort),
    hiddenInactive: showInactive ? 0 : members.filter((m) => m.status === 'inactive').length,
  };
}
