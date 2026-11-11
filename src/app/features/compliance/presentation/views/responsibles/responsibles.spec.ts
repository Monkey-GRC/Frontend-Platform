import { COMPLIANCE_OPTIONS, provideCatalogStub } from '@shared/testing/catalog-options';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { Responsible } from '@shared/domain/models/risk.models';
import { ResponsibleService } from '@features/compliance/domain/services/responsible.service';
import { ResponsiblesView } from './responsibles';

const CISO: Responsible = { id: 'p1', type: 'ciso', person_name: 'Marta Ruiz', is_in_use: true };
const IT: Responsible = { id: 'p2', type: 'it', person_name: 'Andrés Pardo', is_in_use: false };

describe('ResponsiblesView', () => {
  let api: jasmine.SpyObj<ResponsibleService>;
  let fixture: ComponentFixture<ResponsiblesView>;

  function setup(role: string, items: Responsible[] | 'down' = [CISO, IT]): void {
    api = jasmine.createSpyObj<ResponsibleService>('ResponsibleService', ['list', 'create', 'rename', 'remove']);
    api.list.and.returnValue(items === 'down' ? throwError(() => new HttpErrorResponse({ status: 500 })) : of(items));
    TestBed.configureTestingModule({ imports: [ResponsiblesView], providers: [provideCatalogStub(), provideTranslateService({ fallbackLang: 'es' }), { provide: ResponsibleService, useValue: api }] });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', { COMPLIANCE: { RESPONSIBLE_TYPE: { CISO: 'CISO', IT: 'TI' } } });
    translate.use('es');
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(ResponsiblesView);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';
  const type = (selector: string, value: string) => {
    const input = el().querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
    fixture.detectChanges();
  };
  const click = (selector: string) => {
    el().querySelector<HTMLButtonElement>(selector)!.click();
    fixture.detectChanges();
  };

  const openDrawer = () => click('[data-test-open-add]');

  it('keeps the form out of the page until "add" is pressed, and opens it in a drawer', () => {
    setup('admin_empresa');
    expect(el().querySelector('[data-test-type]')).toBeNull();
    expect(el().querySelectorAll('.mk-btn').length).toBe(1); // one primary action per view
    openDrawer();
    expect(el().querySelector('app-side-drawer [role="dialog"]')).not.toBeNull();
    expect(el().querySelector('app-side-drawer [data-test-type]')).not.toBeNull();
  });

  it('shows the list in a data table, with "in use" as a status and no pills', () => {
    setup('admin_empresa');
    expect(el().querySelector('app-data-table table')).not.toBeNull();
    expect(el().querySelectorAll('app-status-indicator[data-test-in-use]').length).toBe(1);
    expect(el().querySelector('.rounded-full.px-2\\.5')).toBeNull();
  });

  it('offers the types of role that the backend serves, not a list written in the screen', () => {
    setup('admin_empresa');
    openDrawer();
    const options = Array.from(el().querySelectorAll<HTMLOptionElement>('[data-test-type] option')).map((o) => o.value).filter(Boolean);
    expect(options).toEqual(COMPLIANCE_OPTIONS['responsible_type'].map((o) => o.value));
    expect(el().querySelector('[data-test-type]')!.textContent).toContain('Propietario del activo');
  });

  it('lists every role with its person and marks the ones something depends on', () => {
    setup('admin_empresa');
    expect(text()).toContain('Marta Ruiz');
    expect(text()).toContain('Andrés Pardo');
    expect(el().querySelectorAll('[data-test-in-use]').length).toBe(1);
  });

  it('lets only the company admin add, change and remove; the rest of the roles read', () => {
    setup('admin_empresa');
    expect(el().querySelector('[data-test-open-add]')).not.toBeNull();
    expect(el().querySelector('[data-test-edit]')).not.toBeNull();
    for (const role of ['auditor', 'responsable', 'delegado']) {
      TestBed.resetTestingModule();
      setup(role);
      expect(text()).toContain('Marta Ruiz');
      expect(el().querySelector('[data-test-open-add]')).toBeNull();
      expect(el().querySelector('[data-test-edit]')).toBeNull();
      expect(el().querySelector('[data-test-remove]')).toBeNull();
    }
  });

  it('adds a role only with its type and a name, and reloads the list', () => {
    setup('admin_empresa');
    api.create.and.returnValue(of({ id: 'p3', type: 'coo', person_name: 'Luisa Mejía', is_in_use: false }));
    openDrawer();
    expect(el().querySelector<HTMLButtonElement>('[data-test-add]')!.disabled).toBeTrue();
    type('[data-test-type]', 'coo');
    type('[data-test-name]', '  Luisa Mejía ');
    expect(el().querySelector<HTMLButtonElement>('[data-test-add]')!.disabled).toBeFalse();
    click('[data-test-add]');
    expect(api.create).toHaveBeenCalledOnceWith('coo', 'Luisa Mejía');
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(text()).toContain('COMPLIANCE.RESPONSIBLES.CREATED');
    expect(el().querySelector('app-side-drawer [role="dialog"]')).toBeNull(); // the drawer closes once saved
  });

  it('shows the message of the server when the role already exists', () => {
    setup('admin_empresa');
    api.create.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Ya existe ese cargo con esa persona.' } })));
    openDrawer();
    type('[data-test-type]', 'ciso');
    type('[data-test-name]', 'Marta Ruiz');
    click('[data-test-add]');
    expect(text()).toContain('Ya existe ese cargo con esa persona.');
    expect(el().querySelector('app-side-drawer [role="dialog"]')).not.toBeNull(); // stays open so the person can fix it
  });

  it('changes only the person of a role', () => {
    setup('admin_empresa');
    api.rename.and.returnValue(of({ ...IT, person_name: 'Luisa Mejía' }));
    el().querySelectorAll<HTMLButtonElement>('[data-test-edit]')[1].click();
    fixture.detectChanges();
    type('[data-test-edit-name]', 'Luisa Mejía');
    click('[data-test-save-edit]');
    expect(api.rename).toHaveBeenCalledOnceWith('p2', 'Luisa Mejía');
  });

  it('does not let remove a role that is in use, and asks before removing one that is not', () => {
    setup('admin_empresa');
    api.remove.and.returnValue(of(undefined));
    const buttons = el().querySelectorAll<HTMLButtonElement>('[data-test-remove]');
    expect(buttons[0].disabled).toBeTrue();
    expect(buttons[1].disabled).toBeFalse();
    buttons[1].click();
    fixture.detectChanges();
    expect(api.remove).not.toHaveBeenCalled();
    expect(el().querySelector('app-confirm-dialog')).not.toBeNull();
  });

  it('says there are no responsibles and invites the admin to add the first', () => {
    setup('admin_empresa', []);
    expect(text()).toContain('COMPLIANCE.RESPONSIBLES.EMPTY_ADMIN');
    expect(el().querySelector('[data-test-empty] button')).not.toBeNull(); // the call to action
    TestBed.resetTestingModule();
    setup('auditor', []);
    expect(text()).toContain('COMPLIANCE.RESPONSIBLES.EMPTY');
    expect(text()).not.toContain('COMPLIANCE.RESPONSIBLES.EMPTY_ADMIN');
  });

  it('offers to retry when the list cannot be loaded', () => {
    setup('admin_empresa', 'down');
    expect(text()).toContain('COMPLIANCE.RESPONSIBLES.LOAD_ERROR');
    api.list.and.returnValue(of([CISO]));
    click('[data-test-retry]');
    expect(text()).toContain('Marta Ruiz');
  });
});
