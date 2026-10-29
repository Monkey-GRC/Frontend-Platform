import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { DimensionOwner, TeamMember, TeamMemberWithCode } from '../../../domain/models/team.models';
import { TeamService } from '../../../domain/services/team.service';
import { TeamView } from './team';

const member = (over: Partial<TeamMember>): TeamMember => ({
  id: 'u0', email: 'x@acme.co', name: null, last_name: null, role: 'funcional', status: 'active', is_mfa_enabled: true, last_login_at: null, dimensions: [], created_at: '2026-10-28T00:00:00Z', ...over,
});
const ME = member({ id: 'me', email: 'admin@acme.co', role: 'admin_empresa' });
const ANA = member({ id: 'ana', email: 'ana@acme.co', dimensions: ['server'] });
const PENDING = member({ id: 'pen', email: 'pen@acme.co', status: 'pending', is_mfa_enabled: false, dimensions: ['policy'] });
const owner = (dimension: DimensionOwner['dimension'], over: Partial<DimensionOwner> = {}): DimensionOwner => ({ dimension, owner: null, controls_total: 10, controls_with_exception: 0, controls_without_owner: 10, ...over });
const DIMENSIONS = ['policy', 'server', 'database', 'app', 'cloud'].map((value) => ({ value, label: value }));

describe('TeamView (MD-134, D96)', () => {
  let api: jasmine.SpyObj<TeamService>;
  let fixture: ComponentFixture<TeamView>;

  function setup(members: TeamMember[] = [ME, ANA, PENDING], services = [{ id: 's1', name: 'Soporte' }]): void {
    api = jasmine.createSpyObj<TeamService>('TeamService', ['list', 'invite', 'update', 'reissueCode', 'resetMfa', 'services', 'dimensionOwners', 'setDimensionOwner']);
    api.list.and.returnValue(of({ items: members, page: 1, page_size: 100, total: members.length, total_pages: 1 }));
    api.services.and.returnValue(of(services));
    api.dimensionOwners.and.returnValue(of(DIMENSIONS.map((d) => owner(d.value as DimensionOwner['dimension']))));
    TestBed.configureTestingModule({
      imports: [TeamView],
      providers: [provideTranslateService({ fallbackLang: 'es' }), { provide: TeamService, useValue: api }, { provide: CatalogService, useValue: { options: () => of(DIMENSIONS) } }],
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

  it('lists the whole team with the state and the specialties of each person', () => {
    setup();
    expect(q('[data-test-member="ana@acme.co"]').textContent).toContain('server');
    expect(q('[data-test-member="pen@acme.co"]')).not.toBeNull();
    // El propio administrador aparece, pero sin acciones sobre sí mismo.
    expect(q('[data-test-member="admin@acme.co"]').querySelector('[data-test-deactivate]')).toBeNull();
  });

  it('keeps the invite closed until a functional person has a specialty (an auditor needs none)', () => {
    setup();
    type('[data-test-email]', 'juan@acme.co');
    expect(q<HTMLButtonElement>('[data-test-invite]').disabled).toBeTrue();
    check('[data-test-dim="database"]');
    expect(q<HTMLButtonElement>('[data-test-invite]').disabled).toBeFalse();
    type('[data-test-role]', 'auditor');
    expect(el().querySelector('[data-test-dim="database"]')).toBeNull();
    expect(q<HTMLButtonElement>('[data-test-invite]').disabled).toBeFalse();
  });

  it('invites with the chosen specialties and shows the activation code until it is noted down', () => {
    setup();
    const created: TeamMemberWithCode = { ...member({ id: 'new', email: 'juan@acme.co', status: 'pending', dimensions: ['database'] }), activation_code: { code: 'MNK-7F3A-92KD-5QXB', status: 'pending', expires_at: '2026-11-04T00:00:00Z' } };
    api.invite.and.returnValue(of(created));
    type('[data-test-email]', 'juan@acme.co');
    check('[data-test-dim="database"]');
    click('[data-test-invite]');
    expect(api.invite).toHaveBeenCalledWith({ email: 'juan@acme.co', role: 'funcional', dimensions: ['database'] });
    expect(q('[data-test-code-value]').textContent).toContain('MNK-7F3A-92KD-5QXB');
    click('[data-test-code-dismiss]');
    expect(el().querySelector('[data-test-code]')).toBeNull();
  });

  it('shows the message the backend sends when the invite fails (for example, the email is taken)', () => {
    setup();
    api.invite.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Ya existe una cuenta con ese correo.' } })));
    type('[data-test-email]', 'ana@acme.co');
    check('[data-test-dim="server"]');
    click('[data-test-invite]');
    expect(el().textContent).toContain('Ya existe una cuenta con ese correo.');
    expect(el().querySelector('[data-test-code]')).toBeNull();
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

  it('splits the work by service: only people with that specialty are offered, and unowned controls are flagged', () => {
    setup();
    click('[data-test-tab-work]');
    expect(api.dimensionOwners).toHaveBeenCalledWith('s1');
    expect(q('[data-test-owner="server"]').querySelector('[data-test-unowned]')).not.toBeNull();
    const options = Array.from(q('[data-test-owner-select="server"]').querySelectorAll<HTMLOptionElement>('option')).map((o) => o.value);
    expect(options).toEqual(['', 'ana']);
    api.setDimensionOwner.and.returnValue(of(owner('server', { owner: { id: 'ana', email: 'ana@acme.co', name: null, last_name: null }, controls_without_owner: 0 })));
    type('[data-test-owner-select="server"]', 'ana');
    expect(api.setDimensionOwner).toHaveBeenCalledWith('s1', 'server', 'ana');
    expect(q('[data-test-owner="server"]').querySelector('[data-test-unowned]')).toBeNull();
  });

  it('invites to declare a service first when there are none', () => {
    setup([ME], []);
    click('[data-test-tab-work]');
    expect(el().querySelector('[data-test-no-services]')).not.toBeNull();
  });

  it('offers a retry when the team cannot be loaded', () => {
    setup();
    api.list.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(el().querySelector('[data-test-retry]')).not.toBeNull();
  });
});
