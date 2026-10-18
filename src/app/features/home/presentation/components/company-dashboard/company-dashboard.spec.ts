import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { NEVER, of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { Dashboard, DashboardFramework, DashboardServiceSummary } from '../../../domain/models/dashboard.models';
import { HomeDashboardService } from '../../../domain/services/dashboard.service';
import { CompanyDashboard } from './company-dashboard';

const framework = (patch: Partial<DashboardFramework> = {}): DashboardFramework => ({
  code: 'soc2', name: 'SOC 2', readiness: 'needs_work', verdict: 'non_compliant', progress: { done: 20, total: 50 }, coverage: { measured: 40, applicable: 50 }, ...patch,
});
const service = (id: string, patch: Partial<DashboardServiceSummary> = {}): DashboardServiceSummary => ({
  id, name: `Servicio ${id}`, frameworks: [framework()], assets: 5, controls: 50, risks: 10, risksEvaluated: 4, causes: 56, failing: [{ controlId: `${id}-k1`, code: 'IAC-12', name: 'Accesos' }], ...patch,
});

describe('CompanyDashboard', () => {
  let api: jasmine.SpyObj<HomeDashboardService>;
  let fixture: ComponentFixture<CompanyDashboard>;

  function setup(role: string, result: Dashboard | 'error' | 'pending'): void {
    api = jasmine.createSpyObj<HomeDashboardService>('HomeDashboardService', ['load']);
    api.load.and.returnValue(result === 'error' ? throwError(() => new Error('x')) : result === 'pending' ? NEVER : of(result));
    TestBed.configureTestingModule({ imports: [CompanyDashboard], providers: [provideTranslateService(), provideRouter([]), { provide: HomeDashboardService, useValue: api }] });
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(CompanyDashboard);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector(s);
  const total = (name: string) => q(`[data-total="${name}"]`)!.textContent!.trim();

  it('shows nothing, and asks for nothing, to a user who cannot read the services', () => {
    setup('funcional', { services: [service('s1')] });
    expect(api.load).not.toHaveBeenCalled();
    expect(q('[data-dashboard]')).toBeNull();
  });

  it('asks for the technical view for the company admin', () => {
    setup('admin_empresa', { services: [service('s1')] });
    expect(api.load).toHaveBeenCalledWith(true);
  });

  it('adds up what the company has across its services', () => {
    setup('admin_empresa', { services: [service('s1'), service('s2', { assets: 3, controls: 80, risks: 5, risksEvaluated: 1, causes: 10, frameworks: [framework({ code: 'iso27001', name: 'ISO 27001' })] })] });
    expect(total('services')).toBe('2');
    expect(total('assets')).toBe('8');
    expect(total('frameworks')).toBe('2');
    expect(total('controls')).toBe('130');
    expect(total('risks')).toBe('15');
    expect(total('causes')).toBe('66');
    expect(q('[data-total="risks-evaluated"]')!.textContent).toContain('HOME.DASHBOARD.RISKS_EVALUATED');
  });

  it('counts a framework once even when two services contract it', () => {
    setup('admin_empresa', { services: [service('s1'), service('s2')] });
    expect(total('frameworks')).toBe('1');
  });

  it('shows one status per service and framework, never a single grade for the company', () => {
    setup('admin_empresa', { services: [service('s1'), service('s2', { frameworks: [framework(), framework({ code: 'iso27001', name: 'ISO 27001', readiness: 'ready', verdict: 'compliant' })] })] });
    expect(el().querySelectorAll('[data-service]').length).toBe(2);
    expect(el().querySelectorAll('[data-framework]').length).toBe(3);
    expect(el().textContent).toContain('HOME.DASHBOARD.STATUS_INTRO');
    expect(el().textContent).not.toMatch(/nota única de la empresa|company score/i);
  });

  it('orders the services from the most urgent to the least: failing first, then on track, then without results, and the ones that comply last', () => {
    const ok = service('ok', { name: 'Cumple', failing: [], frameworks: [framework({ readiness: 'ready', verdict: 'compliant' })] });
    const none = service('none', { name: 'Sin datos', failing: [], frameworks: [framework({ readiness: 'not_measured', verdict: 'evaluating' })] });
    const close = service('close', { name: 'Casi', failing: [], frameworks: [framework({ readiness: 'almost_ready', verdict: 'evaluating' })] });
    const bad = service('bad', { name: 'Falla' });
    setup('admin_empresa', { services: [ok, none, close, bad] });
    expect(Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[data-service]')).map((e) => e.getAttribute('data-service'))).toEqual(['bad', 'close', 'none', 'ok']);
  });

  it('puts the engine verdict next to the status, and the progress with the coverage', () => {
    setup('admin_empresa', { services: [service('s1')] });
    const row = q('[data-framework="soc2"]')!;
    expect(row.querySelector('[data-verdict]')!.textContent).toContain('COMPLIANCE.OVERVIEW.VERDICT.NON_COMPLIANT');
    expect(row.querySelector('[data-progress]')!.textContent).toContain('HOME.DASHBOARD.PROGRESS');
    expect(row.textContent).toContain('HOME.DASHBOARD.COVERAGE');
  });

  it('a framework without results says so and shows no percentage or verdict: not measured is not a zero', () => {
    setup('admin_empresa', { services: [service('s1', { frameworks: [framework({ readiness: 'not_measured', verdict: 'evaluating', progress: { done: 0, total: 50 }, coverage: { measured: 0, applicable: 50 } })] })] });
    const row = q('[data-framework="soc2"]')!;
    expect(row.querySelector('[data-not-measured]')).not.toBeNull();
    expect(row.querySelector('[data-progress]')).toBeNull();
    expect(row.querySelector('[data-verdict]')).toBeNull();
  });

  it('links each service to its compliance summary', () => {
    setup('admin_empresa', { services: [service('s1')] });
    expect(q('[data-service="s1"] a')!.getAttribute('href')).toBe('/services/s1/cumplimiento/resumen');
  });

  it('lists the controls that fail across the services, capped, with how many more there are', () => {
    const many = Array.from({ length: 4 }, (_, i) => ({ controlId: `k${i}`, code: `C-${i}`, name: `Control ${i}` }));
    setup('admin_empresa', { services: [service('s1', { failing: many }), service('s2', { failing: many.map((m) => ({ ...m, controlId: `b${m.controlId}` })) })] });
    expect(el().querySelectorAll('[data-attention] li').length).toBe(5);
    expect(q('[data-attention-more]')!.textContent).toContain('HOME.DASHBOARD.ATTENTION_MORE');
  });

  it('says nothing fails when nothing fails', () => {
    setup('admin_empresa', { services: [service('s1', { failing: [] })] });
    expect(q('[data-attention-empty]')).not.toBeNull();
  });

  it('renders nothing for a company with no services yet', () => {
    setup('admin_empresa', { services: [] });
    expect(q('[data-dashboard]')).toBeNull();
  });

  it('shows an error with a retry when the summary cannot be loaded', () => {
    setup('admin_empresa', 'error');
    expect(q('[data-dashboard-error]')).not.toBeNull();
    api.load.and.returnValue(of({ services: [service('s1')] }));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(q('[data-dashboard]')).not.toBeNull();
  });
});
