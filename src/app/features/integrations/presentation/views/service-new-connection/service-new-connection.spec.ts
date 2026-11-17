import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { TechnicalControlState } from '@shared/domain/models/technical-control.models';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { Service } from '@shared/domain/models/service.models';
import { ServiceService } from '@shared/domain/services/service.service';
import { TechnicalControlService } from '@shared/domain/services/technical-control.service';
import { CatalogIntegration } from '@features/integrations/domain/models/integration.models';
import { IntegrationService } from '@features/integrations/domain/services/integration.service';
import { ServiceNewConnectionView } from './service-new-connection';

const SID = '51c0a1b2-3c4d-4e5f-8a9b-0c1d2e3f4a5b';
const AWS: CatalogIntegration = { code: 'aws', name: 'Amazon Web Services', logo_key: 'aws', purpose: 'measurement', availability: 'available', description: 'Evalúa tu cuenta.', connection: { category: 'ac_01', platform: 'aws' }, connected: false };
const STATE: TechnicalControlState = {
  probe_mode: 'runner',
  applicable_capabilities: [
    { catalog_code: 'ac_01', category: 'Servicios en nube', method: 'm', required_permissions: [], base_frequency: 'x', generated_evidence: 'e', platforms: [{ code: 'aws', name: 'Amazon Web Services', logo_key: 'aws', availability: 'available', connection_methods: ['readonly_role'] }] },
    { catalog_code: 'ac_04', category: 'Servidores on-premise', method: 'm', required_permissions: [], base_frequency: 'x', generated_evidence: 'e', platforms: [{ code: 'linux', name: 'Linux', logo_key: 'linux', availability: 'coming_soon', connection_methods: ['agent'] }] },
  ],
};

describe('ServiceNewConnectionView', () => {
  let fixture: ComponentFixture<ServiceNewConnectionView>;
  let router: Router;
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector<HTMLElement>(s);
  const qa = (s: string) => Array.from(el().querySelectorAll<HTMLElement>(s));

  const configure = (state: TechnicalControlState): void => {
    const integrations = jasmine.createSpyObj<IntegrationService>('IntegrationService', ['catalog']);
    integrations.catalog.and.returnValue(of([AWS]));
    const catalogs = jasmine.createSpyObj<CatalogService>('CatalogService', ['options']);
    catalogs.options.and.returnValue(of([{ value: 'measurement', label: 'Medición' }]));
    const tc = jasmine.createSpyObj<TechnicalControlService>('TechnicalControlService', ['state']);
    tc.state.and.returnValue(of(state));
    const services = jasmine.createSpyObj<ServiceService>('ServiceService', ['get']);
    services.get.and.returnValue(of({ id: SID, name: 'Pagos' } as unknown as Service));
    TestBed.configureTestingModule({
      imports: [ServiceNewConnectionView],
      providers: [
        provideTranslateService(), provideRouter([]),
        { provide: IntegrationService, useValue: integrations }, { provide: CatalogService, useValue: catalogs }, { provide: TechnicalControlService, useValue: tc }, { provide: ServiceService, useValue: services },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: SID }) } } },
      ],
    });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(ServiceNewConnectionView);
    fixture.detectChanges();
  };

  beforeEach(() => configure(STATE));

  it('shows the same integration cards as Integraciones, opening the detail inside the service', () => {
    const card = q('app-integration-card')!;
    expect(card.textContent).toContain('Amazon Web Services');
    expect(card.querySelector('a[data-test-open]')!.getAttribute('href')).toBe(`/integraciones/aws?service=${SID}`);
  });

  it('connects straight to the wizard with this service and returns here, without asking for the service', () => {
    const nav = spyOn(router, 'navigate').and.resolveTo(true);
    q('[data-test-connect]')!.click();
    expect(nav).toHaveBeenCalledWith(['/services', SID, 'connections', 'new', 'ac_01', 'aws'], { queryParams: { returnTo: router.url } });
    expect(q('[data-test-service]')).toBeNull();
  });

  it('keeps servers apart from the integrations, locked when they have no flow, and does not repeat the cloud group', () => {
    const servers = q('[data-servers]')!;
    expect(servers.querySelectorAll('[data-server-card]').length).toBe(1);
    expect(servers.textContent).toContain('Linux');
    expect(servers.textContent).not.toContain('Amazon');
    expect(servers.querySelector('[data-server-card]')!.getAttribute('aria-disabled')).toBe('true');
    expect(qa('app-integration-card').length).toBe(1);
  });

  describe('servers with a connection flow (D113)', () => {
    const open = (availability: 'available' | 'coming_soon', code: string): TechnicalControlState => ({
      ...STATE,
      applicable_capabilities: STATE.applicable_capabilities.map((c) => (c.catalog_code === 'ac_04' ? { ...c, platforms: [{ ...c.platforms[0], code, name: code, availability }] } : c)),
    });

    it('an available platform that has its flow opens the wizard, with this service and a way back', () => {
      TestBed.resetTestingModule();
      configure(open('available', 'linux'));
      const nav = spyOn(router, 'navigate').and.resolveTo(true);
      const card = q('[data-servers] [data-server-card]')!;
      expect(card.getAttribute('aria-disabled')).toBeNull();
      card.click();
      expect(nav).toHaveBeenCalledWith(['/services', SID, 'connections', 'new', 'ac_04', 'linux'], { queryParams: { returnTo: router.url } });
    });

    it('an available platform WITHOUT a flow stays locked: the wizard would send the user back', () => {
      TestBed.resetTestingModule();
      configure(open('available', 'aix'));
      expect(q('[data-servers] [data-server-card]')!.getAttribute('aria-disabled')).toBe('true');
    });

    it('a platform that is coming soon stays locked even if it has a flow', () => {
      TestBed.resetTestingModule();
      configure(open('coming_soon', 'windows'));
      const nav = spyOn(router, 'navigate').and.resolveTo(true);
      q('[data-servers] [data-server-card]')!.click();
      expect(nav).not.toHaveBeenCalled();
    });
  });
});
