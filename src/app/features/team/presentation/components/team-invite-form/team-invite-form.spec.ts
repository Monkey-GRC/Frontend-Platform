import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { Group } from '../../../domain/models/group.models';
import { InvitedMember, TeamMember } from '../../../domain/models/team.models';
import { TeamService } from '../../../domain/services/team.service';
import { InviteActor, TeamInviteForm } from './team-invite-form';

const group = (over: Partial<Group>): Group => ({ id: 'g1', name: 'Grupo', kind: 'team', leader: { id: 'r1', name: 'María', last_name: 'Gómez', role: 'responsable' }, members_count: 0, ...over });
const TEAM_MARIA = group({ id: 'team-maria', name: 'Equipo de María' });
const TEAM_PEDRO = group({ id: 'team-pedro', name: 'Equipo de Pedro', leader: { id: 'r2', name: 'Pedro', last_name: 'Ruiz', role: 'responsable' } });
const RESPONSABLES = group({ id: 'resp', name: 'Responsables', kind: 'responsables', leader: { id: 'a1', name: 'Ada', last_name: 'Admin', role: 'admin_empresa' } });
const RESPONSABLES_IA = group({ id: 'resp-ia', name: 'Responsables - Servicio IA', kind: 'responsables', leader: { id: 'a1', name: 'Ada', last_name: 'Admin', role: 'admin_empresa' } });

const member = (over: Partial<TeamMember>): TeamMember => ({
  id: 'u0', email: 'x@acme.co', name: 'Persona', last_name: 'Prueba', role: 'delegado', status: 'active', is_mfa_enabled: true, last_login_at: null, created_at: '2026-11-01T00:00:00Z', ...over,
});
const created = (over: Partial<InvitedMember> = {}): InvitedMember => ({ ...member({ id: 'new', email: 'juan@acme.co', status: 'pending' }), invitation: { delivery_status: 'sent', expires_at: '2026-11-12T15:04:02Z' }, ...over });

describe('TeamInviteForm (MD-197, D102, D104)', () => {
  let api: jasmine.SpyObj<TeamService>;
  let fixture: ComponentFixture<TeamInviteForm>;

  function setup(actor: InviteActor, groups: Group[] = [], members: TeamMember[] = []): TeamInviteForm {
    api = jasmine.createSpyObj<TeamService>('TeamService', ['invite']);
    api.invite.and.returnValue(of(created()));
    TestBed.configureTestingModule({ imports: [TeamInviteForm], providers: [provideTranslateService({ fallbackLang: 'es' }), { provide: TeamService, useValue: api }] });
    fixture = TestBed.createComponent(TeamInviteForm);
    fixture.componentRef.setInput('actor', actor);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('members', members);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => el().querySelector<T>(selector)!;
  const type = (selector: string, value: string) => {
    const input = q<HTMLInputElement | HTMLSelectElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
    fixture.detectChanges();
  };
  const click = (selector: string) => {
    q<HTMLElement>(selector).click();
    fixture.detectChanges();
  };
  const fillPerson = (email = 'juan@acme.co') => {
    type('[data-test-email]', email);
    type('[data-test-name]', 'Juan');
    type('[data-test-last-name]', 'Pérez');
  };
  const submitDisabled = () => q<HTMLButtonElement>('[data-test-invite]').disabled;
  const roleValues = () => Array.from(el().querySelectorAll<HTMLOptionElement>('[data-test-role] option')).map((o) => o.value);

  describe('who can create whom (D102 punto 2)', () => {
    it('lets the administrator create every role', () => {
      setup('admin_empresa', [RESPONSABLES]);
      expect(roleValues()).toEqual(['responsable', 'delegado', 'auditor', 'admin_empresa']);
    });

    it('lets an owner create only delegates', () => {
      setup('responsable', [TEAM_MARIA]);
      expect(roleValues()).toEqual(['delegado']);
    });
  });

  describe('administrator', () => {
    it('needs the email, first and last name; an auditor and an administrator need nothing else, and send no group nor affiliation', () => {
      setup('admin_empresa', [RESPONSABLES]);
      type('[data-test-role]', 'auditor');
      expect(submitDisabled()).toBeTrue();
      fillPerson();
      expect(submitDisabled()).toBeFalse();
      click('[data-test-invite]');
      expect(api.invite).toHaveBeenCalledWith({ email: 'juan@acme.co', name: 'Juan', last_name: 'Pérez', role: 'auditor' });
      type('[data-test-role]', 'admin_empresa');
      fillPerson('otra@acme.co');
      click('[data-test-invite]');
      expect(api.invite).toHaveBeenCalledWith({ email: 'otra@acme.co', name: 'Juan', last_name: 'Pérez', role: 'admin_empresa' });
    });

    it('creates an owner in the default group when there is only one group of owners (nothing to choose)', () => {
      setup('admin_empresa', [RESPONSABLES]);
      fillPerson();
      expect(el().querySelector('[data-test-responsables-group]')).toBeNull();
      click('[data-test-invite]');
      expect(api.invite).toHaveBeenCalledWith({ email: 'juan@acme.co', name: 'Juan', last_name: 'Pérez', role: 'responsable' });
    });

    it('lets the administrator choose the group of owners once there is more than one, and sends it only when chosen', () => {
      setup('admin_empresa', [RESPONSABLES, RESPONSABLES_IA]);
      fillPerson();
      expect(q('[data-test-responsables-group]')).not.toBeNull();
      type('[data-test-responsables-group]', 'resp-ia');
      click('[data-test-invite]');
      expect(api.invite).toHaveBeenCalledWith({ email: 'juan@acme.co', name: 'Juan', last_name: 'Pérez', role: 'responsable', group_id: 'resp-ia' });
    });

    it('for a delegate asks whether it is internal or external, and the team (D104: it must already exist), before enabling the button', () => {
      setup('admin_empresa', [RESPONSABLES, TEAM_MARIA, TEAM_PEDRO]);
      type('[data-test-role]', 'delegado');
      fillPerson();
      expect(submitDisabled()).toBeTrue();
      click('[data-test-internal]');
      expect(submitDisabled()).toBeTrue(); // falta el equipo
      expect(Array.from(el().querySelectorAll<HTMLOptionElement>('[data-test-team] option')).map((o) => o.value)).toEqual(['', 'team-maria', 'team-pedro']);
      type('[data-test-team]', 'team-pedro');
      expect(submitDisabled()).toBeFalse();
      click('[data-test-invite]');
      expect(api.invite).toHaveBeenCalledWith({ email: 'juan@acme.co', name: 'Juan', last_name: 'Pérez', role: 'delegado', is_internal: true, group_id: 'team-pedro' });
    });

    it('sends an external delegate as is_internal false (a real choice, not a default)', () => {
      setup('admin_empresa', [TEAM_MARIA]);
      type('[data-test-role]', 'delegado');
      fillPerson();
      click('[data-test-external]');
      type('[data-test-team]', 'team-maria');
      click('[data-test-invite]');
      expect(api.invite).toHaveBeenCalledWith(jasmine.objectContaining({ role: 'delegado', is_internal: false, group_id: 'team-maria' }));
    });

    it('explains that no owner has a team yet and does not let a delegate be created without one', () => {
      setup('admin_empresa', [RESPONSABLES]);
      type('[data-test-role]', 'delegado');
      fillPerson();
      click('[data-test-internal]');
      expect(q('[data-test-no-team]').textContent).toContain('TEAM.INVITE.NO_TEAMS_ADMIN');
      expect(el().querySelector('[data-test-team]')).toBeNull();
      expect(submitDisabled()).toBeTrue();
    });
  });

  describe('owner', () => {
    it('creates a delegate in their own team: asks only the affiliation and never sends the group', () => {
      setup('responsable', [TEAM_MARIA]);
      fillPerson();
      expect(el().querySelector('[data-test-team]')).toBeNull();
      expect(submitDisabled()).toBeTrue();
      click('[data-test-internal]');
      expect(submitDisabled()).toBeFalse();
      click('[data-test-invite]');
      expect(api.invite).toHaveBeenCalledWith({ email: 'juan@acme.co', name: 'Juan', last_name: 'Pérez', role: 'delegado', is_internal: true });
    });

    it('while the owner has no team yet, says so and does not allow creating delegates', () => {
      setup('responsable', []);
      fillPerson();
      click('[data-test-internal]');
      expect(q('[data-test-no-team]').textContent).toContain('TEAM.INVITE.NO_TEAM_OWN');
      expect(submitDisabled()).toBeTrue();
    });
  });

  describe('after sending', () => {
    it('tells the parent who was created and clears the form', () => {
      const component = setup('admin_empresa', [RESPONSABLES]);
      let emitted: InvitedMember | null = null;
      component.invited.subscribe((m) => (emitted = m));
      type('[data-test-role]', 'auditor');
      fillPerson();
      click('[data-test-invite]');
      expect((emitted as InvitedMember | null)?.invitation.delivery_status).toBe('sent');
      expect(q<HTMLInputElement>('[data-test-email]').value).toBe('');
      expect(q<HTMLInputElement>('[data-test-name]').value).toBe('');
    });

    it('says under the email that it is registered when the server refuses it (another company), without a general error', () => {
      setup('admin_empresa', [RESPONSABLES]);
      api.invite.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Ya existe una cuenta con ese correo.', error: { code: 'EMAIL_TAKEN' } } })));
      type('[data-test-role]', 'auditor');
      fillPerson('otra@empresa.co');
      click('[data-test-invite]');
      expect(q('[data-test-email-error]').textContent).toContain('Ya existe una cuenta con ese correo.');
      expect(el().querySelector('[data-test-form-error]')).toBeNull();
    });

    it('explains the user limit with the numbers the server gives, and without them when it does not', () => {
      setup('admin_empresa', [RESPONSABLES]);
      type('[data-test-role]', 'auditor');
      fillPerson();
      api.invite.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { error: { code: 'USER_LIMIT_REACHED', max_users: 10, users_count: 10 } } })));
      click('[data-test-invite]');
      expect(q('[data-test-form-error]').textContent).toContain('TEAM.ERROR.USER_LIMIT_COUNTS');
      api.invite.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { error: { code: 'USER_LIMIT_REACHED' } } })));
      click('[data-test-invite]');
      expect(q('[data-test-form-error]').textContent).toContain('TEAM.ERROR.USER_LIMIT');
      expect(q('[data-test-form-error]').textContent).not.toContain('USER_LIMIT_COUNTS');
    });

    it('explains that the owner has no team when the server says so (RESPONSIBLE_HAS_NO_TEAM)', () => {
      setup('admin_empresa', [TEAM_MARIA]);
      api.invite.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { error: { code: 'RESPONSIBLE_HAS_NO_TEAM' } } })));
      type('[data-test-role]', 'delegado');
      fillPerson();
      click('[data-test-internal]');
      type('[data-test-team]', 'team-maria');
      click('[data-test-invite]');
      expect(q('[data-test-form-error]').textContent).toContain('TEAM.ERROR.NO_TEAM');
    });

    it('shows the translated message of any other error the server sends (validation)', () => {
      setup('admin_empresa', [RESPONSABLES]);
      api.invite.and.returnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { message: 'Revisa los datos.', error: { code: 'VALIDATION_FAILED' } } })));
      type('[data-test-role]', 'auditor');
      fillPerson();
      click('[data-test-invite]');
      expect(q('[data-test-form-error]').textContent).toContain('Revisa los datos.');
    });
  });

  describe('an email that is already in the team', () => {
    it('says so at once, does not allow creating it again and offers to fix the name', () => {
      const component = setup('admin_empresa', [RESPONSABLES], [member({ id: 'pen', email: 'pen@acme.co', name: null, last_name: null, status: 'pending', role: 'auditor' })]);
      let fixed: TeamMember | null = null;
      component.fixName.subscribe((m) => (fixed = m));
      type('[data-test-role]', 'auditor');
      fillPerson('PEN@acme.co');
      expect(q('[data-test-existing]').textContent).toContain('TEAM.INVITE.ALREADY_IN_TEAM');
      expect(submitDisabled()).toBeTrue();
      click('[data-test-fix-existing]');
      expect((fixed as TeamMember | null)?.id).toBe('pen');
      expect(el().querySelector('[data-test-existing]')).toBeNull();
    });
  });
});
