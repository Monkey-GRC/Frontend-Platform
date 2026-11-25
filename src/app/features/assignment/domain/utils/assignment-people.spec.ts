import { TeamMember } from '@shared/domain/models/team.models';
import { AssignedPerson, AssignmentItem } from '../models/assignment.models';
import { delegationScope, ownerCandidates, personName, teamDelegates, vigentDelegates } from './assignment-people';

const member = (over: Partial<TeamMember>): TeamMember => ({
  id: 'u', email: 'u@x.co', name: 'Ana', last_name: 'Ríos', role: 'responsable', status: 'active', is_mfa_enabled: true, last_login_at: null, created_at: '2026-01-01', ...over,
});
const person = (id: string): AssignedPerson => ({ id, name: 'Ana', last_name: 'Ríos', role: 'responsable' });
const row = (owner: AssignedPerson | null): AssignmentItem => ({
  client_control_id: 'c', code: 'IAC-1', requirement_codes: [], name: 'n', service: { id: 's', name: 'S' }, categories: [], assignment: owner ? 'assigned' : 'unassigned', owner, executor: null, state: 'effective',
});

describe('assignment-people', () => {
  it('names a person, and never leaves a gap', () => {
    expect(personName({ name: 'Ana', last_name: 'Ríos' }, '—')).toBe('Ana Ríos');
    expect(personName({ name: null, last_name: null }, 'Sin nombre')).toBe('Sin nombre');
    expect(personName(null, 'Sin nombre')).toBe('Sin nombre');
  });

  it('offers as owner the active or pending responsible people and the administrator themselves, never another administrator or a delegate', () => {
    const members = [
      member({ id: 'r1' }), member({ id: 'r2', status: 'pending' }), member({ id: 'r3', status: 'inactive' }),
      member({ id: 'a1', role: 'admin_empresa' }), member({ id: 'a2', role: 'admin_empresa' }), member({ id: 'd1', role: 'delegado' }),
    ];
    expect(ownerCandidates(members, 'a1').map((m) => m.id)).toEqual(['r1', 'r2', 'a1']);
    expect(ownerCandidates(members, null).map((m) => m.id)).toEqual(['r1', 'r2']);
  });

  it('offers as delegates the active delegates of the team of that owner', () => {
    const members = [
      member({ id: 'd1', role: 'delegado', responsible: { id: 'r1', name: 'A', last_name: 'B' } }),
      member({ id: 'd2', role: 'delegado', responsible: { id: 'r2', name: 'A', last_name: 'B' } }),
      member({ id: 'd3', role: 'delegado', status: 'inactive', responsible: { id: 'r1', name: 'A', last_name: 'B' } }),
      member({ id: 'r1' }),
    ];
    expect(teamDelegates(members, 'r1').map((m) => m.id)).toEqual(['d1']);
    expect(vigentDelegates(members).map((m) => m.id)).toEqual(['d1', 'd2']);
  });

  it('delegates only inside the team of one owner: a single owner opens the team, different owners or none only allow removing', () => {
    expect(delegationScope([row(person('r1')), row(person('r1'))], '—')).toEqual({ kind: 'team', ownerId: 'r1', ownerName: 'Ana Ríos' });
    expect(delegationScope([row(person('r1')), row(person('r2'))], '—')).toEqual({ kind: 'remove_only', reason: 'mixed_owners' });
    expect(delegationScope([row(person('r1')), row(null)], '—')).toEqual({ kind: 'remove_only', reason: 'no_owner' });
  });
});
