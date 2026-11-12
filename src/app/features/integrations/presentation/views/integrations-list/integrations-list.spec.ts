import { CatalogService } from '@shared/domain/services/catalog.service';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { Integration } from '@features/integrations/domain/models/integration.models';
import { IntegrationService } from '@features/integrations/domain/services/integration.service';
import { pickOption } from '@shared/presentation/components/select/select.testing';
import { IntegrationsListView } from './integrations-list';

const AWS: Integration = {
  code: 'aws', name: 'Amazon Web Services', logo_key: 'aws', purpose: 'measurement', status: 'needs_attention', connection_count: 2, resource_count: 42, last_validated_at: '2026-11-10T14:03:00Z',
  connections: [
    { asset_id: 'a1', code: 'AST-0001', name: 'Producción', connection_status: 'failed', operational_status: 'error', needs_attention: true, services: [{ id: 's1', name: 'Pagos' }, { id: 's2', name: 'Soporte' }] },
    { asset_id: 'a2', code: 'AST-0002', name: 'Pruebas', connection_status: 'active', operational_status: 'operational', needs_attention: false, services: [{ id: 's1', name: 'Pagos' }] },
  ],
};
const JIRA: Integration = {
  code: 'jira', name: 'Jira', logo_key: 'jira', purpose: 'workflow', status: 'pending', connection_count: 1, resource_count: 0, last_validated_at: null,
  connections: [{ asset_id: 'a3', code: 'AST-0003', name: 'Jira', connection_status: 'validated', operational_status: 'not_monitored', needs_attention: false, services: [{ id: 's1', name: 'Pagos' }] }],
};
const OK: Integration = { ...JIRA, code: 'github', name: 'GitHub', logo_key: 'github', purpose: 'measurement', status: 'active' };

describe('IntegrationsListView', () => {
  let fixture: ComponentFixture<IntegrationsListView>;

  function setup(role: string, result: Integration[] | 'error'): void {
    const api = jasmine.createSpyObj<IntegrationService>('IntegrationService', ['list']);
    api.list.and.returnValue(result === 'error' ? throwError(() => new Error('x')) : of(result));
    const catalog = jasmine.createSpyObj<CatalogService>('CatalogService', ['options']);
    catalog.options.and.returnValue(of([{ value: 'active', label: 'Activa' }, { value: 'pending', label: 'Pendiente' }, { value: 'needs_attention', label: 'Requiere atención' }]));
    TestBed.configureTestingModule({ imports: [IntegrationsListView], providers: [provideTranslateService(), provideRouter([]), { provide: IntegrationService, useValue: api }, { provide: CatalogService, useValue: catalog }] });
    TestBed.inject(SessionService).set({ id: 'u', email: 'a@x.co', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(IntegrationsListView);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector<HTMLElement>(s);
  const qa = (s: string) => Array.from(el().querySelectorAll<HTMLElement>(s));
  const click = (s: string) => {
    q(s)!.click();
    fixture.detectChanges();
  };

  it('shows one row per integration with the tone of its status', () => {
    setup('admin_empresa', [AWS, JIRA, OK]);
    expect(qa('app-data-table tbody tr').length).toBe(3);
    expect(q('tbody app-status-indicator[data-tone="warn"]')).not.toBeNull();
    expect(q('tbody app-status-indicator[data-tone="neutral"]')).not.toBeNull();
    expect(q('tbody app-status-indicator[data-tone="ok"]')).not.toBeNull();
    expect(q('tbody')!.textContent).toContain('42');
  });

  it('gives the administrator the add action and the auditor none', () => {
    setup('admin_empresa', [OK]);
    expect(q('[data-test-add]')!.getAttribute('href')).toBe('/integraciones/agregar');
    TestBed.resetTestingModule();
    setup('auditor', [OK]);
    expect(q('[data-test-add]')).toBeNull();
  });

  it('filters by name and by status', () => {
    setup('admin_empresa', [AWS, JIRA, OK]);
    fixture.componentInstance.query.set('jir');
    fixture.detectChanges();
    expect(qa('tbody tr').length).toBe(1);
    fixture.componentInstance.query.set('');
    fixture.componentInstance.statuses.set(['active']);
    fixture.detectChanges();
    expect(qa('tbody tr').length).toBe(1);
    expect(q('tbody')!.textContent).toContain('GitHub');
    fixture.componentInstance.statuses.set(['active', 'pending']);
    fixture.detectChanges();
    expect(qa('tbody tr').length).toBe(2);
  });

  it('has a multiple status filter that shows its name and how many are chosen', () => {
    setup('admin_empresa', [AWS, JIRA, OK]);
    expect(q('app-table-filter [data-select-trigger]')!.textContent).toContain('INTEGRATIONS.LIST.FILTER_STATUS');
    pickOption(el(), 'app-table-filter', 'active', () => fixture.detectChanges());
    pickOption(el(), 'app-table-filter', 'pending', () => fixture.detectChanges());
    expect(q('app-table-filter [data-select-count]')!.textContent).toBe('2');
    expect(qa('tbody tr').length).toBe(2);
  });

  it('keeps each header aligned like its column and with the same padding as its cells', () => {
    setup('admin_empresa', [AWS]);
    const heads = qa('thead th[scope="col"]');
    const cells = qa('tbody tr:first-child td');
    expect(heads[2].className).toContain('text-center');
    expect(cells[2].className).toContain('text-center');
    expect(heads[3].className).toContain('lg:w-48');
    expect(heads[0].className).toContain('px-6');
  });

  it('shows no attention notice when nothing needs attention', () => {
    setup('admin_empresa', [JIRA, OK]);
    expect(q('[data-test-attention]')).toBeNull();
  });

  it('shows a collapsible notice that lists only the failing connections, with a review link for the administrator', () => {
    setup('admin_empresa', [AWS, JIRA]);
    expect(q('[data-test-attention]')).not.toBeNull();
    expect(q('[data-test-attention-body]')).toBeNull();
    click('[data-test-attention-toggle]');
    expect(qa('[data-test-attention-item]').length).toBe(1);
    expect(q('[data-test-attention-body]')!.textContent).toContain('INTEGRATIONS.ATTENTION.BODY');
    expect(q('[data-test-review]')!.getAttribute('href')).toBe('/services/s1/connections/a1');
  });

  it('gives the auditor the notice without links', () => {
    setup('auditor', [AWS]);
    click('[data-test-attention-toggle]');
    expect(qa('[data-test-attention-item]').length).toBe(1);
    expect(q('[data-test-review]')).toBeNull();
  });

  it('opens the detail of the integration when a row is clicked (and has no drawer any more)', () => {
    setup('admin_empresa', [AWS, JIRA]);
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    click('tbody tr');
    expect(nav).toHaveBeenCalledWith(['/integraciones', 'aws']);
    expect(q('app-side-drawer')).toBeNull();
    expect(q('[data-test-connection]')).toBeNull();
  });

  it('lets the auditor open the detail from a row too', () => {
    setup('auditor', [AWS]);
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    click('tbody tr');
    expect(nav).toHaveBeenCalledWith(['/integraciones', 'aws']);
  });

  it('shows the empty state with an action for the administrator', () => {
    setup('admin_empresa', []);
    expect(q('app-empty-state')!.textContent).toContain('INTEGRATIONS.LIST.ADD');
    expect(q('app-empty-state a[href="/integraciones/agregar"]')).not.toBeNull();
  });

  it('shows the auditor the empty state without actions', () => {
    setup('auditor', []);
    expect(q('app-empty-state')).not.toBeNull();
    expect(q('app-empty-state a')).toBeNull();
    expect(q('app-empty-state')!.textContent).toContain('INTEGRATIONS.LIST.EMPTY_BODY_AUDITOR');
  });

  it('shows the error state with a retry', () => {
    setup('admin_empresa', 'error');
    expect(q('app-empty-state')!.textContent).toContain('INTEGRATIONS.LIST.LOAD_ERROR_TITLE');
    expect(q('app-empty-state button')).not.toBeNull();
  });

  it('asks once on entering and takes the status filter options from the integration_status catalog', () => {
    setup('admin_empresa', [AWS, JIRA, OK]);
    const api = TestBed.inject(IntegrationService) as jasmine.SpyObj<IntegrationService>;
    expect(api.list).toHaveBeenCalledTimes(1);
    expect((TestBed.inject(CatalogService) as jasmine.SpyObj<CatalogService>).options).toHaveBeenCalledWith('integration_status');
    expect(fixture.componentInstance.statusOptions().map((o) => o.value)).toEqual(['active', 'pending', 'needs_attention']);
    expect(fixture.componentInstance.statusOptions()[0].label).toBe('Activa');
  });
});
