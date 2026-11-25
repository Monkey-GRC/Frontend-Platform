import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { NEVER } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { HomeDashboardService } from '@features/home/domain/services/dashboard.service';
import { Home } from './home';

// D89 · El onboarding es solo el contexto de la empresa. Declarar servicios y conectar activos ya no son pasos pendientes del onboarding.
describe('Home (D89)', () => {
  let fixture: ComponentFixture<Home>;

  function setup(nextStep: string | null, completed: string[] = [], role = 'admin_empresa'): Home {
    TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideTranslateService(), provideRouter([]), { provide: HomeDashboardService, useValue: { load: () => NEVER } }],
    });
    TestBed.inject(SessionService).set(
      { id: 'u1', email: 'a@x.com', name: 'Laura', last_name: null, role },
      { id: 'c1', name: 'ACME' },
      { next_step: nextStep, completed_steps: completed },
    );
    fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const el = () => fixture.nativeElement as HTMLElement;

  it('asks the company for its context while it is missing, and for nothing else', () => {
    const home = setup('organizational_context');
    expect(home.pendingCompanyContext()).toBeTrue();
    expect(home.onboarded()).toBeFalse();
    expect(el().querySelector('a[href="/onboarding"]')).not.toBeNull();
    expect(el().querySelector('app-page-header')).toBeNull(); // MD-499: sin encabezado visible; el título queda para lectores de pantalla
    expect(el().querySelector('h1.sr-only')!.textContent).toContain('PAGE_TITLE.HOME');
  });

  it('does not push a non-admin to the onboarding form: the notice says the admin completes it', () => {
    setup('organizational_context', [], 'auditor');
    expect(el().querySelector('a[href="/onboarding"]')).toBeNull();
    expect(el().querySelector('app-card')).not.toBeNull();
  });

  it('considers the onboarding finished once the company context is declared, even though the backend still lists the service and technical steps', () => {
    for (const next of ['service_context', 'technical_control', null]) {
      TestBed.resetTestingModule();
      const home = setup(next, ['organizational_context']);
      expect(home.onboarded()).toBeTrue();
      expect(home.pendingCompanyContext()).toBeFalse();
      expect(el().querySelector('h1.sr-only')!.textContent).toContain('PAGE_TITLE.HOME'); // MD-499: sin encabezado visible
      expect(el().querySelector('a[href="/onboarding"]')).toBeNull(); // sin tarjetas de «siguiente paso»
      expect(el().querySelector('a[href="/services/new"]')).toBeNull();
    }
  });

  it('sends the auditor straight to their compliance work, and the administrator does not see that card', () => {
    for (const role of ['auditor']) {
      TestBed.resetTestingModule();
      setup(null, [], role);
      expect(el().querySelector('[data-test-my-work]')).not.toBeNull();
      expect(el().querySelector('[data-test-my-work-link]')!.getAttribute('href')).toBe('/cumplimiento');
    }
    TestBed.resetTestingModule();
    setup(null, [], 'admin_empresa');
    expect(el().querySelector('[data-test-my-work]')).toBeNull();
  });
});
