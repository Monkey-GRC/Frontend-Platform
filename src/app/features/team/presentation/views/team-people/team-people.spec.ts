import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { Observable, Subject, of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { Group } from '@features/team/domain/models/group.models';
import { InvitedMember, TeamMember, TeamPage, TeamWorkloadResponse } from '@shared/domain/models/team.models';
import { GroupService } from '@features/team/domain/services/group.service';
import { TeamService } from '@shared/domain/services/team.service';
import { TeamPeopleView } from './team-people';
import { isSelect, optionValues, pickOption } from '@shared/presentation/components/select/select.testing';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';

const toastText = (): string => TestBed.inject(ToastService).toasts().map((t) => `${t.title} ${t.message}`).join(' | ');

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

describe('TeamPeopleView (MD-197, D96, D102)', () => {
  let api: jasmine.SpyObj<TeamService>;
  let groupApi: jasmine.SpyObj<GroupService>;
  let fixture: ComponentFixture<TeamPeopleView>;

  function setup(members: TeamMember[] = [ME, OTHER_ADMIN, ANA, DELEGATE, PENDING], role = 'admin_empresa', groups: Group[] = GROUPS, groups$?: Observable<Group[]>, workload$?: Observable<TeamWorkloadResponse>): void {
    api = jasmine.createSpyObj<TeamService>('TeamService', ['list', 'listAll', 'workload', 'invite', 'update', 'resendInvitation', 'resetMfa']);
    api.list.and.returnValue(of(pageOf(members)));
    api.listAll.and.returnValue(of(members));
    api.workload.and.returnValue(workload$ ?? of({ items: [], unassigned_count: 0 }));
    groupApi = jasmine.createSpyObj<GroupService>('GroupService', ['list']);
    groupApi.list.and.returnValue(groups$ ?? of(groups));
    TestBed.configureTestingModule({
      imports: [TeamPeopleView],
      providers: [provideTranslateService({ fallbackLang: 'es' }), provideRouter([]), { provide: TeamService, useValue: api }, { provide: GroupService, useValue: groupApi }],
    });
    TestBed.inject(SessionService).set({ id: role === 'admin_empresa' ? 'me' : 'ana', email: 'admin@acme.co', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(TeamPeopleView);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => el().querySelector<T>(selector)!;
  const row = (email: string) => q(`[data-test-member="${email}"]`).closest('tr') as HTMLElement;
  const type = (selector: string, value: string) => {
    if (isSelect(el(), selector)) return pickOption(el(), selector, value, () => fixture.detectChanges());
    const input = q<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const click = (selector: string | HTMLElement) => {
    (typeof selector === 'string' ? q<HTMLElement>(selector) : selector).click();
    fixture.detectChanges();
  };
  const lastListCall = () => api.list.calls.mostRecent().args;
  /** Opens the detail panel of a person from their row. */
  const open = (email: string) => click(row(email));
  const inPanel = (selector: string) => q(`[role="dialog"] ${selector}`);
  const filter = (name: string, value: string) => type(`[data-test-filter-${name}]`, value);

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
      expect(row('pen@acme.co').querySelector('[data-person-secondary]')!.textContent).toContain('TEAM.NO_NAME');
      expect(row('ana@acme.co').textContent).toContain('TEAM.LIST.NEVER'); // nunca ha ingresado
    });

    it('has no tab bar (People and Groups are pages of the menu) and no work split by service and dimension (D102): it only loads the people and the groups', () => {
      setup();
      expect(el().querySelector('[role="tab"]')).toBeNull();
      expect(el().querySelector('app-tabs')).toBeNull();
      expect(api.list).toHaveBeenCalledTimes(1);
      expect(groupApi.list).toHaveBeenCalledTimes(1);
    });

    it('is a table styled like the rest of the product: people with avatar, state with a dot, and an arrow at the end of every row', () => {
      setup();
      expect(el().querySelectorAll('tbody tr').length).toBe(5);
      expect(row('ana@acme.co').querySelector('app-person-cell [data-avatar]')!.textContent!.trim()).toBe('AR');
      expect(row('ana@acme.co').querySelector('app-status-indicator[data-tone="ok"]')).not.toBeNull();
      expect(row('ana@acme.co').querySelector('[data-row-chevron]')).not.toBeNull();
      expect(Array.from(el().querySelectorAll('thead th')).map((th) => th.textContent!.trim())).toContain('TEAM.COLUMNS.AFFILIATION');
    });

    it('hides the internal-or-external column when nobody on the page is a delegate', () => {
      setup([ME, ANA]);
      expect(el().textContent).not.toContain('TEAM.COLUMNS.AFFILIATION');
    });

    it('puts the filters in the toolbar as selects with no label above them, named by their first option', () => {
      setup();
      expect(el().querySelector('app-table-toolbar app-table-filter [data-select-trigger][aria-label="TEAM.FILTERS.ROLE"]')).not.toBeNull();
      expect(el().querySelectorAll('app-table-toolbar app-table-filter').length).toBe(4);
      expect(el().querySelector('label[for="filter-role"]')).toBeNull();
      expect(el().querySelector('app-table-toolbar app-select')).not.toBeNull();
      expect(el().querySelector('app-table-toolbar select')).toBeNull();
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
      filter('role', 'delegado'); // la primera, lenta
      filter('status', 'pending'); // la segunda, más nueva y rápida
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
      expect(optionValues(el(), '[data-test-filter-status]', () => fixture.detectChanges())).toEqual(['', 'active', 'pending', 'inactive']);
      TestBed.resetTestingModule();
      setup();
      filter('role', 'delegado');
      expect(lastListCall()[0]).toEqual({ role: 'delegado', status: null, groupId: null, isInternal: null });
      filter('status', 'pending');
      filter('group', 'team-ana');
      filter('affiliation', 'external');
      expect(lastListCall()).toEqual([{ role: 'delegado', status: 'pending', groupId: 'team-ana', isInternal: false }, 1, 25]);
      filter('affiliation', 'internal');
      expect(lastListCall()[0]?.isInternal).toBeTrue();
      click('[data-test-clear-filters]');
      expect(lastListCall()[0]).toEqual({ role: null, status: null, groupId: null, isInternal: null });
      expect(el().querySelector('[data-test-clear-filters]')).toBeNull();
    });

    it('goes back to page 1 when a filter changes', () => {
      setup();
      fixture.componentInstance.goTo(4);
      filter('role', 'auditor');
      expect(lastListCall()[1]).toBe(1);
    });

    it('offers the groups the server gave as the group filter', () => {
      setup();
      const options = optionValues(el(), '[data-test-filter-group]', () => fixture.detectChanges());
      expect(options).toEqual(['', 'resp', 'team-ana']);
    });
  });

  describe('the person detail panel (there is no detail endpoint: it shows what the list brings)', () => {
    it('opens from the row, with a click and with Enter, and shows the data of the list in read-only', () => {
      setup();
      const r = row('del@acme.co');
      expect(r.getAttribute('tabindex')).toBe('0');
      expect(el().querySelector('[role="dialog"]')).toBeNull();
      r.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();
      const panel = q('[role="dialog"]');
      expect(panel.textContent).toContain('Dani Lara');
      expect(panel.textContent).toContain('del@acme.co');
      expect(panel.textContent).toContain('TEAM.ROLE.DELEGADO');
      expect(panel.textContent).toContain('Equipo de Ana');
      expect(panel.textContent).toContain('Ana Ruiz'); // su responsable
      expect(panel.textContent).toContain('TEAM.INVITE.EXTERNAL');
      expect(panel.querySelector('[data-test-detail-mfa]')!.textContent).toContain('TEAM.DETAIL.YES');
      expect(panel.querySelector('app-badge[data-kind="status"]')).not.toBeNull();
    });

    it('is organised as profile, summary, general information and actions, with an icon in the header and an X that closes', () => {
      setup();
      open('ana@acme.co');
      const panel = q('[role="dialog"]');
      expect(panel.querySelector('[data-modal-icon]')).not.toBeNull();
      expect(panel.querySelector('[data-test-profile] [data-avatar]')).not.toBeNull();
      expect(panel.querySelector('[data-test-summary]')!.querySelectorAll('.material-symbols-rounded').length).toBe(3);
      expect(panel.querySelectorAll('[data-test-actions] li button').length).toBeGreaterThan(0);
      // The footer only closes: the actions live in the list, not twice.
      expect(panel.querySelectorAll('footer button').length).toBe(1);
      expect(panel.querySelector('[data-test-deactivate] .text-bad-ink')).not.toBeNull();
      click('[data-close-x]');
      expect(el().querySelector('[role="dialog"]')).toBeNull();
    });

    it('shows the workload in the summary: «—» while there is none, and the counts, the readiness with its percentage and the coverage once it arrives', () => {
      setup();
      open('ana@acme.co');
      const summary = q('[data-test-summary]');
      expect(summary.querySelector('[data-test-workload-owned]')!.textContent!.trim()).toBe('—');
      expect(summary.querySelector('[data-test-workload-progress]')).toBeNull();
      fixture.componentInstance.workload.set({
        owned_count: 50,
        executed_count: 12,
        progress: { readiness: 'needs_work', progress: { done: 20, total: 50 }, coverage: { measured: 46, applicable: 50 } },
      });
      fixture.detectChanges();
      expect(summary.querySelector('[data-test-workload-owned]')!.textContent!.trim()).toBe('50');
      expect(summary.querySelector('[data-test-workload-executed]')!.textContent!.trim()).toBe('12');
      expect(summary.textContent).toContain('COMMON.READINESS.LABEL.NEEDS_WORK');
      expect(summary.querySelector('[data-test-workload-progress]')!.textContent).toContain('40 %');
      expect(summary.querySelector('[data-test-workload-coverage]')).not.toBeNull();
    });

    it('fills the summary from the one team workload request, by the person opened', () => {
      const item = { user: { id: 'ana', name: 'Ana', last_name: 'Ruiz', role: 'responsable' as const }, owned_count: 7, executed_count: 2, progress: { readiness: 'needs_work' as const, progress: { done: 1, total: 4 }, coverage: { measured: 4, applicable: 4 } } };
      setup(undefined, 'admin_empresa', GROUPS, undefined, of({ items: [item], unassigned_count: 0 }));
      open('ana@acme.co');
      expect(q('[data-test-workload-owned]').textContent!.trim()).toBe('7');
      expect(q('[data-test-workload-progress]').textContent).toContain('25 %');
      click('[data-close-x]');
      open('adm2@acme.co');
      expect(q('[data-test-workload-owned]').textContent!.trim()).toBe('—');
      expect(api.workload).toHaveBeenCalledTimes(1);
    });

    it('keeps the em dash and shows no error when the workload request fails', () => {
      setup(undefined, 'admin_empresa', GROUPS, undefined, throwError(() => new HttpErrorResponse({ status: 500 })));
      open('ana@acme.co');
      expect(q('[data-test-workload-owned]').textContent!.trim()).toBe('—');
      expect(el().querySelector('[role="alert"]')).toBeNull();
    });

    it('without the admin role it neither asks for the workload nor shows the summary, and the profile takes the full width', () => {
      setup(undefined, 'responsable');
      open('ana@acme.co');
      expect(api.workload).not.toHaveBeenCalled();
      expect(el().querySelector('[data-test-summary]')).toBeNull();
      expect(q('[data-test-profile]').classList).toContain('lg:col-span-2');
    });

    it('does not repeat in the general information what the profile already says (the status), and keeps the last sign-in there', () => {
      setup();
      open('ana@acme.co');
      const general = q('[aria-labelledby="person-general"]');
      expect(general.textContent).not.toContain('TEAM.COLUMNS.STATUS');
      expect(general.querySelector('[data-test-last-login]')).not.toBeNull();
    });

    it('closes with the close button', () => {
      setup();
      open('ana@acme.co');
      click('[data-cancel]');
      expect(el().querySelector('[role="dialog"]')).toBeNull();
    });

    it('opens from the arrow at the end of the row', () => {
      setup();
      row('ana@acme.co').querySelector<HTMLElement>('[data-row-chevron]')!.click();
      fixture.detectChanges();
      expect(el().querySelector('[role="dialog"]')).not.toBeNull();
    });

    it('offers the actions that already exist, only the ones that apply to that person, and none to the owner', () => {
      setup();
      open('pen@acme.co');
      expect(inPanel('[data-test-reissue]')).not.toBeNull();
      expect(el().querySelector('[role="dialog"] [data-test-deactivate]')).toBeNull();
      click('[data-cancel]');
      open('ana@acme.co');
      expect(inPanel('[data-test-reset-mfa]')).not.toBeNull();
      expect(inPanel('[data-test-deactivate]')).not.toBeNull();
      click('[data-cancel]');
      TestBed.resetTestingModule();
      setup([DELEGATE], 'responsable', [GROUPS[1]]);
      open('del@acme.co');
      expect(inPanel('[data-test-detail]')).not.toBeNull();
      expect(el().querySelector('[role="dialog"] [data-test-deactivate]')).toBeNull();
      expect(el().querySelector('[role="dialog"] [data-test-edit-name-btn]')).toBeNull();
    });
  });

  describe('administrator', () => {
    it('gives the other people their actions (name, deactivate) but not the ones that do not apply, and on themselves only the name', () => {
      setup();
      open('adm2@acme.co');
      expect(inPanel('[data-test-deactivate]')).not.toBeNull();
      expect(el().querySelector('[data-test-reset-mfa]')).toBeNull(); // el de un administrador lo restablece Monkey
      click('[data-cancel]');
      open('admin@acme.co');
      expect(inPanel('[data-test-edit-name-btn]')).not.toBeNull();
      expect(el().querySelector('[data-test-deactivate]')).toBeNull();
    });

    it('corrects the name of anybody in the team, including the administrator himself', () => {
      setup();
      api.update.and.returnValue(of({ ...PENDING, name: 'Pedro', last_name: 'Gil' }));
      open('pen@acme.co');
      click('[data-test-edit-name-btn]');
      type('[data-test-edit-name]', 'Pedro');
      type('[data-test-edit-last-name]', 'Gil');
      click('[data-test-save-name]');
      expect(api.update).toHaveBeenCalledWith('pen', { name: 'Pedro', last_name: 'Gil' });
    });

    it('asks before deactivating and only then closes the account', () => {
      setup();
      api.update.and.returnValue(of({ ...ANA, status: 'inactive' }));
      open('ana@acme.co');
      click('[data-test-deactivate]');
      expect(api.update).not.toHaveBeenCalled();
      const confirmButton = Array.from(el().querySelectorAll<HTMLButtonElement>('app-confirm-dialog button')).find((b) => b.textContent?.includes('TEAM.ACTIONS.DEACTIVATE'))!;
      confirmButton.click();
      fixture.detectChanges();
      expect(api.update).toHaveBeenCalledWith('ana', { status: 'inactive' });
    });

    it('shows the server message when a change is refused (for example the last administrator)', () => {
      setup();
      api.update.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Debe quedar al menos un administrador.', error: { code: 'LAST_ADMIN' } } })));
      open('adm2@acme.co');
      click('[data-test-deactivate]');
      const confirmButton = Array.from(el().querySelectorAll<HTMLButtonElement>('app-confirm-dialog button')).find((b) => b.textContent?.includes('TEAM.ACTIONS.DEACTIVATE'))!;
      confirmButton.click();
      fixture.detectChanges();
      expect(el().textContent).toContain('Debe quedar al menos un administrador.');
    });

    it('offers to resend the invitation only to people who have not activated their account', () => {
      setup();
      open('ana@acme.co');
      expect(el().querySelector('[data-test-reissue]')).toBeNull();
      click('[data-cancel]');
      open('pen@acme.co');
      api.resendInvitation.and.returnValue(of({ delivery_status: 'sent', expires_at: '2026-11-13T10:00:00Z' }));
      click('[data-test-reissue]');
      expect(api.resendInvitation).toHaveBeenCalledWith('pen');
      expect(toastText()).toContain('TEAM.INVITATION.SENT_TITLE');
    });

    it('reactivates a deactivated account', () => {
      setup([ME, member({ id: 'old', email: 'old@acme.co', status: 'inactive' })]);
      api.update.and.returnValue(of(member({ id: 'old', email: 'old@acme.co' })));
      open('old@acme.co');
      click('[data-test-reactivate]');
      expect(api.update).toHaveBeenCalledWith('old', { status: 'active' });
    });
  });

  describe('groups (MD-198): their own page, `/equipo/grupos`', () => {
    it('has no groups tab: the groups are not part of this page', () => {
      setup();
      expect(el().querySelector('app-team-groups')).toBeNull();
      expect(el().querySelector('app-data-table')).not.toBeNull();
    });

    it('asks again for the groups and the people when a delegate is moved or a group changes', () => {
      setup();
      const groupCalls = groupApi.list.calls.count();
      const peopleCalls = api.list.calls.count();
      fixture.componentInstance.onGroupsChanged();
      expect(groupApi.list.calls.count()).toBe(groupCalls + 1);
      expect(api.list.calls.count()).toBe(peopleCalls + 1);
    });

    it('sends the administrator to the org chart from the warning that a delegate needs a team', () => {
      setup([ME], 'admin_empresa', [GROUPS[0]]);
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      click('[data-test-open-invite]');
      type('[data-test-role]', 'delegado');
      click('[data-test-go-groups]');
      expect(navigate).toHaveBeenCalledWith(['/equipo/organigrama']);
      expect(el().querySelector('[role="dialog"]')).toBeNull();
    });

    it('does not say «no team» while the groups are still arriving (they load apart from the people)', () => {
      const arriving = new Subject<Group[]>();
      setup([ME], 'admin_empresa', [], arriving);
      click('[data-test-open-invite]');
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

    it('when the team of the new responsible exists, asks the groups again so the groups page sees it', () => {
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
      click('[data-test-open-invite]');
      type('[data-test-role]', 'auditor');
      type('[data-test-email]', 'juan@acme.co');
      type('[data-test-name]', 'Juan');
      type('[data-test-last-name]', 'Pérez');
      const callsBefore = api.list.calls.count();
      click('[data-test-invite]');
      // Sent: a toast with the recipient (MD-485); the box with «Reenviar» is only for a failed email.
      expect(el().querySelector('[data-test-invitation]')).toBeNull();
      expect(toastText()).toContain('TEAM.INVITATION.SENT_TITLE');
      expect(el().querySelector('[data-test-resend]')).toBeNull();
      expect(el().querySelector('[data-test-code-value]')).toBeNull();
      expect(api.list.calls.count()).toBe(callsBefore + 1);
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
      expect(el().querySelector('[data-test-invitation]')).toBeNull();
      expect(toastText()).toContain('TEAM.INVITATION.SENT_TITLE');
      expect(el().querySelector('[data-test-resend]')).toBeNull();
    });

    it('lets the correction of an existing email jump to the name of that person', () => {
      setup();
      click('[data-test-open-invite]');
      type('[data-test-role]', 'auditor');
      type('[data-test-email]', 'PEN@acme.co');
      type('[data-test-name]', 'Juan');
      type('[data-test-last-name]', 'Pérez');
      click('[data-test-fix-existing]');
      expect(q('[data-test-edit-name]')).not.toBeNull();
    });
  });

  describe('invite modal', () => {
    it('keeps the form out of the page until «Invitar» opens it, and shows one primary action', () => {
      setup();
      expect(el().querySelector('app-team-invite-form')).toBeNull();
      expect(el().querySelector('[role="dialog"]')).toBeNull();
      click('[data-test-open-invite]');
      expect(q('[role="dialog"] app-team-invite-form')).not.toBeNull();
      expect(el().querySelector('[data-test-email]')).not.toBeNull();
    });

    it('closes with the close button and discards the form', () => {
      setup();
      click('[data-test-open-invite]');
      click('[data-cancel]');
      expect(el().querySelector('[role="dialog"]')).toBeNull();
      expect(el().querySelector('app-team-invite-form')).toBeNull();
    });

    // El fondo de `app-modal` se cierra con el botón del ratón al bajar sobre él.
    const backdrop = (id: string) => {
      q(`[data-testid="${id}-backdrop"]`).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      fixture.detectChanges();
    };

    describe('dismissing the modal with Esc or a click on the background (at the view level, with the real form inside)', () => {
      const esc = () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true }));
        fixture.detectChanges();
      };
      const modalOpen = () => el().querySelector('[role="dialog"] app-team-invite-form') !== null;

      const confirm = () => document.querySelector<HTMLElement>('[role="alertdialog"]');
      const answer = (which: 'keep' | 'discard') => {
        confirm()!.querySelector<HTMLButtonElement>(which === 'keep' ? '[data-cancel]' : '[data-confirm]')!.click();
        fixture.detectChanges();
      };

      it('with something typed, Esc, the background and Cancel ask first; «Seguir editando» keeps what was written (MD-485)', () => {
        setup();
        click('[data-test-open-invite]');
        type('[data-test-email]', 'nuevo@acme.co');
        for (const close of [esc, () => backdrop('invite'), () => click('[data-testid="invite-cancel"]')]) {
          close();
          expect(modalOpen()).toBeTrue();
          expect(confirm()).not.toBeNull();
          answer('keep');
          expect(confirm()).toBeNull();
          expect(modalOpen()).toBeTrue();
          expect(q<HTMLInputElement>('[data-test-email]').value).toBe('nuevo@acme.co');
        }
      });

      it('«Descartar cambios» closes the dirty form', () => {
        setup();
        click('[data-test-open-invite]');
        type('[data-test-email]', 'nuevo@acme.co');
        click('[data-testid="invite-cancel"]');
        answer('discard');
        expect(el().querySelector('[role="dialog"]')).toBeNull();
      });

      it('closes with Esc and with the background while the form is still untouched', () => {
        setup();
        click('[data-test-open-invite]');
        esc();
        expect(el().querySelector('[role="dialog"]')).toBeNull();
        click('[data-test-open-invite]');
        backdrop('invite');
        expect(el().querySelector('[role="dialog"]')).toBeNull();
      });
    });

    describe('with the role select open (its panel lives in <body>, outside the dialog)', () => {
      const trigger = () => q<HTMLButtonElement>('[data-test-role] [data-select-trigger]');
      const panel = () => document.body.querySelector<HTMLElement>('[data-select-panel]');
      const esc = () => {
        trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true }));
        fixture.detectChanges();
      };
      const dialogOpen = () => el().querySelector('[role="dialog"] app-team-invite-form') !== null;

      it('choosing an option does not close the modal', () => {
        setup();
        click('[data-test-open-invite]');
        click('[data-test-role] [data-select-trigger]');
        expect(panel()).not.toBeNull();
        panel()!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        (panel()!.querySelector('[data-value="auditor"]') as HTMLElement).click();
        fixture.detectChanges();
        expect(panel()).toBeNull();
        expect(dialogOpen()).toBeTrue();
      });

      it('Esc closes only the select, and the following Esc closes the (untouched) modal', () => {
        setup();
        click('[data-test-open-invite]');
        click('[data-test-role] [data-select-trigger]');
        esc();
        expect(panel()).toBeNull();
        expect(dialogOpen()).toBeTrue();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true }));
        fixture.detectChanges();
        expect(dialogOpen()).toBeFalse();
      });

      it('a click on the modal outside the select closes only the select', () => {
        setup();
        click('[data-test-open-invite]');
        click('[data-test-role] [data-select-trigger]');
        q('[data-test-email]').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        fixture.detectChanges();
        expect(panel()).toBeNull();
        expect(dialogOpen()).toBeTrue();
      });
    });

    it('shows «Tú» as plain muted text, with no pill, and the status as a dot with its label', () => {
      setup();
      const me = row('admin@acme.co');
      expect(me.textContent).toContain('TEAM.YOU');
      expect(me.querySelector('.rounded-full:not([aria-hidden])')).toBeNull();
      expect(row('pen@acme.co').querySelector('app-status-indicator')!.getAttribute('data-tone')).toBe('warn');
    });
  });

  describe('owner', () => {
    it('sees only their team and has no actions over people nor invitation (the API answers 403 to them, D136)', () => {
      setup([DELEGATE], 'responsable', [GROUPS[1]]);
      expect(row('del@acme.co').textContent).toContain('Dani Lara');
      expect(el().querySelector('[data-test-edit-name-btn]')).toBeNull();
      expect(el().querySelector('[data-test-deactivate]')).toBeNull();
      expect(el().querySelector('[data-test-open-invite]')).toBeNull();
      expect(el().querySelector('[data-test-invite]')).toBeNull();
    });
  });

  describe('collaborators (D136)', () => {
    it('can be filtered by their role and show their role label', () => {
      setup([ME, { ...ANA, id: 'col', email: 'col@acme.co', role: 'colaborador', name: 'Coco', last_name: 'Lara', group: null }]);
      expect(row('col@acme.co').textContent).toContain('TEAM.ROLE.COLABORADOR');
      filter('role', 'colaborador');
      expect(lastListCall()[0]).toEqual(jasmine.objectContaining({ role: 'colaborador' }));
    });
  });
});
