import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { Group } from '@features/team/domain/models/group.models';
import { TeamActor, TeamMember, TeamPage } from '@shared/domain/models/team.models';
import { GroupService } from '@features/team/domain/services/group.service';
import { TeamService } from '@shared/domain/services/team.service';
import { TeamGroupsView } from './team-groups';
import { isSelect, optionValues, pickOption } from '@shared/presentation/components/select/select.testing';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';

const toastText = (): string => TestBed.inject(ToastService).toasts().map((t) => `${t.title} ${t.message}`).join(' | ');

const leader = (id: string, name: string, role = 'responsable') => ({ id, name, last_name: 'Gómez', role });
const RESPONSABLES: Group = { id: 'resp', name: 'Responsables', kind: 'responsables', leader: leader('a1', 'Ada', 'admin_empresa'), members_count: 3 };
const TEAM_MARIA: Group = { id: 'team-maria', name: 'Equipo de María', kind: 'team', leader: leader('r1', 'María'), members_count: 2 };

const member = (over: Partial<TeamMember>): TeamMember => ({
  id: 'u0', email: 'x@acme.co', name: 'Persona', last_name: 'Prueba', role: 'responsable', status: 'active', is_mfa_enabled: false, last_login_at: null, created_at: '2026-11-01T00:00:00Z', ...over,
});
const MARIA = member({ id: 'r1', email: 'maria@acme.co', name: 'María', last_name: 'Gómez' });
const PEDRO = member({ id: 'r2', email: 'pedro@acme.co', name: 'Pedro', last_name: 'Ruiz' });
const LAURA_PENDING = member({ id: 'r3', email: 'laura@acme.co', name: 'Laura', last_name: 'Paz', status: 'pending' });
const OLD_INACTIVE = member({ id: 'r4', email: 'old@acme.co', name: 'Óscar', last_name: 'Vieja', status: 'inactive' });
const pageOf = (items: TeamMember[]): TeamPage => ({ items, page: 1, page_size: 100, total: items.length, total_pages: 1 });
const httpError = (status: number, code: string, message: string) => new HttpErrorResponse({ status, error: { message, error: { code } } });

describe('TeamGroupsView (MD-198, D102, D104)', () => {
  let groupApi: jasmine.SpyObj<GroupService>;
  let teamApi: jasmine.SpyObj<TeamService>;
  let fixture: ComponentFixture<TeamGroupsView>;

  function setup(actor: TeamActor, groups: Group[], responsables: TeamMember[] = [MARIA, PEDRO, LAURA_PENDING, OLD_INACTIVE]): void {
    groupApi = jasmine.createSpyObj<GroupService>('GroupService', ['list', 'create', 'rename']);
    groupApi.list.and.returnValue(of(groups));
    teamApi = jasmine.createSpyObj<TeamService>('TeamService', ['list', 'update']);
    teamApi.list.and.callFake((filters) => of(pageOf(filters?.role === 'responsable' ? responsables : [])));
    TestBed.configureTestingModule({
      imports: [TeamGroupsView],
      providers: [provideTranslateService({ fallbackLang: 'es' }), { provide: GroupService, useValue: groupApi }, { provide: TeamService, useValue: teamApi }],
    });
    TestBed.inject(SessionService).set({ id: actor === 'admin_empresa' ? 'a1' : 'r1', email: 'x@acme.co', name: actor === 'admin_empresa' ? 'Ada' : 'María', last_name: null, role: actor }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(TeamGroupsView);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => el().querySelector<T>(selector)!;
  const row = (id: string) => q(`[data-test-group="${id}"]`).closest('tr') as HTMLElement;
  /** Opens the detail panel of a group from its row. */
  const openGroup = (id: string) => click(row(id));
  /** How many times the groups were asked for (the first one is the load). */
  const reloads = () => groupApi.list.calls.count() - 1;
  const openCreate = () => click('[data-test-open-create]');
  const type = (selector: string, value: string) => {
    if (isSelect(el(), selector)) return pickOption(el(), selector, value, () => fixture.detectChanges());
    const input = q<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const click = (target: string | HTMLElement) => {
    (typeof target === 'string' ? q<HTMLElement>(target) : target).click();
    fixture.detectChanges();
  };

  describe('the list of groups', () => {
    it('shows each group in a table with its name, kind, leader and how many people it has, and an arrow to open it', () => {
      setup('admin_empresa', [RESPONSABLES, TEAM_MARIA]);
      expect(el().querySelectorAll('tbody tr').length).toBe(2);
      expect(row('resp').querySelector('[data-test-group-name]')!.textContent).toContain('Responsables');
      expect(row('resp').querySelector('[data-test-group-kind]')!.textContent).toContain('TEAM.GROUPS.KIND_RESPONSABLES');
      expect(row('team-maria').querySelector('[data-test-group-kind]')!.textContent).toContain('TEAM.GROUPS.KIND_TEAM');
      expect(row('team-maria').querySelector('[data-test-group-leader]')!.textContent).toContain('María');
      expect(row('team-maria').querySelector('[data-test-group-count]')!.textContent).toContain('2');
      expect(row('team-maria').querySelector('[data-row-chevron]')).not.toBeNull();
    });

    it('says there are no groups yet, with a different invitation for the administrator and the owner', () => {
      setup('admin_empresa', []);
      expect(q('[data-test-groups-empty]').textContent).toContain('TEAM.GROUPS.EMPTY_BODY_ADMIN');
      TestBed.resetTestingModule();
      setup('responsable', []);
      expect(q('[data-test-groups-empty]').textContent).toContain('TEAM.GROUPS.EMPTY_BODY_OWN');
    });

    it('filters by name or leader from the toolbar, and by kind for the administrator', () => {
      setup('admin_empresa', [RESPONSABLES, TEAM_MARIA]);
      type('input[type="search"]', 'maría');
      expect(el().querySelectorAll('tbody tr').length).toBe(1);
      type('input[type="search"]', 'zzz');
      expect(el().textContent).toContain('TEAM.GROUPS.EMPTY_FILTERED_TITLE');
      type('input[type="search"]', '');
      type('[data-test-filter-kind]', 'team');
      expect(el().querySelectorAll('tbody tr').length).toBe(1);
      expect(row('team-maria')).not.toBeNull();
    });

    it('offers the owner no kind filter (they only see their own team)', () => {
      setup('responsable', [TEAM_MARIA]);
      expect(el().querySelector('[data-test-filter-kind]')).toBeNull();
    });

    it('opens the people of a group in a modal, asking the server only for that group, from the row and from the keyboard', () => {
      setup('admin_empresa', [RESPONSABLES, TEAM_MARIA]);
      expect(el().querySelector('app-group-members')).toBeNull();
      expect(row('team-maria').getAttribute('tabindex')).toBe('0');
      row('team-maria').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();
      expect(q('[role="dialog"] app-group-members')).not.toBeNull();
      expect(q('[role="dialog"]').textContent).toContain('Equipo de María');
      expect(teamApi.list).toHaveBeenCalledWith({ groupId: 'team-maria' }, 1, 100);
      click('[data-cancel]');
      expect(el().querySelector('app-group-members')).toBeNull();
    });
  });

  describe('administrator', () => {
    it('creates a group of owners with only a name (no leader: it leads it himself) and tells the screen to reload', () => {
      setup('admin_empresa', [RESPONSABLES]);
      groupApi.create.and.returnValue(of({ ...RESPONSABLES, id: 'ia', name: 'Responsables - Servicio IA' }));
      openCreate();
      expect(q<HTMLButtonElement>('[data-test-create-responsables]').disabled).toBeTrue();
      type('[data-test-responsables-name]', '  Responsables - Servicio IA ');
      click('[data-test-create-responsables]');
      expect(groupApi.create).toHaveBeenCalledOnceWith({ name: 'Responsables - Servicio IA' });
      expect(toastText()).toContain('TEAM.GROUPS.NOTICE.CREATED');
      expect(el().querySelector('[role="dialog"]')).toBeNull(); // the form closes
      expect(reloads()).toBe(1);
    });

    it('offers to create a team only for the owners who are active or pending and do not lead one yet (D104)', () => {
      setup('admin_empresa', [RESPONSABLES, TEAM_MARIA]);
      openCreate();
      const options = optionValues(el(), '[data-test-team-leader]', () => fixture.detectChanges());
      expect(options).toEqual(['r2', 'r3']); // sin María (ya lidera) ni Óscar (inactivo)
      expect(teamApi.list).toHaveBeenCalledWith({ role: 'responsable' }, 1, 100);
    });

    it('creates the team of an owner with the leader and the name, and needs both', () => {
      setup('admin_empresa', [RESPONSABLES]);
      groupApi.create.and.returnValue(of(TEAM_MARIA));
      openCreate();
      type('[data-test-team-name]', 'Equipo de Pedro');
      expect(q<HTMLButtonElement>('[data-test-create-team]').disabled).toBeTrue(); // falta el responsable
      type('[data-test-team-leader]', 'r2');
      click('[data-test-create-team]');
      expect(groupApi.create).toHaveBeenCalledOnceWith({ name: 'Equipo de Pedro', leader_id: 'r2' });
      expect(reloads()).toBe(1);
    });

    it('says so when every owner already has a team, and offers no form for it', () => {
      setup('admin_empresa', [RESPONSABLES, TEAM_MARIA], [MARIA]);
      openCreate();
      expect(q('[data-test-no-eligible]').textContent).toContain('TEAM.GROUPS.NO_ELIGIBLE');
      expect(el().querySelector('[data-test-team-leader]')).toBeNull();
    });

    it('shows the server message when a group cannot be created (a name already taken or an owner that already has a team)', () => {
      setup('admin_empresa', [RESPONSABLES]);
      groupApi.create.and.returnValue(throwError(() => httpError(409, 'GROUP_NAME_TAKEN', 'Ya existe un grupo con ese nombre en tu empresa.')));
      openCreate();
      type('[data-test-responsables-name]', 'Duplicado');
      click('[data-test-create-responsables]');
      expect(q('[data-test-groups-error]').textContent).toContain('Ya existe un grupo con ese nombre en tu empresa.');
      expect(reloads()).toBe(0);
      expect(q<HTMLInputElement>('[data-test-responsables-name]').value).toBe('Duplicado'); // no pierde lo escrito
    });

    it('renames a group, only when the name changed and is not blank, and reloads', () => {
      setup('admin_empresa', [RESPONSABLES, TEAM_MARIA]);
      groupApi.rename.and.returnValue(of({ ...TEAM_MARIA, name: 'Equipo A' }));
      openGroup('team-maria');
      click('[data-test-rename]');
      expect(q<HTMLInputElement>('[data-test-rename-input]').value).toBe('Equipo de María');
      expect(q<HTMLButtonElement>('[data-test-rename-save]').disabled).toBeTrue(); // igual al actual
      type('[data-test-rename-input]', '   ');
      expect(q<HTMLButtonElement>('[data-test-rename-save]').disabled).toBeTrue();
      type('[data-test-rename-input]', ' Equipo A ');
      click('[data-test-rename-save]');
      expect(groupApi.rename).toHaveBeenCalledOnceWith('team-maria', 'Equipo A');
      expect(toastText()).toContain('TEAM.GROUPS.NOTICE.RENAMED');
      expect(el().querySelector('[data-test-rename-input]')).toBeNull();
      expect(reloads()).toBe(1);
    });

    it('shows the server message when the default group is renamed (it is reserved) and keeps the form open', () => {
      setup('admin_empresa', [RESPONSABLES]);
      groupApi.rename.and.returnValue(throwError(() => httpError(409, 'GROUP_RESERVED', 'El grupo «Responsables» no se puede renombrar.')));
      openGroup('resp');
      click('[data-test-rename]');
      type('[data-test-rename-input]', 'Otro nombre');
      click('[data-test-rename-save]');
      expect(q('[data-test-groups-error]').textContent).toContain('El grupo «Responsables» no se puede renombrar.');
      expect(q('[data-test-rename-input]')).not.toBeNull();
      expect(reloads()).toBe(0);
    });

    it('can cancel a rename without calling the server', () => {
      setup('admin_empresa', [TEAM_MARIA]);
      openGroup('team-maria');
      click('[data-test-rename]');
      fixture.componentInstance.cancelRename();
      fixture.detectChanges();
      expect(el().querySelector('[data-test-rename-input]')).toBeNull();
      expect(groupApi.rename).not.toHaveBeenCalled();
    });

    it('lets the administrator move delegates between the teams it shows', () => {
      setup('admin_empresa', [RESPONSABLES, TEAM_MARIA]);
      openGroup('team-maria');
      expect(q('[role="dialog"] app-group-members')).not.toBeNull();
      fixture.componentInstance.onMoved();
      expect(reloads()).toBe(1);
    });
  });

  describe('owner (D136: crear equipos es del administrador)', () => {
    it('without a team yet, offers nothing to create: the administrator creates it', () => {
      setup('responsable', []);
      expect(el().querySelector('[data-test-open-create]')).toBeNull();
      expect(q('[data-test-groups-empty]').textContent).toContain('TEAM.GROUPS.EMPTY_BODY_OWN');
      expect(teamApi.list).not.toHaveBeenCalled(); // no necesita la lista de responsables
    });

    it('with a team, offers neither to create one, nor to rename it or to move people', () => {
      setup('responsable', [TEAM_MARIA]);
      expect(el().querySelector('[data-test-open-create]')).toBeNull();
      openGroup('team-maria');
      expect(el().querySelector('[data-test-rename]')).toBeNull();
      expect(el().querySelector('[data-test-move]')).toBeNull();
    });
  });

  it('guards «Crear» with something written and the rename with a different name, and starts «Crear» empty again (MD-485)', () => {
    setup('admin_empresa', [RESPONSABLES]);
    const view = fixture.componentInstance;
    view.openCreate();
    expect(view.createDirty()).toBeFalse();
    view.teamName.set('Equipo de TI');
    expect(view.createDirty()).toBeTrue();
    view.createOpen.set(false);
    view.openCreate();
    expect(view.teamName()).toBe('');
    expect(view.createDirty()).toBeFalse();
    view.renamingId.set('resp');
    view.renameDraft.set('Responsables');
    expect(view.renameDirty()).toBeFalse();
    view.renameDraft.set('Responsables 2026');
    expect(view.renameDirty()).toBeTrue();
  });
});
