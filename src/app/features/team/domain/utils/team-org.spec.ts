import { Group } from '@features/team/domain/models/group.models';
import { TeamMember, TeamRole, TeamStatus } from '@shared/domain/models/team.models';
import { buildOrgChart } from './team-org';

const member = (id: string, role: TeamRole, name: string, over: Partial<TeamMember> = {}): TeamMember => ({
  id, email: `${id}@acme.co`, name, last_name: 'Pérez', role, status: 'active', is_mfa_enabled: true, last_login_at: null, created_at: '2026-10-01T00:00:00Z', ...over,
});
const team = (id: string, leader: TeamMember, name = `Equipo de ${leader.name}`): Group => ({
  id, name, kind: 'team', leader: { id: leader.id, name: leader.name, last_name: leader.last_name, role: 'responsable' }, members_count: 0,
});
const delegate = (id: string, name: string, of: TeamMember, g: Group, status: TeamStatus = 'active') => member(id, 'delegado', name, { status, group: { id: g.id, name: g.name }, responsible: { id: of.id, name: of.name, last_name: of.last_name }, is_internal: true });

describe('buildOrgChart', () => {
  const admin = member('a1', 'admin_empresa', 'Laura');
  const maria = member('r1', 'responsable', 'María');
  const andres = member('r2', 'responsable', 'Andrés');
  const auditor = member('u1', 'auditor', 'Sofía');
  const tMaria = team('g1', maria);
  const tAndres = team('g2', andres, 'Seguridad Cloud');

  it('puts the administrators on top, each responsible under them with their own delegates, and the auditors apart', () => {
    const chart = buildOrgChart([admin, maria, andres, auditor, delegate('d1', 'Juan', maria, tMaria), delegate('d2', 'Pedro', andres, tAndres), delegate('d3', 'Ana', maria, tMaria)], [tMaria, tAndres]);
    expect(chart.admins.map((m) => m.id)).toEqual(['a1']);
    expect(chart.auditors.map((m) => m.id)).toEqual(['u1']);
    expect(chart.responsibles.map((r) => r.id)).toEqual(['r2', 'r1']); // por nombre: Andrés, María
    expect(chart.responsibles.find((r) => r.id === 'r1')!.delegates.map((d) => d.name)).toEqual(['Ana', 'Juan']);
    expect(chart.responsibles.find((r) => r.id === 'r2')!.team!.name).toBe('Seguridad Cloud');
    expect(chart.orphans).toEqual([]);
  });

  it('puts the collaborators apart, outside the chain, sorted by name, and never inside a team (D136)', () => {
    const chart = buildOrgChart([admin, maria, member('c2', 'colaborador', 'Zoe'), member('c1', 'colaborador', 'Ana'), member('c3', 'colaborador', 'Luis', { status: 'inactive' })], [tMaria]);
    expect(chart.collaborators.map((m) => m.id)).toEqual(['c1', 'c2']);
    expect(chart.responsibles.flatMap((r) => r.delegates)).toEqual([]);
    expect(chart.orphans).toEqual([]);
    expect(buildOrgChart([member('c3', 'colaborador', 'Luis', { status: 'inactive' })], [], true).collaborators.map((m) => m.id)).toEqual(['c3']);
  });

  it('a responsible with no team yet is still shown, with no team', () => {
    const chart = buildOrgChart([maria], []);
    expect(chart.responsibles[0].team).toBeNull();
    expect(chart.responsibles[0].delegates).toEqual([]);
  });

  it('hides the deactivated by default, says how many, and shows them when asked', () => {
    const gone = delegate('d9', 'Luis', maria, tMaria, 'inactive');
    const hidden = buildOrgChart([maria, gone], [tMaria]);
    expect(hidden.responsibles[0].delegates).toEqual([]);
    expect(hidden.hiddenInactive).toBe(1);
    const shown = buildOrgChart([maria, gone], [tMaria], true);
    expect(shown.responsibles[0].delegates.map((d) => d.id)).toEqual(['d9']);
    expect(shown.hiddenInactive).toBe(0);
  });

  it('a delegate whose responsible is not in sight goes to the orphans, never disappears', () => {
    const oldBoss = member('r9', 'responsable', 'Carla', { status: 'inactive' });
    const tOld = team('g9', oldBoss);
    const chart = buildOrgChart([oldBoss, delegate('d5', 'Rosa', oldBoss, tOld)], [tOld]);
    expect(chart.orphans.map((d) => d.id)).toEqual(['d5']);
  });

  it('a responsible who only sees their own team still gets their node, named after the team leader', () => {
    const chart = buildOrgChart([delegate('d1', 'Juan', maria, tMaria)], [tMaria]);
    expect(chart.responsibles.length).toBe(1);
    expect(chart.responsibles[0]).toEqual(jasmine.objectContaining({ id: 'r1', name: 'María Pérez', member: null }));
    expect(chart.responsibles[0].delegates.map((d) => d.id)).toEqual(['d1']);
  });

  it('finds the responsible through the team when the person has no responsible field', () => {
    const d = { ...delegate('d1', 'Juan', maria, tMaria), responsible: null };
    const chart = buildOrgChart([maria, d], [tMaria]);
    expect(chart.responsibles[0].delegates.map((x) => x.id)).toEqual(['d1']);
  });
});
