import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { CatalogOption } from '@shared/domain/models/catalog.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { Asset, Capability, Platform } from '@shared/domain/models/technical-control.models';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { isSelect, optionsText, optionValues, pickOption, selectText } from '@shared/presentation/components/select/select.testing';
import { ConnectServerForm } from './connect-server-form';

const platform: Platform = { code: 'linux', name: 'Linux', logo_key: 'linux', availability: 'available', connection_methods: ['agent'] };
const capability = { catalog_code: 'ac_04', category: 'Servidores on-premise', platforms: [platform] } as unknown as Capability;
const versions: CatalogOption[] = [
  { value: 'ubuntu_22_04_lts', label: 'Ubuntu 22.04 LTS', group: 'ubuntu', group_label: 'Ubuntu' },
  { value: 'ubuntu_24_04_lts', label: 'Ubuntu 24.04 LTS', group: 'ubuntu', group_label: 'Ubuntu' },
  { value: 'rhel_9', label: 'Red Hat Enterprise Linux 9', group: 'rhel', group_label: 'Red Hat' },
];

// Declarar un servidor (D112): nombre y versión, sin ninguna llave. Las versiones salen del backend.
describe('ConnectServerForm', () => {
  let fixture: ComponentFixture<ConnectServerForm>;
  let api: jasmine.SpyObj<TechnicalControlService>;
  let catalogs: jasmine.SpyObj<CatalogService>;
  const el = () => fixture.nativeElement as HTMLElement;

  function open() {
    api = jasmine.createSpyObj<TechnicalControlService>('TechnicalControlService', ['createAsset']);
    catalogs = jasmine.createSpyObj<CatalogService>('CatalogService', ['options']);
    catalogs.options.and.returnValue(of(versions));
    TestBed.configureTestingModule({
      imports: [ConnectServerForm],
      providers: [provideTranslateService(), { provide: TechnicalControlService, useValue: api }, { provide: CatalogService, useValue: catalogs }],
    });
    fixture = TestBed.createComponent(ConnectServerForm);
    fixture.componentRef.setInput('capability', capability);
    fixture.componentRef.setInput('platform', platform);
    fixture.componentRef.setInput('service', { id: 's1', name: 'Mi servicio' });
    fixture.detectChanges();
  }

  it('asks the backend for the versions of that system and offers them in the shared select', () => {
    open();
    expect(catalogs.options).toHaveBeenCalledWith('linux_version');
    expect(isSelect(el(), '#server-os')).toBeTrue();
    expect(optionValues(el(), '#server-os', () => fixture.detectChanges())).toEqual(['ubuntu_22_04_lts', 'ubuntu_24_04_lts', 'rhel_9']);
    expect(optionsText(el(), '#server-os', () => fixture.detectChanges())).toContain('Red Hat Enterprise Linux 9');
  });

  it('keeps the version the client picks in the select', () => {
    open();
    pickOption(el(), '#server-os', 'ubuntu_24_04_lts', () => fixture.detectChanges());
    expect(fixture.componentInstance.osVersion()).toBe('ubuntu_24_04_lts');
    expect(selectText(el(), '#server-os')).toContain('Ubuntu 24.04 LTS');
  });

  it('does not register without a name and a version, and says what is missing', () => {
    open();
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(api.createAsset).not.toHaveBeenCalled();
    expect(el().textContent).toContain('NAME_HINT');
    expect(el().textContent).toContain('VERSION_HINT');
  });

  it('registers the server with the agent channel and the chosen version, and no keys or account', () => {
    open();
    api.createAsset.and.returnValue(of({ id: 'a1' } as Asset));
    const created: Asset[] = [];
    fixture.componentInstance.created.subscribe((a) => created.push(a));
    fixture.componentInstance.name.set('  Servidor BD  ');
    fixture.componentInstance.osVersion.set('rhel_9');
    fixture.componentInstance.submit();
    expect(api.createAsset).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({
        name: 'Servidor BD', connection_category: 'ac_04', platform: 'linux', connection_method: 'agent', os_version: 'rhel_9', service_ids: ['s1'],
      }),
    );
    const sent = api.createAsset.calls.mostRecent().args[0];
    expect(sent.credentials).toBeUndefined();
    expect(sent.external_account_id).toBeUndefined();
    expect(sent.regions).toBeUndefined();
    expect(created).toEqual([{ id: 'a1' } as Asset]);
  });

  it('marks the version field when the backend rejects it', () => {
    open();
    api.createAsset.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { error: { fields: [{ field: 'os_version', code: 'invalid', message: 'Esa versión no es de Linux.' }] } } })),
    );
    fixture.componentInstance.name.set('Servidor');
    fixture.componentInstance.osVersion.set('ubuntu_22_04_lts');
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(el().textContent).toContain('Esa versión no es de Linux.');
  });

  it('does not let the client register while the versions are unavailable', () => {
    open();
    catalogs.options.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    fixture.componentInstance['loadVersions']('linux_version');
    fixture.detectChanges();
    expect(el().textContent).toContain('VERSIONS_ERROR');
    const register = Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes('REGISTER')) as HTMLButtonElement;
    expect(register.disabled).toBeTrue();
  });
});
