import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { ServiceListItem } from '@shared/domain/models/service.models';
import { ServiceService } from '@shared/domain/services/service.service';
import { IntegrationDetail } from '@features/integrations/domain/models/integration.models';
import { IntegrationService } from '@features/integrations/domain/services/integration.service';
import { IntegrationDetailView } from './integration-detail';

const AWS: IntegrationDetail = {
  code: 'aws', name: 'Amazon Web Services', logo_key: 'aws', purpose: 'measurement', availability: 'available', description: 'Evalúa tu cuenta.', connection: { category: 'ac_01', platform: 'aws' }, connected: false,
  status: null, connection_count: 0, resource_count: 0, last_validated_at: null, connections: [],
  overview: 'Monkey evalúa tu cuenta.', features: ['Descubrir recursos', 'Repetir la evaluación'], prerequisites: ['Permiso para crear un rol'],
  permissions: [
    { name: 'SecurityAudit', detail: 'Leer la configuración', scope: 'arn:aws:iam::aws:policy/SecurityAudit', access: 'read' },
    { name: 'Asumir el rol', detail: 'Solo Monkey', scope: null, access: 'read' },
  ],
  resource_types: ['server', 'database'],
  coverage: { tests: [{ code: 'T-CLD-001', name: 'Cifrado en reposo' }, { code: 'T-CLD-002', name: 'Registros activos' }], controls_count: 5, frameworks: [{ code: 'soc2', name: 'SOC 2', controls_count: 4 }, { code: 'iso', name: 'ISO 27001', controls_count: 3 }] },
  security: [{ topic: 'read_only', text: 'No cambia nada.' }, { topic: 'temporary_credentials', text: 'Una hora.' }, { topic: 'external_id', text: 'Solo Monkey.' }, { topic: 'isolated_execution', text: 'Aislado.' }, { topic: 'tenant_isolation', text: 'Solo tu empresa.' }, { topic: 'encrypted_keys', text: 'Cifradas.' }],
  capabilities: ['Evaluación continua'], works_with: ['Cumplimiento'],
};
const CONNECTED: IntegrationDetail = {
  ...AWS, connected: true, status: 'needs_attention', connection_count: 2, resource_count: 42,
  connections: [
    { asset_id: 'a1', code: 'AST-0001', name: 'Producción', connection_status: 'failed', operational_status: 'error', needs_attention: true, services: [{ id: 's1', name: 'Pagos' }, { id: 's2', name: 'Soporte' }] },
    { asset_id: 'a2', code: 'AST-0002', name: 'Pruebas', connection_status: 'active', operational_status: 'operational', needs_attention: false, services: [{ id: 's1', name: 'Pagos' }] },
  ],
};
const SOON: IntegrationDetail = {
  ...AWS, code: 'azure', name: 'Azure', logo_key: 'azure', availability: 'coming_soon', connection: { category: 'ac_01', platform: 'azure' },
  prerequisites: [], permissions: [], resource_types: [], coverage: null, security: [],
};
const WRITE: IntegrationDetail = { ...AWS, permissions: [{ name: 'Crear tickets', detail: 'Abre tickets', scope: 'write:tickets', access: 'write' }, ...AWS.permissions] };
const SERVICE = { id: 's1', name: 'Pagos' } as ServiceListItem;

describe('IntegrationDetailView', () => {
  let fixture: ComponentFixture<IntegrationDetailView>;
  let router: Router;
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let api: jasmine.SpyObj<IntegrationService>;

  function setup(role: string, result: IntegrationDetail | 'not_found' | 'error', tab: string | null = null): void {
    api = jasmine.createSpyObj<IntegrationService>('IntegrationService', ['getDetail']);
    api.getDetail.and.returnValue(
      result === 'not_found' ? throwError(() => new HttpErrorResponse({ status: 404 })) : result === 'error' ? throwError(() => new HttpErrorResponse({ status: 500 })) : of(result),
    );
    const svc = jasmine.createSpyObj<ServiceService>('ServiceService', ['list']);
    svc.list.and.returnValue(of({ items: [SERVICE], page: 1, page_size: 50, total: 1, total_pages: 1 }));
    query = new BehaviorSubject(convertToParamMap(tab ? { tab } : {}));
    const code = result === 'not_found' || result === 'error' ? 'xx' : result.code;
    const route = { snapshot: { paramMap: convertToParamMap({ code }), queryParamMap: query.value }, queryParamMap: query.asObservable() };
    TestBed.configureTestingModule({
      imports: [IntegrationDetailView],
      providers: [provideTranslateService(), provideRouter([]), { provide: IntegrationService, useValue: api }, { provide: ServiceService, useValue: svc }, { provide: ActivatedRoute, useValue: route }],
    });
    TestBed.inject(SessionService).set({ id: 'u', email: 'a@x.co', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(IntegrationDetailView);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector<HTMLElement>(s);
  const qa = (s: string) => Array.from(el().querySelectorAll<HTMLElement>(s));
  const goTab = (tab: string) => {
    query.next(convertToParamMap({ tab }));
    fixture.detectChanges();
  };

  it('asks the backend for the code in the route', () => {
    setup('admin_empresa', AWS);
    expect(api.getDetail).toHaveBeenCalledWith('aws');
  });

  describe('available and not connected', () => {
    beforeEach(() => setup('admin_empresa', AWS));

    it('shows the header with the name, the description and no status', () => {
      expect(q('h1')!.textContent).toContain('Amazon Web Services');
      expect(q('[data-test-header]')!.textContent).toContain('Evalúa tu cuenta.');
      expect(q('app-provider-logo')).not.toBeNull();
      expect(q('[data-test-status]')).toBeNull();
    });

    it('goes back to Add integration for the administrator', () => {
      expect(q('[data-test-back]')!.getAttribute('href')).toBe('/integraciones/agregar');
    });

    it('shows the overview with the features and the prerequisites', () => {
      expect(q('[data-test-overview]')!.textContent).toContain('Monkey evalúa tu cuenta.');
      expect(q('[data-test-features]')!.querySelectorAll('li').length).toBe(2);
      expect(q('[data-test-prerequisites]')!.textContent).toContain('Permiso para crear un rol');
    });

    it('has no Connections tab without connections', () => {
      expect(qa('[role=tab]').map((t) => t.id)).toEqual(['tab-overview', 'tab-permissions', 'tab-evaluates', 'tab-security']);
    });

    it('offers Connect and the coverage lines in the side panel', () => {
      expect(q('[data-test-connect]')!.textContent).toContain('INTEGRATIONS.ADD.CONNECT');
      expect(q('[data-test-connect]')!.textContent).not.toContain('CONNECT_ANOTHER');
      expect(qa('[data-test-feeds] li').length).toBe(2);
      expect(q('[data-test-capabilities]')!.textContent).toContain('Evaluación continua');
      expect(q('[data-test-works-with]')!.textContent).toContain('Cumplimiento');
    });

    it('opens the service modal and goes to the connection flow', () => {
      const nav = spyOn(router, 'navigate').and.resolveTo(true);
      q('[data-test-connect]')!.click();
      fixture.detectChanges();
      expect(qa('[data-test-service]').length).toBe(1);
      q('[data-test-service]')!.click();
      expect(nav).toHaveBeenCalledWith(['/services', 's1', 'connections', 'new', 'ac_01', 'aws']);
    });

    it('hides the prerequisites when there are none', () => {
      TestBed.resetTestingModule();
      setup('admin_empresa', { ...AWS, prerequisites: [] });
      expect(q('[data-test-prerequisites]')).toBeNull();
    });

    it('writes the tab to ?tab= when a tab is chosen', () => {
      const nav = spyOn(router, 'navigate').and.resolveTo(true);
      q('#tab-permissions')!.click();
      expect(nav).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { tab: 'permissions' }, queryParamsHandling: 'merge' }));
    });

    it('follows ?tab= and falls back to the overview for an unknown or hidden tab', () => {
      goTab('permissions');
      expect(q('#tab-permissions')!.getAttribute('aria-selected')).toBe('true');
      expect(qa('[data-test-permission]').length).toBe(2);
      goTab('connections');
      expect(q('#tab-overview')!.getAttribute('aria-selected')).toBe('true');
      goTab('nope');
      expect(q('[data-test-overview]')).not.toBeNull();
    });

    it('lists the read permissions with their code and a line saying they are all read-only', () => {
      goTab('permissions');
      expect(q('h2')!.textContent).toContain('INTEGRATIONS.PERMISSIONS.TITLE');
      expect(q('[data-test-read-only]')).not.toBeNull();
      const cards = qa('[data-test-permission]');
      expect(cards[0].querySelector('app-tag')!.textContent).toContain('arn:aws:iam::aws:policy/SecurityAudit');
      expect(cards[1].querySelector('app-tag')).toBeNull();
      expect(cards.every((c) => c.querySelector('app-status-indicator[data-tone="ok"]') !== null)).toBeTrue();
    });

    it('shows write access in the warn tone and drops the read-only line', () => {
      TestBed.resetTestingModule();
      setup('admin_empresa', WRITE, 'permissions');
      expect(q('[data-test-read-only]')).toBeNull();
      expect(qa('[data-test-permission]')[0].querySelector('app-status-indicator[data-tone="warn"]')).not.toBeNull();
    });

    it('shows what it evaluates: resource types, the coverage, the tests, the frameworks and the note', () => {
      goTab('evaluates');
      expect(qa('[data-test-resources] li').length).toBe(2);
      expect(q('[data-test-summary]')).not.toBeNull();
      expect(qa('[data-test-test]').map((t) => t.querySelector('app-tag')!.textContent!.trim())).toEqual(['T-CLD-001', 'T-CLD-002']);
      expect(qa('[data-test-framework]').length).toBe(2);
      expect(q('[data-test-framework]')!.textContent).toContain('SOC 2');
      expect(q('[data-test-note]')!.textContent).toContain('INTEGRATIONS.EVALUATES.NOTE');
    });

    it('shows no coverage block when the backend sends none', () => {
      TestBed.resetTestingModule();
      setup('admin_empresa', { ...AWS, coverage: null }, 'evaluates');
      expect(q('[data-test-coverage]')).toBeNull();
      expect(q('[data-test-resources]')).not.toBeNull();
      expect(q('[data-test-feeds]')).toBeNull();
    });

    it('shows one security card per element with its icon', () => {
      goTab('security');
      expect(qa('[data-test-security]').length).toBe(6);
      expect(qa('[data-test-security-icon]').map((i) => i.textContent!.trim())).toEqual(['lock', 'schedule', 'key', 'deployed_code', 'apartment', 'shield']);
    });
  });

  describe('connected with connections', () => {
    beforeEach(() => setup('admin_empresa', CONNECTED));

    it('shows the status in the header and goes back to the list', () => {
      expect(q('[data-test-status]')!.getAttribute('data-tone')).toBe('warn');
      expect(q('[data-test-back]')!.getAttribute('href')).toBe('/integraciones');
    });

    it('offers Connect another account', () => {
      expect(q('[data-test-connect]')!.textContent).toContain('INTEGRATIONS.ADD.CONNECT_ANOTHER');
    });

    it('has the Connections tab with the tones, the attention flag, its explanation and a link per service', () => {
      expect(qa('[role=tab]').map((t) => t.id)).toContain('tab-connections');
      goTab('connections');
      expect(q('[data-test-attention-note]')!.textContent).toContain('INTEGRATIONS.ATTENTION.BODY');
      const cards = qa('[data-test-connection]');
      expect(cards.length).toBe(2);
      expect(cards[0].querySelector('app-status-indicator[data-tone="bad"]')).not.toBeNull();
      expect(cards[0].querySelector('[data-test-connection-attention]')).not.toBeNull();
      expect(cards[1].querySelector('app-status-indicator[data-tone="ok"]')).not.toBeNull();
      expect(cards[1].querySelector('[data-test-connection-attention]')).toBeNull();
      expect(qa('[data-test-service-link]').map((a) => a.getAttribute('href'))).toEqual(['/services/s1/connections/a1', '/services/s2/connections/a1', '/services/s1/connections/a2']);
    });
  });

  describe('coming soon', () => {
    beforeEach(() => setup('admin_empresa', SOON));

    it('shows Coming soon and no Connect button', () => {
      expect(q('[data-test-connect]')).toBeNull();
      expect(q('[data-test-action-card] app-status-indicator')!.textContent).toContain('INTEGRATIONS.ADD.COMING_SOON');
    });

    it('explains that Permissions, What it evaluates and Security will come later', () => {
      for (const tab of ['permissions', 'evaluates', 'security']) {
        goTab(tab);
        expect(q('[data-test-soon]')!.textContent).toContain('INTEGRATIONS.DETAIL.SOON_TITLE');
        expect(q('[data-test-permission]')).toBeNull();
        expect(q('[data-test-security]')).toBeNull();
      }
    });
  });

  describe('auditor', () => {
    it('sees no buttons and no links to connections, and goes back to the list', () => {
      setup('auditor', CONNECTED, 'connections');
      expect(q('[data-test-connect]')).toBeNull();
      expect(q('button.mk-btn')).toBeNull();
      expect(q('[data-test-service-link]')).toBeNull();
      expect(qa('[data-test-connection] a').length).toBe(0);
      expect(q('[data-test-back]')!.getAttribute('href')).toBe('/integraciones');
    });

    it('goes back to the list even for an integration that is not connected', () => {
      TestBed.resetTestingModule();
      setup('auditor', AWS);
      expect(q('[data-test-back]')!.getAttribute('href')).toBe('/integraciones');
      expect(q('[data-test-connect]')).toBeNull();
    });
  });

  describe('errors', () => {
    it('shows the not-found empty state with a link to the list on 404', () => {
      setup('admin_empresa', 'not_found');
      expect(q('[data-test-not-found]')!.textContent).toContain('INTEGRATIONS.DETAIL.NOT_FOUND_TITLE');
      expect(q('[data-test-not-found] a')!.getAttribute('href')).toBe('/integraciones');
      expect(q('h1')).toBeNull();
    });

    it('shows a retry on any other error', () => {
      setup('admin_empresa', 'error');
      expect(q('[data-test-not-found]')).toBeNull();
      expect(q('app-empty-state button')).not.toBeNull();
      q('app-empty-state button')!.click();
      expect(api.getDetail).toHaveBeenCalledTimes(2);
    });
  });

  it('asks once on entering and keeps the tab', () => {
    setup('admin_empresa', AWS, 'permissions');
    expect(api.getDetail).toHaveBeenCalledTimes(1);
    expect(q('#tab-permissions')!.getAttribute('aria-selected')).toBe('true');
  });
});
