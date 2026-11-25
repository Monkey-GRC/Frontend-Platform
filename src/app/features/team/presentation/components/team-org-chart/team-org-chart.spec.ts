import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { NEVER, of, throwError } from 'rxjs';
import { Group } from '@features/team/domain/models/group.models';
import { TeamActor, TeamMember, TeamRole, TeamStatus } from '@shared/domain/models/team.models';
import { SessionService } from '@core/domain/services/session.service';
import { GroupService } from '@features/team/domain/services/group.service';
import { TeamService } from '@shared/domain/services/team.service';
import { OrgWorkload } from '@features/team/domain/utils/team-org';
import { TeamOrgChart } from './team-org-chart';
import { isSelect, optionValues, pickOption } from '@shared/presentation/components/select/select.testing';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';

const toastText = (): string => TestBed.inject(ToastService).toasts().map((t) => `${t.title} ${t.message}`).join(' | ');

const member = (id: string, role: TeamRole, name: string, over: Partial<TeamMember> = {}): TeamMember => ({
  id, email: `${id}@acme.co`, name, last_name: 'Pérez', role, status: 'active', is_mfa_enabled: true, last_login_at: null, created_at: '2026-10-01T00:00:00Z', ...over,
});
const ADMIN = member('a1', 'admin_empresa', 'Laura');
const MARIA = member('r1', 'responsable', 'María');
const ANDRES = member('r2', 'responsable', 'Andrés');
const AUDITOR = member('u1', 'auditor', 'Sofía');
const T_MARIA: Group = { id: 'g1', name: 'Equipo de María', kind: 'team', leader: { id: 'r1', name: 'María', last_name: 'Pérez', role: 'responsable' }, members_count: 1 };
const T_ANDRES: Group = { id: 'g2', name: 'Seguridad Cloud', kind: 'team', leader: { id: 'r2', name: 'Andrés', last_name: 'Pérez', role: 'responsable' }, members_count: 0 };
const delegate = (id: string, name: string, boss: TeamMember, g: Group, status: TeamStatus = 'active') =>
  member(id, 'delegado', name, { status, is_internal: true, group: { id: g.id, name: g.name }, responsible: { id: boss.id, name: boss.name, last_name: boss.last_name } });
const JUAN = delegate('d1', 'Juan', MARIA, T_MARIA);

describe('TeamOrgChart', () => {
  let teamApi: jasmine.SpyObj<TeamService>;
  let groupApi: jasmine.SpyObj<GroupService>;
  let fixture: ComponentFixture<TeamOrgChart>;

  function setup(members: TeamMember[], groups: Group[], actor: TeamActor = 'admin_empresa', workload: Record<string, OrgWorkload> = {}): TeamOrgChart {
    teamApi = jasmine.createSpyObj<TeamService>('TeamService', ['listAll', 'update']);
    teamApi.listAll.and.returnValue(of(members));
    groupApi = jasmine.createSpyObj<GroupService>('GroupService', ['create', 'rename']);
    TestBed.configureTestingModule({ imports: [TeamOrgChart], providers: [provideTranslateService(), { provide: TeamService, useValue: teamApi }, { provide: GroupService, useValue: groupApi }] });
    TestBed.inject(SessionService).set({ id: actor === 'admin_empresa' ? 'a1' : 'r1', email: 'x@acme.co', name: 'María', last_name: 'Pérez', role: actor }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(TeamOrgChart);
    fixture.componentRef.setInput('actor', actor);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('workload', workload);
    fixture.detectChanges();
    return fixture.componentInstance;
  }
  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(s: string) => el().querySelector<T>(s);
  const click = (s: string | HTMLElement) => { (typeof s === 'string' ? q(s)! : s).click(); fixture.detectChanges(); };
  const type = (s: string, value: string) => {
    if (isSelect(el(), s)) return pickOption(el(), s, value, () => fixture.detectChanges());
    const i = q<HTMLInputElement>(s)!;
    i.value = value;
    i.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const names = (s: string) => Array.from(el().querySelectorAll(`${s} [data-person-name]`)).map((n) => n.textContent!.trim());

  it('asks once for the whole team and draws the administrators on top, each responsible with their own delegates, and the auditors apart', () => {
    setup([ADMIN, MARIA, ANDRES, AUDITOR, JUAN, delegate('d2', 'Pedro', ANDRES, T_ANDRES)], [T_MARIA, T_ANDRES]);
    expect(teamApi.listAll).toHaveBeenCalledTimes(1);
    expect(names('[data-org-admins]')).toEqual(['Laura Pérez']);
    expect(names('[data-org-auditors]')).toEqual(['Sofía Pérez']);
    expect(names('[data-responsible="r1"] [data-org-delegates]')).toEqual(['Juan Pérez']);
    expect(names('[data-responsible="r2"] [data-org-delegates]')).toEqual(['Pedro Pérez']);
    expect(q('[data-responsible="r2"] [data-org-team-name]')!.textContent).toContain('Seguridad Cloud');
  });

  it('with many responsibles they start closed, so the page is not saturated, and each opens on its own', () => {
    const many = ['r1', 'r2', 'r3', 'r4', 'r5'].map((id, i) => member(id, 'responsable', `Resp${i}`));
    setup([ADMIN, ...many, delegate('d1', 'Juan', many[0], { ...T_MARIA, leader: { ...T_MARIA.leader, id: 'r1' } })], [{ ...T_MARIA, leader: { ...T_MARIA.leader, id: 'r1' } }]);
    expect(el().querySelector('[data-org-delegates]')).toBeNull();
    click('[data-responsible="r1"] [data-org-toggle]');
    expect(q('[data-responsible="r1"] [data-org-delegates]')).not.toBeNull();
  });

  it('shows the state only when the person is not active, and whether a delegate is internal or external', () => {
    setup([MARIA, delegate('d1', 'Juan', MARIA, T_MARIA, 'pending')], [T_MARIA]);
    expect(q('[data-delegate="d1"] [data-org-status]')!.textContent).toContain('PENDING');
    expect(q('[data-responsible="r1"] > div [data-org-status]')).toBeNull();
    expect(q('[data-delegate="d1"]')!.textContent).toContain('INTERNAL');
  });

  it('hides the deactivated and offers to show them, saying how many', () => {
    setup([MARIA, JUAN, delegate('d9', 'Luis', MARIA, T_MARIA, 'inactive')], [T_MARIA]);
    expect(names('[data-org-delegates]')).toEqual(['Juan Pérez']);
    expect(q('[data-org-show-inactive]')).not.toBeNull();
    click('[data-org-show-inactive]');
    expect(names('[data-org-delegates]').sort()).toEqual(['Juan Pérez', 'Luis Pérez']);
  });

  it('does not show controls or progress until the Backend gives them, and then shows both together', () => {
    setup([MARIA, JUAN], [T_MARIA]);
    expect(el().querySelector('[data-org-workload]')).toBeNull();
    TestBed.resetTestingModule();
    setup([MARIA, JUAN], [T_MARIA], 'admin_empresa', { d1: { controls: 12, progress: { done: 6, total: 12 } } });
    const text = q('[data-delegate="d1"] [data-org-workload]')!.textContent!;
    expect(text).toContain('WORKLOAD');
    expect(text).toContain('PROGRESS'); // los controles y el avance van juntos, nunca un porcentaje solo
  });

  it('a responsible with no team shows how to create it, and creating it sends the leader for the administrator', () => {
    const view = setup([MARIA], []);
    expect(q('[data-org-no-team]')).not.toBeNull();
    groupApi.create.and.returnValue(of({ ...T_MARIA, name: 'Seguridad' }));
    let changed = 0;
    view.changed.subscribe(() => changed++);
    click('[data-org-create]');
    type('[data-org-create-input]', 'Seguridad');
    click('[data-org-create-save]');
    expect(groupApi.create).toHaveBeenCalledOnceWith({ name: 'Seguridad', leader_id: 'r1' });
    expect(changed).toBe(1);
    expect(toastText()).toContain('TEAM.ORG.NOTICE');
  });

  it('the responsible without a team is told the administrator creates it, and is offered nothing to create (D136)', () => {
    setup([JUAN], [], 'responsable');
    expect(q('[data-org-no-team]')!.textContent).toContain('TEAM.ORG.NO_TEAM_OWN');
    expect(q('[data-org-create]')).toBeNull();
  });

  it('shows the collaborators apart, like the auditors: they are outside the chain of controls (D136)', () => {
    setup([ADMIN, MARIA, member('c1', 'colaborador', 'Coco')], [T_MARIA]);
    const section = q('[data-org-collaborators]')!;
    expect(section.textContent).toContain('Coco');
    expect(section.textContent).toContain('TEAM.ROLE.COLABORADOR');
    expect(q('[data-org-delegates]')?.textContent ?? '').not.toContain('Coco');
  });

  it('does not say «no team» while the groups are still arriving', () => {
    setup([MARIA], []);
    fixture.componentRef.setInput('groupsLoaded', false);
    fixture.detectChanges();
    expect(q('[data-org-no-team]')).toBeNull();
  });

  it('only the administrator renames a team', () => {
    setup([MARIA, JUAN], [T_MARIA], 'responsable');
    expect(q('[data-org-rename]')).toBeNull();
    TestBed.resetTestingModule();
    setup([MARIA, JUAN], [T_MARIA]);
    groupApi.rename.and.returnValue(of({ ...T_MARIA, name: 'Cloud' }));
    click('[data-org-rename]');
    expect(q<HTMLButtonElement>('[data-org-rename-save]')!.disabled).toBeTrue(); // sin cambios no se guarda
    type('[data-org-rename-input]', 'Cloud');
    click('[data-org-rename-save]');
    expect(groupApi.rename).toHaveBeenCalledOnceWith('g1', 'Cloud');
  });

  it('moves a delegate to another responsible by choosing them, and only the administrator can', () => {
    setup([MARIA, ANDRES, JUAN], [T_MARIA, T_ANDRES], 'responsable');
    expect(q('[data-org-move]')).toBeNull();
    TestBed.resetTestingModule();
    setup([MARIA, ANDRES, JUAN], [T_MARIA, T_ANDRES]);
    teamApi.update.and.returnValue(of(JUAN));
    click('[data-org-move]');
    const options = optionValues(el(), '[data-org-move-target]', () => fixture.detectChanges());
    expect(options).toEqual(['g2']); // el equipo actual no es destino
    expect(q<HTMLButtonElement>('[data-org-move-save]')!.disabled).toBeTrue();
    type('[data-org-move-target]', 'g2');
    click('[data-org-move-save]');
    expect(teamApi.update).toHaveBeenCalledOnceWith('d1', { group_id: 'g2' });
  });

  it('asks to confirm when the delegate runs controls, and moves them only if the administrator accepts', () => {
    setup([MARIA, ANDRES, JUAN], [T_MARIA, T_ANDRES]);
    const refusal = new HttpErrorResponse({ status: 409, error: { message: 'x', error: { code: 'USER_HAS_ASSIGNMENTS', controls_count: 7 } } });
    teamApi.update.and.returnValues(throwError(() => refusal), of(JUAN));
    click('[data-org-move]');
    type('[data-org-move-target]', 'g2');
    click('[data-org-move-save]');
    expect(teamApi.update).toHaveBeenCalledTimes(1);
    const dialog = q('app-confirm-dialog')!;
    expect(dialog).not.toBeNull();
    (dialog.querySelector('button[class*="bg-"]:last-of-type') as HTMLButtonElement | null);
    fixture.componentInstance.confirmMove();
    expect(teamApi.update).toHaveBeenCalledWith('d1', { group_id: 'g2', confirm_unassign: true });
  });

  it('says so when the destination team no longer exists, and otherwise shows what the server said', () => {
    setup([MARIA, ANDRES, JUAN], [T_MARIA, T_ANDRES]);
    teamApi.update.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404, error: { error: { code: 'NOT_FOUND' } } })));
    click('[data-org-move]');
    type('[data-org-move-target]', 'g2');
    click('[data-org-move-save]');
    expect(toastText()).toContain('MOVE_TARGET');
  });

  it('while the team loads shows a skeleton, and a retry if it fails', () => {
    teamApi = jasmine.createSpyObj<TeamService>('TeamService', ['listAll', 'update']);
    teamApi.listAll.and.returnValue(NEVER);
    TestBed.configureTestingModule({ imports: [TeamOrgChart], providers: [provideTranslateService(), { provide: TeamService, useValue: teamApi }, { provide: GroupService, useValue: {} }] });
    fixture = TestBed.createComponent(TeamOrgChart);
    fixture.componentRef.setInput('actor', 'admin_empresa');
    fixture.detectChanges();
    expect(q('[data-org-loading]')?.getAttribute('aria-busy')).toBe('true');
    expect(q('app-loading-spinner')).toBeNull();
    TestBed.resetTestingModule();
    teamApi.listAll.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    TestBed.configureTestingModule({ imports: [TeamOrgChart], providers: [provideTranslateService(), { provide: TeamService, useValue: teamApi }, { provide: GroupService, useValue: {} }] });
    fixture = TestBed.createComponent(TeamOrgChart);
    fixture.componentRef.setInput('actor', 'admin_empresa');
    fixture.detectChanges();
    expect(q('[data-org-retry]')).not.toBeNull();
  });

  it('never names a provider and speaks of «team», not of «groups»', () => {
    setup([ADMIN, MARIA, JUAN], [T_MARIA]);
    expect(el().textContent!.toLowerCase()).not.toContain('prowler');
    expect(el().innerHTML).not.toContain('TEAM.GROUPS');
  });
});
