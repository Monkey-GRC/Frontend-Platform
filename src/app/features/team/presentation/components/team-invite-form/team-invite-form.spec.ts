import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { Group } from '@features/team/domain/models/group.models';
import { InvitedMember, TeamMember } from '@shared/domain/models/team.models';
import { GroupService } from '@features/team/domain/services/group.service';
import { TeamService } from '@shared/domain/services/team.service';
import { TeamInviteForm } from './team-invite-form';
import { isSelect, optionValues, pickOption } from '@shared/presentation/components/select/select.testing';

const group = (over: Partial<Group>): Group => ({ id: 'g1', name: 'Grupo', kind: 'team', leader: { id: 'r1', name: 'María', last_name: 'Gómez', role: 'responsable' }, members_count: 0, ...over });
const TEAM_MARIA = group({ id: 'team-maria', name: 'Equipo de María' });
const TEAM_PEDRO = group({ id: 'team-pedro', name: 'Equipo de Pedro', leader: { id: 'r2', name: 'Pedro', last_name: 'Ruiz', role: 'responsable' } });
const RESPONSABLES = group({ id: 'resp', name: 'Responsables', kind: 'responsables', leader: { id: 'a1', name: 'Ada', last_name: 'Admin', role: 'admin_empresa' } });

const member = (over: Partial<TeamMember>): TeamMember => ({
  id: 'u0', email: 'x@acme.co', name: 'Persona', last_name: 'Prueba', role: 'delegado', status: 'active', is_mfa_enabled: true, last_login_at: null, created_at: '2026-11-01T00:00:00Z', ...over,
});
const created = (over: Partial<InvitedMember> = {}): InvitedMember => ({ ...member({ id: 'new', email: 'juan@acme.co', status: 'pending' }), invitation: { delivery_status: 'sent', expires_at: '2026-11-12T15:04:02Z' }, ...over });

describe('TeamInviteForm (MD-197, D102, D104)', () => {
  let api: jasmine.SpyObj<TeamService>;
  let groupApi: jasmine.SpyObj<GroupService>;
  let fixture: ComponentFixture<TeamInviteForm>;

  function setup(groups: Group[] = [], members: TeamMember[] = []): TeamInviteForm {
    api = jasmine.createSpyObj<TeamService>('TeamService', ['invite']);
    api.invite.and.returnValue(of(created()));
    groupApi = jasmine.createSpyObj<GroupService>('GroupService', ['create']);
    groupApi.create.and.returnValue(of(TEAM_MARIA));
    TestBed.configureTestingModule({ imports: [TeamInviteForm], providers: [provideTranslateService({ fallbackLang: 'es' }), { provide: TeamService, useValue: api }, { provide: GroupService, useValue: groupApi }] });
    fixture = TestBed.createComponent(TeamInviteForm);
    fixture.componentRef.setInput('groups', groups);
    fixture.componentRef.setInput('members', members);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => el().querySelector<T>(selector)!;
  const type = (selector: string, value: string) => {
    if (isSelect(el(), selector)) return pickOption(el(), selector, value, () => fixture.detectChanges());
    const input = q<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
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
  // El botón de enviar vive en el pie del modal (la vista lo une a este formulario por su id): aquí se envía el formulario y se pregunta a `canSubmit`.
  const submitDisabled = () => !fixture.componentInstance.canSubmit();
  const submitForm = () => {
    q<HTMLFormElement>('#invite-form').requestSubmit();
    fixture.detectChanges();
  };
  const roleValues = () => optionValues(el(), '[data-test-role]', () => fixture.detectChanges());

  describe('who can create whom (D102 punto 2)', () => {
    it('lets the administrator create every role, the collaborator included (MD-503)', () => {
      setup([RESPONSABLES]);
      expect(roleValues()).toEqual(['responsable', 'delegado', 'auditor', 'colaborador', 'admin_empresa']);
    });
  });

  describe('administrator', () => {
    it('needs the email, first and last name; an auditor and an administrator need nothing else, and send no group nor affiliation', () => {
      setup([RESPONSABLES]);
      type('[data-test-role]', 'auditor');
      expect(submitDisabled()).toBeTrue();
      fillPerson();
      expect(submitDisabled()).toBeFalse();
      submitForm();
      expect(api.invite).toHaveBeenCalledWith({ email: 'juan@acme.co', name: 'Juan', last_name: 'Pérez', role: 'auditor' });
      type('[data-test-role]', 'admin_empresa');
      fillPerson('otra@acme.co');
      submitForm();
      expect(api.invite).toHaveBeenCalledWith({ email: 'otra@acme.co', name: 'Juan', last_name: 'Pérez', role: 'admin_empresa' });
    });

    it('creating a responsible also creates their team, so nobody creates groups apart: it never asks for a group', () => {
      const component = setup([RESPONSABLES]);
      const teamCreated = jasmine.createSpy('teamCreated');
      component.teamCreated.subscribe(teamCreated);
      fillPerson();
      expect(el().querySelector('[data-test-responsables-group]')).toBeNull();
      submitForm();
      expect(api.invite).toHaveBeenCalledWith({ email: 'juan@acme.co', name: 'Juan', last_name: 'Pérez', role: 'responsable' });
      // el equipo lo crea el administrador por él: sale con el responsable recién creado como líder
      expect(groupApi.create).toHaveBeenCalledOnceWith({ name: jasmine.stringContaining('DEFAULT_TEAM_NAME'), leader_id: 'new' });
      expect(teamCreated).toHaveBeenCalledTimes(1);
    });

    it('uses the team name that was typed, and leaves it empty by default', () => {
      setup([RESPONSABLES]);
      expect(q<HTMLInputElement>('[data-test-team-name]').value).toBe('');
      fillPerson();
      type('[data-test-team-name]', '  Seguridad Cloud ');
      submitForm();
      expect(groupApi.create).toHaveBeenCalledOnceWith({ name: 'Seguridad Cloud', leader_id: 'new' });
      expect(q<HTMLInputElement>('[data-test-team-name]').value).toBe(''); // el formulario queda limpio
    });

    it('asks for a team name only for a responsible, and creates no team for any other role', () => {
      setup([RESPONSABLES, TEAM_MARIA]);
      for (const role of ['delegado', 'auditor', 'admin_empresa']) {
        type('[data-test-role]', role);
        expect(el().querySelector('[data-test-team-name]')).toBeNull();
      }
      type('[data-test-role]', 'auditor');
      fillPerson();
      submitForm();
      expect(groupApi.create).not.toHaveBeenCalled();
    });

    it('a collaborator needs only the person: no team, no affiliation, no team name, and none is sent (D136, D150)', () => {
      setup([RESPONSABLES, TEAM_MARIA]);
      type('[data-test-role]', 'colaborador');
      expect(el().querySelector('[data-test-team]')).toBeNull();
      expect(el().querySelector('[data-test-team-name]')).toBeNull();
      expect(el().querySelector('[data-test-internal]')).toBeNull();
      expect(q('[data-test-role-help]').textContent).toContain('TEAM.INVITE.HELP_COLABORADOR');
      fillPerson();
      expect(submitDisabled()).toBeFalse();
      submitForm();
      expect(api.invite).toHaveBeenCalledOnceWith({ email: 'juan@acme.co', name: 'Juan', last_name: 'Pérez', role: 'colaborador' });
      expect(groupApi.create).not.toHaveBeenCalled();
    });

    it('when the default team name is already used by another team, tries again with the email at the end', () => {
      setup([RESPONSABLES]);
      const taken = new HttpErrorResponse({ status: 409, error: { message: 'Ese nombre ya existe.', error: { code: 'GROUP_NAME_TAKEN' } } });
      groupApi.create.and.returnValues(throwError(() => taken), of(TEAM_MARIA));
      fillPerson();
      submitForm();
      expect(groupApi.create).toHaveBeenCalledTimes(2);
      expect(groupApi.create.calls.argsFor(1)[0].name).toContain('(new@acme.co)'.replace('new', 'juan'));
    });

    it('when the person was created but the team was not, still tells the parent who was created and why the team failed', () => {
      const component = setup([RESPONSABLES]);
      const invited = jasmine.createSpy('invited');
      const failed = jasmine.createSpy('failed');
      component.invited.subscribe(invited);
      component.teamFailed.subscribe(failed);
      groupApi.create.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Ese nombre ya existe.', error: { code: 'GROUP_NAME_TAKEN' } } })));
      fillPerson();
      type('[data-test-team-name]', 'Seguridad'); // un nombre escrito a mano no se cambia solo
      submitForm();
      expect(invited).toHaveBeenCalledTimes(1);
      expect(groupApi.create).toHaveBeenCalledTimes(1);
      expect(failed).toHaveBeenCalledOnceWith('Ese nombre ya existe.');
    });
    it('for a delegate asks whether it is internal or external, and the team (D104: it must already exist), before enabling the button', () => {
      setup([RESPONSABLES, TEAM_MARIA, TEAM_PEDRO]);
      type('[data-test-role]', 'delegado');
      fillPerson();
      expect(submitDisabled()).toBeTrue();
      click('[data-test-internal]');
      expect(submitDisabled()).toBeTrue(); // falta el equipo
      expect(optionValues(el(), '[data-test-team]', () => fixture.detectChanges())).toEqual(['team-maria', 'team-pedro']);
      type('[data-test-team]', 'team-pedro');
      expect(submitDisabled()).toBeFalse();
      submitForm();
      expect(api.invite).toHaveBeenCalledWith({ email: 'juan@acme.co', name: 'Juan', last_name: 'Pérez', role: 'delegado', is_internal: true, group_id: 'team-pedro' });
    });

    it('sends an external delegate as is_internal false (a real choice, not a default)', () => {
      setup([TEAM_MARIA]);
      type('[data-test-role]', 'delegado');
      fillPerson();
      click('[data-test-external]');
      type('[data-test-team]', 'team-maria');
      submitForm();
      expect(api.invite).toHaveBeenCalledWith(jasmine.objectContaining({ role: 'delegado', is_internal: false, group_id: 'team-maria' }));
    });

    it('explains that no owner has a team yet and does not let a delegate be created without one', () => {
      setup([RESPONSABLES]);
      type('[data-test-role]', 'delegado');
      fillPerson();
      click('[data-test-internal]');
      expect(q('[data-test-no-team]').textContent).toContain('TEAM.INVITE.NO_TEAMS_ADMIN');
      expect(el().querySelector('[data-test-team]')).toBeNull();
      expect(submitDisabled()).toBeTrue();
    });
  });

  describe('after sending', () => {
    it('tells the parent who was created and clears the form', () => {
      const component = setup([RESPONSABLES]);
      let emitted: InvitedMember | null = null;
      component.invited.subscribe((m) => (emitted = m));
      type('[data-test-role]', 'auditor');
      fillPerson();
      submitForm();
      expect((emitted as InvitedMember | null)?.invitation.delivery_status).toBe('sent');
      expect(q<HTMLInputElement>('[data-test-email]').value).toBe('');
      expect(q<HTMLInputElement>('[data-test-name]').value).toBe('');
    });

    it('says under the email that it is registered when the server refuses it (another company), without a general error', () => {
      setup([RESPONSABLES]);
      api.invite.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Ya existe una cuenta con ese correo.', error: { code: 'EMAIL_TAKEN' } } })));
      type('[data-test-role]', 'auditor');
      fillPerson('otra@empresa.co');
      submitForm();
      expect(q('[data-test-email-error]').textContent).toContain('Ya existe una cuenta con ese correo.');
      expect(el().querySelector('[data-test-form-error]')).toBeNull();
    });

    it('explains the user limit with the numbers the server gives, and without them when it does not', () => {
      setup([RESPONSABLES]);
      type('[data-test-role]', 'auditor');
      fillPerson();
      api.invite.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { error: { code: 'USER_LIMIT_REACHED', max_users: 10, users_count: 10 } } })));
      submitForm();
      expect(q('[data-test-form-error]').textContent).toContain('TEAM.ERROR.USER_LIMIT_COUNTS');
      api.invite.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { error: { code: 'USER_LIMIT_REACHED' } } })));
      submitForm();
      expect(q('[data-test-form-error]').textContent).toContain('TEAM.ERROR.USER_LIMIT');
      expect(q('[data-test-form-error]').textContent).not.toContain('USER_LIMIT_COUNTS');
    });

    it('explains that the owner has no team when the server says so (RESPONSIBLE_HAS_NO_TEAM)', () => {
      setup([TEAM_MARIA]);
      api.invite.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { error: { code: 'RESPONSIBLE_HAS_NO_TEAM' } } })));
      type('[data-test-role]', 'delegado');
      fillPerson();
      click('[data-test-internal]');
      type('[data-test-team]', 'team-maria');
      submitForm();
      expect(q('[data-test-form-error]').textContent).toContain('TEAM.ERROR.NO_TEAM');
    });

    it('shows the translated message of any other error the server sends (validation)', () => {
      setup([RESPONSABLES]);
      api.invite.and.returnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { message: 'Revisa los datos.', error: { code: 'VALIDATION_FAILED' } } })));
      type('[data-test-role]', 'auditor');
      fillPerson();
      submitForm();
      expect(q('[data-test-form-error]').textContent).toContain('Revisa los datos.');
    });
  });

  describe('an email that is already in the team', () => {
    it('says so at once, does not allow creating it again and offers to fix the name', () => {
      const component = setup([RESPONSABLES], [member({ id: 'pen', email: 'pen@acme.co', name: null, last_name: null, status: 'pending', role: 'auditor' })]);
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
