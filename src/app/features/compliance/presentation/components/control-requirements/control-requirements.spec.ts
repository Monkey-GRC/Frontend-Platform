import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { ControlTechnical } from '@features/compliance/domain/models/control.models';
import { ControlRequirements } from './control-requirements';

const TECH: ControlTechnical = {
  points_of_focus: [],
  
  
  level: 'partial',
  level_value: 3,
  complies: false,
  c_percent: 50,
  requirements: [
    {
      id: 'r1', code: 'IAC-12-L2', text: 'Los accesos se revisan.', type: 'operational', periodicity: 'quarterly', periodicity_source: 'client', suggested_periodicity: 'monthly', status: 'non_compliant',
      tests: [
        {
          test_id: 't1', test_code: 'T-IAC-12-01', display_name: 'MFA', status: 'exception', accepts_evidence: false, evidence_fallback: false, window_end: '2026-12-31', alert_at: null,
          checks: { direct_pass: 3, direct_fail: 1, direct_exception: 0, no_data: 0, complementary_fail: 0 }, asset_coverage: { with_result: 4, in_scope: 4 },
          check_links: [
            { role: 'dependency', kind: 'check', check: { id: 'c2', title: 'Bloqueo de cuenta' }, module: null, failing_assets: null, owner: { control_id: 'x', control_code: 'IAC-15', test_status: 'correct' } },
            { role: 'direct', kind: 'check', check: { id: 'c1', title: 'MFA habilitada' }, module: null, failing_assets: null, owner: null },
            { role: 'complementary', kind: 'check', check: { id: 'c3', title: 'Registro' }, module: null, failing_assets: 2, owner: null },
          ],
        },
        { test_id: 't2', test_code: 'T-IAC-12-02', display_name: 'Revisión manual', status: 'pending', accepts_evidence: true, evidence_fallback: true, window_end: null, alert_at: null, checks: null, asset_coverage: null, check_links: [] },
      ],
    },
    { id: 'r2', code: 'IAC-12-L3', text: 'Otro.', type: 'operational', periodicity: 'annual', status: 'compliant', tests: [] },
  ],
  period: { level: 'weak', complies: false, windows: { total: 4, with_evidence: 3 }, missing: [{ requirement_code: 'IAC-12-L2', window_start: '2026-07-01', window_end: '2026-09-30' }] },
};

describe('ControlRequirements', () => {
  let fixture: ComponentFixture<ControlRequirements>;
  const el = () => fixture.nativeElement as HTMLElement;

  function render(tech: ControlTechnical): void {
    fixture = TestBed.createComponent(ControlRequirements);
    fixture.componentRef.setInput('technical', tech);
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [ControlRequirements], providers: [provideTranslateService({ fallbackLang: 'es' })] }));

  it('muestra cada requisito con su código y su estado', () => {
    render(TECH);
    expect(el().querySelector('[data-requirement="IAC-12-L2"]')?.getAttribute('data-status')).toBe('non_compliant');
    expect(el().querySelector('[data-requirement="IAC-12-L3"]')?.getAttribute('data-status')).toBe('compliant');
  });

  it('agrupa los checks por rol, Directo antes que Dependencia, con el control dueño', () => {
    render(TECH);
    const roles = Array.from(el().querySelectorAll('[data-test="T-IAC-12-01"] [data-role]')).map((n) => n.getAttribute('data-role'));
    expect(roles).toEqual(['direct', 'complementary', 'dependency']);
    expect(el().querySelector('[data-role="dependency"]')?.textContent).toContain('IAC-15');
  });

  it('el resultado de los Directos sale una vez por prueba y el Complementario dice cuántos activos fallan', () => {
    render(TECH);
    expect(el().querySelectorAll('[data-test="T-IAC-12-01"] [data-direct-summary]').length).toBe(1);
    expect(el().querySelector('[data-role="complementary"]')?.textContent).toContain('REQS.FAILING_ASSETS');
  });

  it('una prueba manual no trae grupos de checks', () => {
    render(TECH);
    expect(el().querySelectorAll('[data-test="T-IAC-12-02"] [data-role]').length).toBe(0);
  });
});
