import { TeamMember } from '@shared/domain/models/team.models';
import { AssignedPerson, AssignmentItem } from '../models/assignment.models';

/** El nombre de una persona asignada; sin nombre, `fallback` (nunca un hueco). */
export function personName(person: Pick<AssignedPerson, 'name' | 'last_name'> | null, fallback: string): string {
  return person ? [person.name, person.last_name].filter(Boolean).join(' ').trim() || fallback : fallback;
}

const isVigent = (m: TeamMember): boolean => m.status === 'active' || m.status === 'pending';

/** Quién puede ser dueño: los responsables vigentes y el propio administrador (`meId`, solo si quien asigna es administrador). */
export function ownerCandidates(members: readonly TeamMember[], meId: string | null): TeamMember[] {
  return members.filter((m) => isVigent(m) && (m.role === 'responsable' || (m.role === 'admin_empresa' && m.id === meId)));
}

/** Los delegados vigentes del equipo del responsable que pregunta (el servidor ya acota la lista a su equipo). */
export function vigentDelegates(members: readonly TeamMember[]): TeamMember[] {
  return members.filter((m) => m.role === 'delegado' && isVigent(m));
}

/** Los delegados vigentes del equipo de un dueño (`responsible` es el líder del equipo del delegado). */
export function teamDelegates(members: readonly TeamMember[], ownerId: string): TeamMember[] {
  return members.filter((m) => m.role === 'delegado' && isVigent(m) && m.responsible?.id === ownerId);
}

/**
 * Qué se puede hacer al delegar los controles elegidos (D150): el ejecutor debe ser un delegado del equipo del dueño de **cada** control. Con un solo dueño, se elige entre
 * los delegados de su equipo; con dueños distintos no hay un delegado que sirva a todos, y un control sin dueño solo admite quitar el ejecutor. En ambos casos solo se puede quitar.
 */
export type DelegationScope =
  | { kind: 'team'; ownerId: string; ownerName: string }
  | { kind: 'remove_only'; reason: 'no_owner' | 'mixed_owners' };

export function delegationScope(rows: readonly AssignmentItem[], fallbackName: string): DelegationScope {
  if (rows.some((r) => r.owner === null)) return { kind: 'remove_only', reason: 'no_owner' };
  const owners = new Map<string, AssignedPerson>();
  for (const r of rows) if (r.owner) owners.set(r.owner.id, r.owner);
  const [owner, ...others] = [...owners.values()];
  if (!owner || others.length > 0) return { kind: 'remove_only', reason: 'mixed_owners' };
  return { kind: 'team', ownerId: owner.id, ownerName: personName(owner, fallbackName) };
}
