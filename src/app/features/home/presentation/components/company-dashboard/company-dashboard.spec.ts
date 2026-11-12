import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { NEVER, of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { Dashboard, DashboardFramework, DashboardServiceSummary } from '@features/home/domain/models/dashboard.models';
import { HomeTeamLoad, HomeTeamMember } from '@features/home/domain/models/team.models';
import { HomeDashboardService } from '@features/home/domain/services/dashboard.service';
import { HomeTeamService } from '@features/home/domain/services/team-overview.service';
import { CompanyDashboard } from './company-dashboard';
import { pickOption } from '@shared/presentation/components/select/select.testing';

const framework = (patch: Partial<DashboardFramework> = {}): DashboardFramework => ({
  code: 'soc2', name: 'SOC 2', readiness: 'needs_work', verdict: 'non_compliant', progress: { done: 20, total: 50 }, coverage: { measured: 40, applicable: 50 }, ...patch,
});
const service = (id: string, patch: Partial<DashboardServiceSummary> = {}): DashboardServiceSummary => ({
  id, name: `Servicio ${id}`, frameworks: [framework()], assets: 5, controls: 50, risks: 10, risksEvaluated: 4, causes: 56, failing: [{ controlId: `${id}-k1`, code: 'IAC-12', name: 'Accesos' }], ...patch,
});

describe('CompanyDashboard', () => {
  let api: jasmine.SpyObj<HomeDashboardService>;
  let team: jasmine.SpyObj<HomeTeamService>;
  let fixture: ComponentFixture<CompanyDashboard>;

  const person = (patch: Partial<HomeTeamMember>): HomeTeamMember => ({ role: 'delegado', status: 'active', mfaEnabled: true, lastLoginAt: null, ...patch });

  function setup(role: string, result: Dashboard | 'error' | 'pending', people: HomeTeamMember[] | HomeTeamLoad | 'error' | 'pending' = []): void {
    team = jasmine.createSpyObj<HomeTeamService>('HomeTeamService', ['loadAll']);
    team.loadAll.and.returnValue(people === 'error' ? throwError(() => new Error('x')) : people === 'pending' ? NEVER : of(Array.isArray(people) ? { members: people, partial: false } : people));
    api = jasmine.createSpyObj<HomeDashboardService>('HomeDashboardService', ['load']);
    api.load.and.returnValue(result === 'error' ? throwError(() => new Error('x')) : result === 'pending' ? NEVER : of(result));
    TestBed.configureTestingModule({ imports: [CompanyDashboard], providers: [provideTranslateService(), provideRouter([]), { provide: HomeDashboardService, useValue: api }, { provide: HomeTeamService, useValue: team }] });
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(CompanyDashboard);
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector(s);
  const total = (name: string) => q(`[data-total="${name}"]`)!.textContent!.trim();

  it('shows nothing, and asks for nothing, to a user who cannot read the services', () => {
    setup('responsable', { services: [service('s1')] });
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
    expect(q('[data-hint="risks"]')!.textContent).toContain('HOME.DASHBOARD.RISKS_EVALUATED');
  });

  it('invites a company with no services to create the first one, with a link to the same screen as "My services" (D89)', () => {
    setup('admin_empresa', { services: [] });
    expect(q('[data-dashboard]')).toBeNull();
    const cta = q('[data-no-services] a')!;
    expect(cta.getAttribute('href')).toBe('/services/new');
    expect(q('[data-no-services]')!.textContent).toContain('HOME.DASHBOARD.NO_SERVICES_TITLE');
  });

  it('counts a framework once even when two services contract it', () => {
    setup('admin_empresa', { services: [service('s1'), service('s2')] });
    expect(total('frameworks')).toBe('1');
  });

  it('shows one status per service and framework, never a single grade for the company', () => {
    setup('admin_empresa', { services: [service('s1'), service('s2', { frameworks: [framework(), framework({ code: 'iso27001', name: 'ISO 27001', readiness: 'ready', verdict: 'compliant' })] })] });
    expect(el().querySelectorAll('[data-service]').length).toBe(2);
    expect(el().querySelectorAll('[data-framework]').length).toBe(3);
    expect(el().textContent).not.toContain('HOME.DASHBOARD.STATUS_INTRO');
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

  it('puts the engine verdict next to the status, and the progress in a donut with the coverage beside it', () => {
    setup('admin_empresa', { services: [service('s1')] });
    const row = q('[data-framework="soc2"]')!;
    expect(row.querySelector('[data-verdict]')!.textContent).toContain('COMPLIANCE.OVERVIEW.VERDICT.NON_COMPLIANT');
    const donut = row.querySelector('app-donut[data-progress]')!;
    expect(donut.getAttribute('aria-label')).toContain('HOME.DASHBOARD.PROGRESS');
    expect(donut.textContent).toMatch(/\d/);
    expect(row.querySelector('[data-coverage]')!.textContent).toContain('HOME.DASHBOARD.COVERAGE');
    expect(row.querySelector('[data-status]')).not.toBeNull();
  });

  it('shows every KPI figure in one colour (the brand blue, white on the featured card) and keeps the data palette for the framework donuts only', () => {
    setup('admin_empresa', { services: [service('s1'), service('s2')] });
    const classes = ['assets', 'frameworks', 'controls', 'risks', 'causes'].map((id) => q(`[data-total="${id}"]`)!.className);
    classes.forEach((c) => expect(c).toContain('text-action'));
    expect(classes.join(' ')).not.toMatch(/text-data-\d/);
    expect(q('[data-total="services"]')!.className).toContain('text-white');
    const stroke = (id: string) => q(`[data-service="${id}"] circle[stroke-dasharray]`)!.getAttribute('stroke');
    expect(stroke('s1')).toBe(stroke('s2'));
  });

  it('draws no icon of its own in the dashboard once it has loaded', () => {
    setup('admin_empresa', { services: [service('s1')] });
    // The previous/next arrows of the pagination and the arrow at the end of an openable row are controls, not decoration.
    expect(Array.from(el().querySelectorAll('.material-symbols-rounded')).filter((i) => !i.closest('nav') && !i.hasAttribute('data-row-chevron'))).toEqual([]);
  });

  it('a framework without results says so and shows no percentage or verdict: not measured is not a zero', () => {
    setup('admin_empresa', { services: [service('s1', { frameworks: [framework({ readiness: 'not_measured', verdict: 'evaluating', progress: { done: 0, total: 50 }, coverage: { measured: 0, applicable: 50 } })] })] });
    const row = q('[data-framework="soc2"]')!;
    expect(row.querySelector('[data-not-measured]')).not.toBeNull();
    const donut = row.querySelector('app-donut[data-progress]')!;
    expect(donut.querySelector('circle[stroke-dasharray]')).toBeNull();
    expect(donut.textContent!.trim()).toBe('');
    expect(donut.getAttribute('aria-label')).toContain('COMMON.READINESS.LABEL.NOT_MEASURED');
    expect(row.querySelector('[data-coverage]')).toBeNull();
    expect(row.querySelector('[data-verdict]')).toBeNull();
  });

  it('links each service to its compliance summary', () => {
    setup('admin_empresa', { services: [service('s1')] });
    expect(q('[data-service="s1"] a')!.getAttribute('href')).toBe('/cumplimiento/resumen?servicio=s1');
  });

  describe('attention table pagination (client side)', () => {
    const failing = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => ({ controlId: `${prefix}${i}`, code: `C-${i}`, name: `Control ${prefix}${i}` }));
    const rows = () => el().querySelectorAll('[data-attention] tbody tr').length;

    beforeEach(() => setup('admin_empresa', { services: [service('s1', { failing: failing('a', 21) }), service('s2', { failing: failing('b', 10) })] }));

    it('lists all the failing controls by pages of 10, with the range and without the old "and N more" footer', () => {
      expect(rows()).toBe(10);
      expect(q('[data-attention] [data-showing]')!.textContent).toContain('COMMON.TABLE.SHOWING');
      expect(q('[data-attention-more]')).toBeNull();
      expect(el().querySelectorAll('[data-attention] [data-page-number]').length).toBe(4);
    });

    it('goes to another page, and the last one has the rest', () => {
      el().querySelectorAll<HTMLButtonElement>('[data-attention] [data-page-number]')[3].click();
      fixture.detectChanges();
      expect(rows()).toBe(1);
      expect(el().querySelector('[data-attention] [aria-current="page"]')!.textContent!.trim()).toBe('4');
    });

    it('changes the page size and goes back to the first page', () => {
      el().querySelectorAll<HTMLButtonElement>('[data-attention] [data-page-number]')[1].click();
      fixture.detectChanges();
      pickOption(el(), '[data-attention] app-pagination app-select', '25', () => fixture.detectChanges());
      expect(rows()).toBe(25);
      expect(el().querySelector('[data-attention] [aria-current="page"]')!.textContent!.trim()).toBe('1');
    });
  });

  it('shows each failing control as a row with its code, name and affected service, and opens the service controls on click', () => {
    setup('admin_empresa', { services: [service('s1')] });
    const router = TestBed.inject(Router);
    const nav = spyOn(router, 'navigate').and.resolveTo(true);
    const cells = el().querySelectorAll('[data-attention] tbody tr td');
    expect(cells[0].textContent).toContain('IAC-12');
    expect(cells[1].textContent).toContain('Accesos');
    expect(cells[2].textContent).toContain('Servicio s1');
    (el().querySelector('[data-attention] tbody tr') as HTMLElement).click();
    expect(nav).toHaveBeenCalledWith(['/cumplimiento', 'controles'], { queryParams: { servicio: 's1' } });
  });

  it('shows the worst status among the frameworks of a service, next to the service name', () => {
    setup('admin_empresa', { services: [service('s1', { frameworks: [framework({ readiness: 'ready', verdict: 'compliant' }), framework({ code: 'iso27001', name: 'ISO 27001', readiness: 'almost_ready', verdict: 'evaluating' })] })] });
    expect(q('[data-service="s1"] [data-overall][data-status]')!.getAttribute('data-status')).toBe('almost_ready');
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
  describe('the middle row: the service and the team', () => {
    const people = [
      person({ role: 'admin_empresa' }),
      person({ role: 'responsable', mfaEnabled: false }),
      person({ role: 'delegado', mfaEnabled: false }),
      person({ role: 'delegado', status: 'pending', mfaEnabled: false }),
      person({ role: 'auditor', status: 'inactive' }),
    ];
    const text = (s: string) => q(s)!.textContent!.trim();

    it('titles the service block in general terms, in its own region', () => {
      setup('admin_empresa', { services: [service('s1')] });
      expect(q('[data-services]')).not.toBeNull();
      expect(q('[data-middle-row] h2')!.textContent).toContain('HOME.DASHBOARD.STATUS_TITLE');
    });

    it('shows the team and the account security blocks to the administrator, with figures from the team list', () => {
      setup('admin_empresa', { services: [service('s1')] }, people);
      expect(team.loadAll).toHaveBeenCalledTimes(1);
      expect(text('[data-team-total]')).toBe('4');
      expect(text('[data-role="delegado"] [data-count]')).toBe('2');
      expect(text('[data-role="auditor"] [data-count]')).toBe('0');
      expect(text('[data-active]')).toBe('3');
      expect(text('[data-row="no-mfa"] [data-value]')).toBe('2');
      expect(text('[data-row="pending"] [data-value]')).toBe('1');
      expect(el().querySelectorAll('[data-access] [data-row]').length).toBe(5);
      expect(q('[data-row="admins"] [data-status]')).toBeNull();
      expect(q('[data-team] a')!.getAttribute('href')).toBe('/equipo/personas');
      expect(q('[data-access] a')!.getAttribute('href')).toBe('/equipo/personas');
    });

    it('does not ask for the team, nor show its blocks, to a role that cannot read the services', () => {
      setup('delegado', { services: [service('s1')] }, people);
      expect(team.loadAll).not.toHaveBeenCalled();
      expect(q('[data-team-block]')).toBeNull();
      expect(q('[data-access-block]')).toBeNull();
    });

    it('does not ask for the team (nor call /v1/users) to a role the menu does not give the team page: delegado, auditor and no role', () => {
      for (const role of ['delegado', 'auditor', 'unknown']) {
        TestBed.resetTestingModule();
        setup(role, { services: [service('s1')] }, people);
        expect(team.loadAll).not.toHaveBeenCalled();
        expect(fixture.componentInstance.canSeeTeam()).toBeFalse();
      }
    });

    it('also lets the responsable see the team page by the menu rule', () => {
      setup('responsable', { services: [service('s1')] }, people);
      expect(fixture.componentInstance.canSeeTeam()).toBeTrue();
    });

    it('warns with "partial summary" in both blocks when the list was cut, and does not warn when it was complete', () => {
      setup('admin_empresa', { services: [service('s1')] }, { members: people, partial: true });
      expect(el().querySelectorAll('[data-partial]').length).toBe(2);
      expect(q('[data-partial]')!.getAttribute('role')).toBe('status');
      expect(q('[data-partial]')!.textContent).toContain('HOME.TEAM.PARTIAL');
    });

    it('shows no partial warning for a complete list', () => {
      setup('admin_empresa', { services: [service('s1')] }, people);
      expect(q('[data-partial]')).toBeNull();
    });

    it('shows a loading state while the team arrives, and keeps the service block', () => {
      setup('admin_empresa', { services: [service('s1')] }, 'pending');
      expect(q('[data-team-block] [role="status"]')).not.toBeNull();
      expect(q('[data-access-block] [role="status"]')).not.toBeNull();
      expect(q('[data-services]')).not.toBeNull();
    });

    it('shows an error with retry in both team blocks when the list fails, and the service block is untouched', () => {
      setup('admin_empresa', { services: [service('s1')] }, 'error');
      expect(q('[data-team-error]')).not.toBeNull();
      expect(q('[data-access-error]')).not.toBeNull();
      expect(q('[data-services]')).not.toBeNull();
    });

    it('shows the empty state, without an icon, when nobody counts', () => {
      setup('admin_empresa', { services: [service('s1')] }, [person({ status: 'inactive' })]);
      expect(q('[data-team-empty]')).not.toBeNull();
      expect(q('[data-access-empty]')).not.toBeNull();
      expect(q('[data-team-empty] .material-symbols-rounded')).toBeNull();
    });

    it('pins the detail link of each block to the bottom of its card, with the same style', () => {
      setup('admin_empresa', { services: [service('s1')] }, people);
      const footers = ['[data-service] a', '[data-team] a', '[data-access] a'].map((s) => q(s)!.parentElement!);
      for (const f of footers) {
        expect(f.className).toContain('mt-auto');
        expect(f.className).toContain('border-t');
      }
      expect(new Set(footers.map((f) => f.className)).size).toBe(1);
    });

    it('says every active account is protected when none lacks a second factor', () => {
      setup('admin_empresa', { services: [service('s1')] }, [person({})]);
      expect(text('[data-row="no-mfa"] [data-value]')).toBe('0');
      expect(q('[data-row="no-mfa"] [data-status]')!.textContent).toContain('HOME.ACCESS.ALL_PROTECTED');
    });

    it('keeps a zero row visible with its state, and flags stale sign-ins and blocked accounts', () => {
      setup('admin_empresa', { services: [service('s1')] }, [person({ lastLoginAt: null }), person({ status: 'suspended' })]);
      expect(text('[data-row="pending"] [data-value]')).toBe('0');
      expect(q('[data-row="pending"] [data-status]')!.textContent).toContain('HOME.ACCESS.ALL_PROTECTED');
      expect(text('[data-row="stale"] [data-value]')).toBe('1');
      expect(q('[data-row="stale"] [data-status]')!.textContent).toContain('HOME.ACCESS.NEEDS_REVIEW');
      expect(text('[data-row="blocked"] [data-value]')).toBe('1');
    });
  });
});
