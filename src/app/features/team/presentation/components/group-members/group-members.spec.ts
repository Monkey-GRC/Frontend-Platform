import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { Group } from '../../../domain/models/group.models';
import { TeamMember, TeamPage } from '../../../domain/models/team.models';
import { TeamService } from '../../../domain/services/team.service';
import { GroupMembers } from './group-members';

const leader = (id: string, name: string) => ({ id, name, last_name: 'Gómez', role: 'responsable' });
const TEAM_MARIA: Group = { id: 'team-maria', name: 'Equipo de María', kind: 'team', leader: leader('r1', 'María'), members_count: 2 };
const TEAM_PEDRO: Group = { id: 'team-pedro', name: 'Equipo de Pedro', kind: 'team', leader: leader('r2', 'Pedro'), members_count: 0 };
const RESPONSABLES: Group = { id: 'resp', name: 'Responsables', kind: 'responsables', leader: { id: 'a1', name: 'Ada', last_name: 'Admin', role: 'admin_empresa' }, members_count: 1 };

const member = (over: Partial<TeamMember>): TeamMember => ({
  id: 'u0', email: 'x@acme.co', name: 'Persona', last_name: 'Prueba', role: 'delegado', status: 'active', is_mfa_enabled: false, is_internal: true, last_login_at: null, created_at: '2026-11-01T00:00:00Z', ...over,
});
const DANI = member({ id: 'dani', email: 'dani@acme.co', name: 'Dani', last_name: 'Lara' });
const EVA = member({ id: 'eva', email: 'eva@acme.co', name: 'Eva', last_name: 'Gil', is_internal: false });
const pageOf = (items: TeamMember[], over: Partial<TeamPage> = {}): TeamPage => ({ items, page: 1, page_size: 100, total: items.length, total_pages: 1, ...over });
const httpError = (status: number, code: string, extra: Record<string, unknown> = {}, message?: string) => new HttpErrorResponse({ status, error: { ...(message ? { message } : {}), error: { code, ...extra } } });

describe('GroupMembers (MD-198, D102)', () => {
  let api: jasmine.SpyObj<TeamService>;
  let fixture: ComponentFixture<GroupMembers>;
  let moved: number;

  function setup(group: Group = TEAM_MARIA, members: TeamMember[] = [DANI, EVA], opts: { canMove?: boolean; teams?: Group[] } = {}): void {
    api = jasmine.createSpyObj<TeamService>('TeamService', ['list', 'update']);
    api.list.and.returnValue(of(pageOf(members)));
    TestBed.configureTestingModule({ imports: [GroupMembers], providers: [provideTranslateService({ fallbackLang: 'es' }), { provide: TeamService, useValue: api }] });
    fixture = TestBed.createComponent(GroupMembers);
    fixture.componentRef.setInput('group', group);
    fixture.componentRef.setInput('teams', opts.teams ?? [TEAM_MARIA, TEAM_PEDRO]);
    fixture.componentRef.setInput('canMove', opts.canMove ?? true);
    moved = 0;
    fixture.componentInstance.moved.subscribe(() => moved++);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => el().querySelector<T>(selector)!;
  const person = (email: string) => q(`[data-test-person="${email}"]`);
  const click = (target: string | HTMLElement) => {
    (typeof target === 'string' ? q<HTMLElement>(target) : target).click();
    fixture.detectChanges();
  };
  const pick = (value: string) => {
    const select = q<HTMLSelectElement>('[data-test-move-target]');
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  it('asks the server for the people of this group and shows them with their role, state and whether they are internal or external', () => {
    setup();
    expect(api.list).toHaveBeenCalledWith({ groupId: 'team-maria' }, 1, 100);
    expect(person('dani@acme.co').textContent).toContain('Dani Lara');
    expect(person('dani@acme.co').textContent).toContain('TEAM.ROLE.DELEGADO');
    expect(person('dani@acme.co').textContent).toContain('TEAM.INVITE.INTERNAL');
    expect(person('eva@acme.co').textContent).toContain('TEAM.INVITE.EXTERNAL');
  });

  it('says so when the group has nobody, and when the list cannot be loaded offers a retry', () => {
    setup(TEAM_PEDRO, []);
    expect(q('[data-test-members-empty]').textContent).toContain('TEAM.GROUPS.MEMBERS_EMPTY');
    api.list.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(q('[data-test-members-load-error]')).not.toBeNull();
    api.list.and.returnValue(of(pageOf([DANI])));
    click('[data-test-members-load-error] button');
    expect(person('dani@acme.co')).not.toBeNull();
  });

  it('warns when the group has more people than the ones shown', () => {
    setup();
    api.list.and.returnValue(of(pageOf([DANI], { total: 130, total_pages: 2 })));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(q('[data-test-members-more]').textContent).toContain('TEAM.GROUPS.MEMBERS_MORE');
  });

  describe('moving a delegate (only the administrator)', () => {
    it('offers it only to the administrator, only on delegates, and says when there is no other team', () => {
      setup(TEAM_MARIA, [DANI]);
      expect(person('dani@acme.co').querySelector('[data-test-move]')).not.toBeNull();
      TestBed.resetTestingModule();
      setup(TEAM_MARIA, [DANI], { canMove: false });
      expect(el().querySelector('[data-test-move]')).toBeNull();
      TestBed.resetTestingModule();
      setup(RESPONSABLES, [member({ id: 'r', email: 'r@acme.co', role: 'responsable' })]);
      expect(el().querySelector('[data-test-move]')).toBeNull(); // un responsable no se mueve de equipo
      TestBed.resetTestingModule();
      setup(TEAM_MARIA, [DANI], { teams: [TEAM_MARIA] });
      expect(el().querySelector('[data-test-move]')).toBeNull();
      expect(q('[data-test-no-destination]')).not.toBeNull();
    });

    it('offers every team but the current one, and moves with no confirmation when the delegate executes nothing', () => {
      setup();
      api.update.and.returnValue(of(DANI));
      click(person('dani@acme.co').querySelector<HTMLElement>('[data-test-move]')!);
      expect(Array.from(el().querySelectorAll<HTMLOptionElement>('[data-test-move-target] option')).map((o) => o.value)).toEqual(['', 'team-pedro']);
      expect(q<HTMLButtonElement>('[data-test-move-confirm]').disabled).toBeTrue();
      pick('team-pedro');
      click('[data-test-move-confirm]');
      expect(api.update).toHaveBeenCalledOnceWith('dani', { group_id: 'team-pedro' });
      expect(q('[data-test-members-notice]').textContent).toContain('TEAM.GROUPS.NOTICE.MOVED');
      expect(moved).toBe(1);
      expect(el().querySelector('[data-test-move-target]')).toBeNull();
    });

    it('when the delegate executes controls, asks first how many would lose their executor and only then repeats the move with the confirmation', () => {
      setup();
      api.update.and.returnValues(throwError(() => httpError(409, 'USER_HAS_ASSIGNMENTS', { controls_count: 4 })), of(DANI));
      click(person('dani@acme.co').querySelector<HTMLElement>('[data-test-move]')!);
      pick('team-pedro');
      click('[data-test-move-confirm]');
      expect(api.update).toHaveBeenCalledTimes(1);
      expect(moved).toBe(0);
      const dialog = el().querySelector('app-confirm-dialog')!;
      expect(dialog.textContent).toContain('TEAM.GROUPS.MOVE_CONFIRM');
      Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('TEAM.GROUPS.MOVE_CONFIRM'))!.click();
      fixture.detectChanges();
      expect(api.update.calls.mostRecent().args).toEqual(['dani', { group_id: 'team-pedro', confirm_unassign: true }]);
      expect(moved).toBe(1);
      expect(el().querySelector('app-confirm-dialog')).toBeNull();
    });

    it('does not move anybody when the administrator cancels the confirmation', () => {
      setup();
      api.update.and.returnValue(throwError(() => httpError(409, 'USER_HAS_ASSIGNMENTS', { controls_count: 2 })));
      click(person('dani@acme.co').querySelector<HTMLElement>('[data-test-move]')!);
      pick('team-pedro');
      click('[data-test-move-confirm]');
      Array.from(el().querySelectorAll<HTMLButtonElement>('app-confirm-dialog button')).find((b) => b.textContent?.includes('COMMON.CANCEL'))!.click();
      fixture.detectChanges();
      expect(el().querySelector('app-confirm-dialog')).toBeNull();
      expect(api.update).toHaveBeenCalledTimes(1);
      expect(moved).toBe(0);
    });

    it('explains that the destination is not available when the server does not find it (its owner is no longer active)', () => {
      setup();
      api.update.and.returnValue(throwError(() => httpError(404, 'NOT_FOUND')));
      click(person('dani@acme.co').querySelector<HTMLElement>('[data-test-move]')!);
      pick('team-pedro');
      click('[data-test-move-confirm]');
      expect(q('[data-test-members-error]').textContent).toContain('TEAM.GROUPS.ERROR.MOVE_TARGET');
      expect(moved).toBe(0);
    });

    it('shows the translated message of any other error the server sends', () => {
      setup();
      api.update.and.returnValue(throwError(() => httpError(422, 'VALIDATION_FAILED', {}, 'Revisa los datos.')));
      click(person('dani@acme.co').querySelector<HTMLElement>('[data-test-move]')!);
      pick('team-pedro');
      click('[data-test-move-confirm]');
      expect(q('[data-test-members-error]').textContent).toContain('Revisa los datos.');
    });

    it('lets the administrator back out of choosing a destination', () => {
      setup();
      click(person('dani@acme.co').querySelector<HTMLElement>('[data-test-move]')!);
      expect(q('[data-test-move-target]')).not.toBeNull();
      fixture.componentInstance.cancelMove();
      fixture.detectChanges();
      expect(el().querySelector('[data-test-move-target]')).toBeNull();
      expect(api.update).not.toHaveBeenCalled();
    });
  });
});
