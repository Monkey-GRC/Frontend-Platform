import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { Observable, Subject, of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { Group } from '../../../domain/models/group.models';
import { InvitedMember, TeamMember, TeamPage } from '../../../domain/models/team.models';
import { GroupService } from '../../../domain/services/group.service';
import { TeamService } from '../../../domain/services/team.service';
import { TeamView } from './team';

const member = (over: Partial<TeamMember>): TeamMember => ({
  id: 'u0', email: 'x@acme.co', name: 'Persona', last_name: 'Prueba', role: 'responsable', status: 'active', is_mfa_enabled: true, last_login_at: null, created_at: '2026-10-28T00:00:00Z', ...over,
});
const ME = member({ id: 'me', email: 'admin@acme.co', name: 'Ada', last_name: 'Admin', role: 'admin_empresa', last_login_at: '2026-11-05T10:00:00Z' });
const OTHER_ADMIN = member({ id: 'adm2', email: 'adm2@acme.co', name: 'Lucía', last_name: 'Gómez', role: 'admin_empresa' });
const ANA = member({ id: 'ana', email: 'ana@acme.co', name: 'Ana', last_name: 'Ruiz', group: { id: 'resp', name: 'Responsables' } });
const DELEGATE = member({ id: 'del', email: 'del@acme.co', name: 'Dani', last_name: 'Lara', role: 'delegado', is_internal: false, group: { id: 'team-ana', name: 'Equipo de Ana' }, responsible: { id: 'ana', name: 'Ana', last_name: 'Ruiz' } });
const PENDING = member({ id: 'pen', email: 'pen@acme.co', name: null, last_name: null, status: 'pending', is_mfa_enabled: false, role: 'auditor' });
const GROUPS: Group[] = [
  { id: 'resp', name: 'Responsables', kind: 'responsables', leader: { id: 'me', name: 'Ada', last_name: 'Admin', role: 'admin_empresa' }, members_count: 1 },
  { id: 'team-ana', name: 'Equipo de Ana', kind: 'team', leader: { id: 'ana', name: 'Ana', last_name: 'Ruiz', role: 'responsable' }, members_count: 1 },
];

const pageOf = (items: TeamMember[], over: Partial<TeamPage> = {}): TeamPage => ({ items, page: 1, page_size: 25, total: items.length, total_pages: 1, ...over });
const invited = (over: Partial<InvitedMember> & { delivery?: 'sent' | 'failed' } = {}): InvitedMember => {
  const { delivery = 'sent', ...rest } = over;
  return { ...member({ id: 'new', email: 'juan@acme.co', name: 'Juan', last_name: 'Pérez', role: 'auditor', status: 'pending' }), invitation: { delivery_status: delivery, expires_at: '2026-11-12T15:04:02Z' }, ...rest };
};

describe('TeamView (MD-197, D96, D102)', () => {
  let api: jasmine.SpyObj<TeamService>;
  let groupApi: jasmine.SpyObj<GroupService>;
  let fixture: ComponentFixture<TeamView>;

  function setup(members: TeamMember[] = [ME, OTHER_ADMIN, ANA, DELEGATE, PENDING], role = 'admin_empresa', groups: Group[] = GROUPS, groups$?: Observable<Group[]>): void {
    api = jasmine.createSpyObj<TeamService>('TeamService', ['list', 'listAll', 'invite', 'update', 'resendInvitation', 'resetMfa']);
    api.list.and.returnValue(of(pageOf(members)));
    api.listAll.and.returnValue(of(members));
    groupApi = jasmine.createSpyObj<GroupService>('GroupService', ['list']);
    groupApi.list.and.returnValue(groups$ ?? of(groups));
    TestBed.configureTestingModule({
      imports: [TeamView],
      providers: [provideTranslateService({ fallbackLang: 'es' }), { provide: TeamService, useValue: api }, { provide: GroupService, useValue: groupApi }],
    });
    TestBed.inject(SessionService).set({ id: role === 'admin_empresa' ? 'me' : 'ana', email: 'admin@acme.co', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(TeamView);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => el().querySelector<T>(selector)!;
  const row = (email: string) => q(`[data-test-member="${email}"]`).closest('tr') as HTMLElement;
  const type = (selector: string, value: string) => {
    const input = q<HTMLInputElement | HTMLSelectElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
    fixture.detectChanges();
  };
  const click = (selector: string | HTMLElement) => {
    (typeof selector === 'string' ? q<HTMLElement>(selector) : selector).click();
    fixture.detectChanges();
  };
  const lastListCall = () => api.list.calls.mostRecent().args;

  describe('the list', () => {
    it('lists the team with name, role, state, group and who the delegate answers to, and marks the ones without a name', () => {
      setup();
      expect(row('ana@acme.co').textContent).toContain('Ana Ruiz');
      expect(row('ana@acme.co').textContent).toContain('TEAM.ROLE.RESPONSABLE');
      expect(row('ana@acme.co').querySelector('[data-test-group]')!.textContent).toContain('Responsables');
      const delegate = row('del@acme.co');
      expect(delegate.textContent).toContain('Equipo de Ana');
      expect(delegate.querySelector('[data-test-responsible]')!.textContent).toContain('TEAM.LIST.RESPONSIBLE');
      expect(delegate.querySelector('[data-test-affiliation]')!.textContent).toContain('TEAM.INVITE.EXTERNAL');
      expect(row('pen@acme.co').querySelector('[data-test-no-name]')).not.toBeNull();
      expect(row('ana@acme.co').textContent).toContain('TEAM.LIST.NEVER'); // nunca ha ingresado
    });

    it('has two tabs, people and org chart, and no work split by service and dimension (D102): it only loads the people and the groups', () => {
      setup();
      expect(el().querySelectorAll('[role="tab"]').length).toBe(2);
      expect(q('[data-test-tab-people]').getAttribute('aria-selected')).toBe('true');
      expect(el().querySelector('app-team-org-chart')).toBeNull();
      expect(api.list).toHaveBeenCalledTimes(1);
      expect(groupApi.list).toHaveBeenCalledTimes(1);
    });

    it('asks for the first page of 25 by default and follows the page the server reports', () => {
      setup();
      expect(lastListCall()).toEqual([{ role: null, status: null, groupId: null, isInternal: null }, 1, 25]);
      api.list.and.returnValue(of(pageOf([ANA], { page: 2, total: 30, total_pages: 2 })));
      fixture.componentInstance.goTo(2);
      fixture.detectChanges();
      expect(lastListCall()[1]).toBe(2);
      expect(fixture.componentInstance.page()).toEqual({ page: 2, pageSize: 25, total: 30, totalPages: 2 });
    });

    it('goes back to the first page when the size changes', () => {
      setup();
      fixture.componentInstance.goTo(3);
      fixture.componentInstance.resize(50);
      expect(lastListCall()[1]).toBe(1);
      expect(lastListCall()[2]).toBe(50);
    });

    it('ignores a slow answer that arrives after a newer one (filters that change fast)', () => {
      setup();
      const slow = new Subject<TeamPage>();
      api.list.and.returnValues(slow, of(pageOf([PENDING])));
      type('[data-test-filter-role]', 'delegado'); // la primera, lenta
      type('[data-test-filter-status]', 'pending'); // la segunda, más nueva y rápida
      expect(row('pen@acme.co')).not.toBeNull();
      slow.next(pageOf([ANA])); // llega tarde: ya no vale
      slow.complete();
      fixture.detectChanges();
      expect(el().querySelector('[data-test-member="ana@acme.co"]')).toBeNull();
      expect(row('pen@acme.co')).not.toBeNull();
    });

    it('does not stay waiting for a load that a newer request replaced', () => {
      setup();
      const neverEnds = new Subject<TeamPage>();
      api.list.and.returnValues(neverEnds, of(pageOf([ANA])));
      fixture.componentInstance.load(true); // la carga inicial, que no termina
      fixture.componentInstance.onGroupsChanged(); // otra petición más nueva
      fixture.detectChanges();
      expect(fixture.componentInstance.stage()).toBe('ready');
      expect(row('ana@acme.co')).not.toBeNull();
    });

    it('offers a retry when the team cannot be loaded', () => {
      setup();
      api.list.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      fixture.componentInstance.load(true);
      fixture.detectChanges();
      expect(el().querySelector('[data-test-retry]')).not.toBeNull();
    });
  });

  describe('filters (asked to the server, so they apply to every page)', () => {
    it('filters by role, state, group and internal or external, always from the first page, and clears them (the state filter only offers what the Backend accepts)', () => {
      setup();
      expect(Array.from(el().querySelectorAll<HTMLOptionElement>('[data-test-filter-status] option')).map((o) => o.value)).toEqual(['', 'active', 'pending', 'inactive']);
      TestBed.resetTestingModule();
      setup();
      type('[data-test-filter-role]', 'delegado');
      expect(lastListCall()[0]).toEqual({ role: 'delegado', status: null, groupId: null, isInternal: null });
      type('[data-test-filter-status]', 'pending');
      type('[data-test-filter-group]', 'team-ana');
      type('[data-test-filter-affiliation]', 'external');
      expect(lastListCall()).toEqual([{ role: 'delegado', status: 'pending', groupId: 'team-ana', isInternal: false }, 1, 25]);
      type('[data-test-filter-affiliation]', 'internal');
      expect(lastListCall()[0]?.isInternal).toBeTrue();
      click('[data-test-clear-filters]');
      expect(lastListCall()[0]).toEqual({ role: null, status: null, groupId: null, isInternal: null });
      expect(el().querySelector('[data-test-clear-filters]')).toBeNull();
    });

    it('goes back to page 1 when a filter changes', () => {
      setup();
      fixture.componentInstance.goTo(4);
      type('[data-test-filter-role]', 'auditor');
      expect(lastListCall()[1]).toBe(1);
    });

    it('offers the groups the server gave as the group filter', () => {
      setup();
      const options = Array.from(el().querySelectorAll<HTMLOptionElement>('[data-test-filter-group] option')).map((o) => o.value);
      expect(options).toEqual(['', 'resp', 'team-ana']);
    });
  });

  describe('administrator', () => {
    it('gives the other people their actions (name, deactivate) but not the ones that do not apply, and on themselves only the name', () => {
      setup();
      const other = row('adm2@acme.co');
      expect(other.querySelector('[data-test-deactivate]')).not.toBeNull();
      expect(other.querySelector('[data-test-reset-mfa]')).toBeNull(); // el de un administrador lo restablece Monkey
      const mine = row('admin@acme.co');
      expect(mine.querySelector('[data-test-edit-name-btn]')).not.toBeNull();
      expect(mine.querySelector('[data-test-deactivate]')).toBeNull();
    });

    it('corrects the name of anybody in the team, including the administrator himself', () => {
      setup();
      api.update.and.returnValue(of({ ...PENDING, name: 'Pedro', last_name: 'Gil' }));
      click(row('pen@acme.co').querySelector<HTMLElement>('[data-test-edit-name-btn]')!);
      type('[data-test-edit-name]', 'Pedro');
      type('[data-test-edit-last-name]', 'Gil');
      click('[data-test-save-name]');
      expect(api.update).toHaveBeenCalledWith('pen', { name: 'Pedro', last_name: 'Gil' });
    });

    it('asks before deactivating and only then closes the account', () => {
      setup();
      api.update.and.returnValue(of({ ...ANA, status: 'inactive' }));
      click(row('ana@acme.co').querySelector<HTMLElement>('[data-test-deactivate]')!);
      expect(api.update).not.toHaveBeenCalled();
      const confirmButton = Array.from(el().querySelectorAll<HTMLButtonElement>('app-confirm-dialog button')).find((b) => b.textContent?.includes('TEAM.ACTIONS.DEACTIVATE'))!;
      confirmButton.click();
      fixture.detectChanges();
      expect(api.update).toHaveBeenCalledWith('ana', { status: 'inactive' });
    });

    it('shows the server message when a change is refused (for example the last administrator)', () => {
      setup();
      api.update.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Debe quedar al menos un administrador.', error: { code: 'LAST_ADMIN' } } })));
      click(row('adm2@acme.co').querySelector<HTMLElement>('[data-test-deactivate]')!);
      const confirmButton = Array.from(el().querySelectorAll<HTMLButtonElement>('app-confirm-dialog button')).find((b) => b.textContent?.includes('TEAM.ACTIONS.DEACTIVATE'))!;
      confirmButton.click();
      fixture.detectChanges();
      expect(el().textContent).toContain('Debe quedar al menos un administrador.');
    });

    it('offers to resend the invitation only to people who have not activated their account', () => {
      setup();
      expect(row('pen@acme.co').querySelector('[data-test-reissue]')).not.toBeNull();
      expect(row('ana@acme.co').querySelector('[data-test-reissue]')).toBeNull();
      api.resendInvitation.and.returnValue(of({ delivery_status: 'sent', expires_at: '2026-11-13T10:00:00Z' }));
      click(row('pen@acme.co').querySelector<HTMLElement>('[data-test-reissue]')!);
      expect(api.resendInvitation).toHaveBeenCalledWith('pen');
      expect(q('[data-test-invitation]').getAttribute('data-status')).toBe('sent');
    });

    it('reactivates a deactivated account', () => {
      setup([ME, member({ id: 'old', email: 'old@acme.co', status: 'inactive' })]);
      api.update.and.returnValue(of(member({ id: 'old', email: 'old@acme.co' })));
      click(row('old@acme.co').querySelector<HTMLElement>('[data-test-reactivate]')!);
      expect(api.update).toHaveBeenCalledWith('old', { status: 'active' });
    });
  });

  describe('org chart tab (MD-198, D102, D104)', () => {
    it('shows the org chart instead of the people and goes back, keeping the people loaded', () => {
      setup();
      click('[data-test-tab-org]');
      expect(q('[data-test-tab-org]').getAttribute('aria-selected')).toBe('true');
      expect(q('app-team-org-chart')).not.toBeNull();
      expect(el().querySelector('app-team-invite-form')).toBeNull();
      expect(el().querySelector('app-data-table')).toBeNull();
      expect(q('app-team-org-chart').textContent).toContain('Equipo de Ana');
      expect(api.listAll).toHaveBeenCalledTimes(1);
      click('[data-test-tab-people]');
      expect(el().querySelector('app-team-org-chart')).toBeNull();
      expect(q('app-team-invite-form')).not.toBeNull();
      expect(api.list).toHaveBeenCalledTimes(1); // las personas no se volvieron a pedir al cambiar de pestaña
    });

    it('names the tab for the owner as their own team', () => {
      setup([DELEGATE], 'responsable', [GROUPS[1]]);
      expect(q('[data-test-tab-org]').textContent).toContain('TEAM.TABS.GROUPS_OWN');
      TestBed.resetTestingModule();
      setup();
      expect(q('[data-test-tab-org]').textContent).toContain('TEAM.TABS.GROUPS');
      expect(q('[data-test-tab-org]').textContent).not.toContain('GROUPS_OWN');
    });

    it('asks again for the groups and the people when something changes in the org chart', () => {
      setup();
      click('[data-test-tab-org]');
      const groupCalls = groupApi.list.calls.count();
      const peopleCalls = api.list.calls.count();
      fixture.componentInstance.onGroupsChanged();
      expect(groupApi.list.calls.count()).toBe(groupCalls + 1);
      expect(api.list.calls.count()).toBe(peopleCalls + 1);
    });

    it('sends the administrator to the org chart from the warning that a delegate needs a team', () => {
      setup([ME], 'admin_empresa', [GROUPS[0]]);
      type('[data-test-role]', 'delegado');
      click('[data-test-go-groups]');
      expect(q('app-team-org-chart')).not.toBeNull();
    });

    it('does not say «no team» while the groups are still arriving (they load apart from the people)', () => {
      const arriving = new Subject<Group[]>();
      setup([ME], 'admin_empresa', [], arriving);
      type('[data-test-role]', 'delegado');
      expect(el().querySelector('[data-test-no-team]')).toBeNull();
      arriving.next([]);
      arriving.complete();
      fixture.detectChanges();
      expect(q('[data-test-no-team]')).not.toBeNull();
    });

    it('when a responsible was created but their team was not, says it and asks the groups again', () => {
      setup();
      const before = groupApi.list.calls.count();
      fixture.componentInstance.onTeamFailed('Ese nombre ya existe.');
      fixture.detectChanges();
      expect(q('[role="alert"]').textContent).toContain('TEAM.ERROR.TEAM_NOT_CREATED');
      expect(q('[role="alert"]').textContent).toContain('Ese nombre ya existe.');
      expect(groupApi.list.calls.count()).toBe(before + 1);
    });

    it('when the team of the new responsible exists, asks the groups again so the org chart sees it', () => {
      setup();
      const before = groupApi.list.calls.count();
      fixture.componentInstance.onTeamCreated();
      expect(groupApi.list.calls.count()).toBe(before + 1);
    });
  });
  describe('the invitation goes out by email (MD-190)', () => {
    it('after creating someone, says the invitation was sent, without showing any code, and asks the list again', () => {
      setup();
      api.invite.and.returnValue(of(invited()));
      type('[data-test-role]', 'auditor');
      type('[data-test-email]', 'juan@acme.co');
      type('[data-test-name]', 'Juan');
      type('[data-test-last-name]', 'Pérez');
      const callsBefore = api.list.calls.count();
      click('[data-test-invite]');
      const box = q('[data-test-invitation]');
      expect(box.getAttribute('data-status')).toBe('sent');
      expect(box.textContent).toContain('TEAM.INVITATION.SENT_TITLE');
      expect(el().querySelector('[data-test-resend]')).toBeNull();
      expect(el().querySelector('[data-test-code-value]')).toBeNull();
      expect(api.list.calls.count()).toBe(callsBefore + 1);
      click('[data-test-invitation-dismiss]');
      expect(el().querySelector('[data-test-invitation]')).toBeNull();
    });

    it('when the email did not go out, the account exists and the invitation can be resent from the notice', () => {
      setup();
      fixture.componentInstance.onInvited(invited({ delivery: 'failed' }));
      fixture.detectChanges();
      expect(q('[data-test-invitation]').getAttribute('data-status')).toBe('failed');
      expect(q('[data-test-invitation]').textContent).toContain('TEAM.INVITATION.FAILED_TITLE');
      api.resendInvitation.and.returnValue(of({ delivery_status: 'sent', expires_at: '2026-11-13T10:00:00Z' }));
      click('[data-test-resend]');
      expect(api.resendInvitation).toHaveBeenCalledWith('new');
      expect(q('[data-test-invitation]').getAttribute('data-status')).toBe('sent');
      expect(el().querySelector('[data-test-resend]')).toBeNull();
    });

    it('lets the correction of an existing email jump to the name of that person', () => {
      setup();
      type('[data-test-role]', 'auditor');
      type('[data-test-email]', 'PEN@acme.co');
      type('[data-test-name]', 'Juan');
      type('[data-test-last-name]', 'Pérez');
      click('[data-test-fix-existing]');
      expect(q('[data-test-edit-name]')).not.toBeNull();
    });
  });

  describe('owner', () => {
    it('sees only their team, can create delegates but has no actions over people (the API answers 403 to them)', () => {
      setup([DELEGATE], 'responsable', [GROUPS[1]]);
      expect(row('del@acme.co').textContent).toContain('Dani Lara');
      expect(el().querySelector('[data-test-edit-name-btn]')).toBeNull();
      expect(el().querySelector('[data-test-deactivate]')).toBeNull();
      expect(Array.from(el().querySelectorAll<HTMLOptionElement>('[data-test-role] option')).map((o) => o.value)).toEqual(['delegado']);
    });

    it('does not offer to resend a failed invitation (only the administrator can)', () => {
      setup([DELEGATE], 'responsable', [GROUPS[1]]);
      fixture.componentInstance.onInvited(invited({ delivery: 'failed', role: 'delegado' }));
      fixture.detectChanges();
      expect(q('[data-test-invitation]').getAttribute('data-status')).toBe('failed');
      expect(el().querySelector('[data-test-resend]')).toBeNull();
    });
  });
});
