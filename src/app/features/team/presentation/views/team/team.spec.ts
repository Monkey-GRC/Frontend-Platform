import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { OWNER_ASSIGNMENT_ENABLED } from '@config/features.config';
import { SessionService } from '@core/domain/services/session.service';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { DimensionOwner, TeamMember, TeamMemberWithCode } from '../../../domain/models/team.models';
import { TeamService } from '../../../domain/services/team.service';
import { TeamView } from './team';

const member = (over: Partial<TeamMember>): TeamMember => ({
  id: 'u0', email: 'x@acme.co', name: 'Persona', last_name: 'Prueba', role: 'funcional', status: 'active', is_mfa_enabled: true, last_login_at: null, dimensions: [], created_at: '2026-10-28T00:00:00Z', ...over,
});
const ME = member({ id: 'me', email: 'admin@acme.co', name: 'Ada', last_name: 'Admin', role: 'admin_empresa' });
const OTHER_ADMIN = member({ id: 'adm2', email: 'adm2@acme.co', name: 'Lucía', last_name: 'Gómez', role: 'admin_empresa' });
const ANA = member({ id: 'ana', email: 'ana@acme.co', name: 'Ana', last_name: 'Ruiz', dimensions: ['server'] });
const PENDING = member({ id: 'pen', email: 'pen@acme.co', name: null, last_name: null, status: 'pending', is_mfa_enabled: false, dimensions: ['policy'] });
const owner = (dimension: DimensionOwner['dimension'], over: Partial<DimensionOwner> = {}): DimensionOwner => ({ dimension, owner: null, controls_total: 10, controls_with_exception: 0, controls_without_owner: 10, ...over });
const DIMENSIONS = ['policy', 'server', 'database', 'app', 'cloud'].map((value) => ({ value, label: value }));

describe('TeamView (MD-134, D96, D98)', () => {
  let api: jasmine.SpyObj<TeamService>;
  let fixture: ComponentFixture<TeamView>;

  function setup(members: TeamMember[] = [ME, OTHER_ADMIN, ANA, PENDING], opts: { owners?: boolean; services?: { id: string; name: string }[] } = {}): void {
    api = jasmine.createSpyObj<TeamService>('TeamService', ['list', 'invite', 'update', 'reissueCode', 'resetMfa', 'services', 'dimensionOwners', 'setDimensionOwner']);
    api.list.and.returnValue(of({ items: members, page: 1, page_size: 100, total: members.length, total_pages: 1 }));
    api.services.and.returnValue(of(opts.services ?? [{ id: 's1', name: 'Soporte' }]));
    api.dimensionOwners.and.returnValue(of(DIMENSIONS.map((d) => owner(d.value as DimensionOwner['dimension']))));
    TestBed.configureTestingModule({
      imports: [TeamView],
      providers: [
        provideTranslateService({ fallbackLang: 'es' }),
        { provide: TeamService, useValue: api },
        { provide: CatalogService, useValue: { options: () => of(DIMENSIONS) } },
        { provide: OWNER_ASSIGNMENT_ENABLED, useValue: !!opts.owners },
      ],
    });
    TestBed.inject(SessionService).set({ id: 'me', email: 'admin@acme.co', name: null, last_name: null, role: 'admin_empresa' }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(TeamView);
    fixture.detectChanges();
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
    q<HTMLButtonElement>(selector).click();
    fixture.detectChanges();
  };
  const check = (selector: string) => {
    const box = q<HTMLInputElement>(selector);
    box.checked = !box.checked;
    box.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  const fillPerson = (email = 'juan@acme.co') => {
    type('[data-test-email]', email);
    type('[data-test-name]', 'Juan');
    type('[data-test-last-name]', 'Pérez');
  };

  it('lists the whole team, with names, state and specialties, and shows the ones without a name', () => {
    setup();
    expect(q('[data-test-member="ana@acme.co"]').textContent).toContain('Ana Ruiz');
    expect(q('[data-test-member="ana@acme.co"]').textContent).toContain('server');
    expect(q('[data-test-member="pen@acme.co"] [data-test-no-name]')).not.toBeNull();
  });

  it('keeps the work split off by default (D98): no tab, no owner calls', () => {
    setup();
    expect(el().querySelector('[data-test-tab-work]')).toBeNull();
    expect(api.services).not.toHaveBeenCalled();
  });

  it('needs the email, the first and last name, and a specialty for a functional person; an auditor and an administrator need none', () => {
    setup();
    type('[data-test-email]', 'juan@acme.co');
    expect(q<HTMLButtonElement>('[data-test-invite]').disabled).toBeTrue();
    type('[data-test-name]', 'Juan');
    type('[data-test-last-name]', 'Pérez');
    expect(q<HTMLButtonElement>('[data-test-invite]').disabled).toBeTrue(); // falta una especialidad
    check('[data-test-dim="database"]');
    expect(q<HTMLButtonElement>('[data-test-invite]').disabled).toBeFalse();
    for (const role of ['auditor', 'admin_empresa']) {
      type('[data-test-role]', role);
      expect(el().querySelector('[data-test-dim="database"]')).toBeNull();
      expect(q<HTMLButtonElement>('[data-test-invite]').disabled).toBeFalse();
    }
  });

  it('invites with name, last name and specialties, and shows the activation code until it is noted down', () => {
    setup();
    const created: TeamMemberWithCode = { ...member({ id: 'new', email: 'juan@acme.co', name: 'Juan', last_name: 'Pérez', status: 'pending', dimensions: ['database'] }), activation_code: { code: 'MNK-7F3A-92KD-5QXB', status: 'pending', expires_at: '2026-11-04T00:00:00Z' } };
    api.invite.and.returnValue(of(created));
    fillPerson();
    check('[data-test-dim="database"]');
    click('[data-test-invite]');
    expect(api.invite).toHaveBeenCalledWith({ email: 'juan@acme.co', name: 'Juan', last_name: 'Pérez', role: 'funcional', dimensions: ['database'] });
    expect(q('[data-test-code-value]').textContent).toContain('MNK-7F3A-92KD-5QXB');
    click('[data-test-code-dismiss]');
    expect(el().querySelector('[data-test-code]')).toBeNull();
  });

  it('lets an administrator invite another administrator, without specialties', () => {
    setup();
    api.invite.and.returnValue(of({ ...member({ id: 'n', email: 'nuevo@acme.co', role: 'admin_empresa', status: 'pending' }), activation_code: { code: 'MNK-AAAA-BBBB-CCCC', status: 'pending', expires_at: '2026-11-04T00:00:00Z' } }));
    fillPerson('nuevo@acme.co');
    type('[data-test-role]', 'admin_empresa');
    click('[data-test-invite]');
    expect(api.invite).toHaveBeenCalledWith({ email: 'nuevo@acme.co', name: 'Juan', last_name: 'Pérez', role: 'admin_empresa' });
  });

  it('says at once that the email is already registered in the team, does not allow creating it again, and offers to fix the name', () => {
    setup();
    fillPerson('PEN@acme.co');
    check('[data-test-dim="app"]');
    expect(q('[data-test-existing]').textContent).toContain('TEAM.INVITE.ALREADY_IN_TEAM');
    expect(q<HTMLButtonElement>('[data-test-invite]').disabled).toBeTrue();
    click('[data-test-fix-existing]');
    expect(el().querySelector('[data-test-existing]')).toBeNull();
    expect(q('[data-test-member="pen@acme.co"] [data-test-edit-name]')).not.toBeNull();
  });

  it('shows under the email field that it already exists on the platform when the server refuses it (another company)', () => {
    setup();
    api.invite.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Ya existe una cuenta con ese correo.', error: { code: 'EMAIL_TAKEN' } } })));
    fillPerson('otra@empresa.co');
    check('[data-test-dim="server"]');
    click('[data-test-invite]');
    expect(q('[data-test-email-error]').textContent).toContain('Ya existe una cuenta con ese correo.');
    expect(el().querySelector('[data-test-code]')).toBeNull();
  });

  it('corrects the name of anybody in the team, including the administrator himself', () => {
    setup();
    api.update.and.returnValue(of({ ...PENDING, name: 'Pedro', last_name: 'Gil' }));
    click('[data-test-member="pen@acme.co"] [data-test-edit-name-btn]');
    type('[data-test-edit-name]', 'Pedro');
    type('[data-test-edit-last-name]', 'Gil');
    click('[data-test-save-name]');
    expect(api.update).toHaveBeenCalledWith('pen', { name: 'Pedro', last_name: 'Gil' });
    expect(q('[data-test-member="admin@acme.co"] [data-test-edit-name-btn]')).not.toBeNull();
  });

  it('gives the other administrators their actions (deactivate, name) but not the ones that do not apply to them', () => {
    setup();
    const row = q('[data-test-member="adm2@acme.co"]');
    expect(row.querySelector('[data-test-deactivate]')).not.toBeNull();
    expect(row.querySelector('[data-test-edit]')).toBeNull(); // sin especialidades
    expect(row.querySelector('[data-test-reset-mfa]')).toBeNull(); // el de un administrador lo restablece Monkey
    // Y sobre sí mismo, solo el nombre.
    const mine = q('[data-test-member="admin@acme.co"]');
    expect(mine.querySelector('[data-test-edit-name-btn]')).not.toBeNull();
    expect(mine.querySelector('[data-test-deactivate]')).toBeNull();
  });

  it('offers a new code only to people who have not activated their account', () => {
    setup();
    expect(q('[data-test-member="pen@acme.co"]').querySelector('[data-test-reissue]')).not.toBeNull();
    expect(q('[data-test-member="ana@acme.co"]').querySelector('[data-test-reissue]')).toBeNull();
    api.reissueCode.and.returnValue(of({ ...PENDING, activation_code: { code: 'MNK-NEW1-NEW2-NEW3', status: 'pending', expires_at: '2026-11-05T00:00:00Z' } }));
    click('[data-test-member="pen@acme.co"] [data-test-reissue]');
    expect(q('[data-test-code-value]').textContent).toContain('MNK-NEW1-NEW2-NEW3');
  });

  it('asks before deactivating and only then closes the account', () => {
    setup();
    api.update.and.returnValue(of({ ...ANA, status: 'inactive' }));
    click('[data-test-member="ana@acme.co"] [data-test-deactivate]');
    expect(api.update).not.toHaveBeenCalled();
    const confirmButton = Array.from(el().querySelectorAll<HTMLButtonElement>('app-confirm-dialog button')).find((b) => b.textContent?.includes('TEAM.ACTIONS.DEACTIVATE'))!;
    confirmButton.click();
    fixture.detectChanges();
    expect(api.update).toHaveBeenCalledWith('ana', { status: 'inactive' });
  });

  it('changes the specialties of a functional person', () => {
    setup();
    api.update.and.returnValue(of({ ...ANA, dimensions: ['server', 'cloud'] }));
    click('[data-test-member="ana@acme.co"] [data-test-edit]');
    check('[data-test-edit-dim="cloud"]');
    click('[data-test-save-edit]');
    expect(api.update).toHaveBeenCalledWith('ana', { dimensions: ['server', 'cloud'] });
  });

  it('offers a retry when the team cannot be loaded', () => {
    setup();
    api.list.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(el().querySelector('[data-test-retry]')).not.toBeNull();
  });

  describe('work split by service (off in D98; kept for when it is decided)', () => {
    it('splits the work by service when the feature is on: only people with that specialty are offered, and unowned controls are flagged', () => {
      setup([ME, ANA], { owners: true });
      click('[data-test-tab-work]');
      expect(api.dimensionOwners).toHaveBeenCalledWith('s1');
      expect(q('[data-test-owner="server"]').querySelector('[data-test-unowned]')).not.toBeNull();
      const options = Array.from(q('[data-test-owner-select="server"]').querySelectorAll<HTMLOptionElement>('option')).map((o) => o.value);
      expect(options).toEqual(['', 'ana']);
      api.setDimensionOwner.and.returnValue(of(owner('server', { owner: { id: 'ana', email: 'ana@acme.co', name: null, last_name: null }, controls_without_owner: 0 })));
      type('[data-test-owner-select="server"]', 'ana');
      expect(api.setDimensionOwner).toHaveBeenCalledWith('s1', 'server', 'ana');
    });
  });
});
