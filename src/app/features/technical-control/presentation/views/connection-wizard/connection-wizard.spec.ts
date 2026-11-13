import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { Asset, TechnicalControlState } from '@shared/domain/models/technical-control.models';
import { connectionOptionsStub } from '@shared/testing/connection-options';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { Service } from '@shared/domain/models/service.models';
import { ServiceService } from '@shared/domain/services/service.service';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { ConnectionWizardView } from './connection-wizard';

const SID = '51c0a1b2-3c4d-4e5f-8a9b-0c1d2e3f4a5b';
const AID = '7e5b2c90-3a14-4f8d-b062-1c9e7a3f5d28';
const STATE: TechnicalControlState = {
  probe_mode: 'runner',
  applicable_capabilities: [{ catalog_code: 'ac_01', category: 'Nube', method: 'm', required_permissions: [], base_frequency: 'x', generated_evidence: 'e', platforms: [
    { code: 'aws', name: 'Amazon Web Services', logo_key: 'aws', availability: 'available', connection_methods: ['readonly_role', 'access_keys'] },
    { code: 'gcp', name: 'Google Cloud', logo_key: 'gcp', availability: 'available', connection_methods: ['identity_federation'] },
    { code: 'azure', name: 'Azure', logo_key: 'azure', availability: 'coming_soon', connection_methods: [] },
  ] }],
};
const asset = (over: Partial<Asset> = {}): Asset => ({
  id: AID, code: 'AST-1', name: 'AWS', connection_category: 'ac_01', type: 'cloud_service', platform: 'aws', operational_status: 'not_monitored', technical_coverage: '0/18', services: [{ id: SID, name: 'Pagos' }],
  provisioning: { connection_status: 'pending', connection_method: 'readonly_role', is_active: false, schedule_frequency: null },
  connection_setup: { method: 'readonly_role', monkey_principal_arn: 'x', role_arn: null, steps: ['a'] }, ...over,
});

describe('ConnectionWizardView', () => {
  let fixture: ComponentFixture<ConnectionWizardView>;
  let router: Router;
  let api: jasmine.SpyObj<TechnicalControlService>;
  const stepIndex = () => (fixture.nativeElement as HTMLElement).querySelector('[data-wizard-steps] li[aria-current="step"]')?.getAttribute('data-step');

  function setup(platform: string, query: Record<string, string> = {}, found: Asset | 'missing' = asset()): void {
    api = jasmine.createSpyObj<TechnicalControlService>('TechnicalControlService', ['state', 'getAsset']);
    api.state.and.returnValue(of(STATE));
    api.getAsset.and.returnValue(found === 'missing' ? throwError(() => new Error('404')) : of(found));
    const services = jasmine.createSpyObj<ServiceService>('ServiceService', ['get', 'list']);
    services.get.and.returnValue(of({ id: SID, name: 'Pagos' } as unknown as Service));
    services.list.and.returnValue(of({ items: [], page: 1, page_size: 50, total: 0, total_pages: 1 }));
    const catalogs = jasmine.createSpyObj<CatalogService>('CatalogService', ['options', 'connectionOptions']);
    catalogs.options.and.returnValue(of([]));
    catalogs.connectionOptions.and.callFake(connectionOptionsStub);
    TestBed.configureTestingModule({
      imports: [ConnectionWizardView],
      providers: [
        provideTranslateService(), provideRouter([]), { provide: TechnicalControlService, useValue: api }, { provide: ServiceService, useValue: services }, { provide: CatalogService, useValue: catalogs },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: SID, catalog: 'ac_01', platform }), queryParamMap: convertToParamMap(query) } } },
      ],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ConnectionWizardView);
    fixture.detectChanges();
  }

  it('opens the AWS and GCP wizards from the same route', () => {
    setup('aws');
    expect(fixture.nativeElement.querySelector('app-aws-connection-flow')).not.toBeNull();
    expect(stepIndex()).toBe('0');
    TestBed.resetTestingModule();
    setup('gcp');
    expect(fixture.nativeElement.querySelector('app-gcp-connection-flow')).not.toBeNull();
  });

  it('goes back to the catalog for a platform that is coming soon', () => {
    setup('azure');
    expect(router.navigate).toHaveBeenCalledWith(['/services', SID, 'connections', 'new']);
  });

  it('resumes a pending connection at the step derived from the asset', () => {
    setup('aws', { assetId: AID });
    expect(api.getAsset).toHaveBeenCalledWith(AID);
    expect(stepIndex()).toBe('2');
  });

  it('ignores an assetId that is not a uuid without calling the server', () => {
    setup('aws', { assetId: '../x' });
    expect(api.getAsset).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/services', SID]);
  });

  it('does not resume an asset of another service, another platform or one already checked', () => {
    setup('aws', { assetId: AID }, asset({ services: [{ id: 'other', name: 'Otro' }] }));
    expect(router.navigate).toHaveBeenCalledWith(['/services', SID, 'connections', AID]);
    TestBed.resetTestingModule();
    setup('aws', { assetId: AID }, asset({ platform: 'gcp' }));
    expect(router.navigate).toHaveBeenCalledWith(['/services', SID, 'connections', AID]);
    TestBed.resetTestingModule();
    setup('aws', { assetId: AID }, asset({ provisioning: { connection_status: 'validated', connection_method: 'readonly_role', is_active: false, schedule_frequency: null } }));
    expect(router.navigate).toHaveBeenCalledWith(['/services', SID, 'connections', AID]);
  });

  it('goes to the service when the asset does not exist', () => {
    setup('aws', { assetId: AID }, 'missing');
    expect(router.navigate).toHaveBeenCalledWith(['/services', SID]);
  });
});
