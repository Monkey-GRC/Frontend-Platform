import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { ControlTechnical } from '@features/compliance/domain/models/control.models';
import { readinessLook } from '@shared/domain/utils/readiness-look';
import { ControlScore } from './control-score';

const TECH: ControlTechnical = { points_of_focus: [], level: 'partial', level_value: 3, complies: false, c_percent: 60 };

describe('ControlScore', () => {
  let fixture: ComponentFixture<ControlScore>;
  const el = () => fixture.nativeElement as HTMLElement;

  function render(technical: ControlTechnical | null, done = 3, total = 5): void {
    TestBed.configureTestingModule({ imports: [ControlScore], providers: [provideTranslateService({ fallbackLang: 'es' })] });
    fixture = TestBed.createComponent(ControlScore);
    fixture.componentRef.setInput('look', readinessLook('needs_work'));
    fixture.componentRef.setInput('progress', { done, total });
    fixture.componentRef.setInput('coverage', { measured: 4, applicable: 5 });
    fixture.componentRef.setInput('technical', technical);
    fixture.detectChanges();
  }

  it('en la vista técnica junta el C%, el estado, el nivel 0–5 y la cobertura', () => {
    render(TECH);
    expect(el().querySelector('app-donut')?.getAttribute('aria-label')).toBeTruthy();
    expect(el().querySelector('[data-status]')).not.toBeNull();
    expect(el().querySelector('[data-test-level]')).not.toBeNull();
    expect(el().querySelectorAll('[data-test-level] li').length).toBe(6);
    expect(el().querySelector('[data-test-level] li[data-current="true"]')).not.toBeNull();
  });

  it('en la vista de negocio no muestra nivel', () => {
    render(null);
    expect(el().querySelector('[data-test-level]')).toBeNull();
    expect(el().querySelector('[data-status]')).not.toBeNull();
  });

  it('reparte la cabecera en 3 columnas en la vista técnica y 2 en la de negocio, sin una columna de requisitos que repita el avance', () => {
    render(TECH);
    const cells = Array.from(el().querySelectorAll<HTMLElement>('[data-score-cell]')).map((c) => c.getAttribute('data-score-cell'));
    expect(cells).toEqual(['status', 'level', 'coverage']);
    expect(el().querySelector('[data-score-cell="status"] [data-test-requirements]')!.textContent).toContain('COMPLIANCE.SCORE.REQUIREMENTS_MET');
    TestBed.resetTestingModule();
    render(null);
    expect(el().querySelectorAll('[data-score-cell]').length).toBe(2);
    expect(Array.from(el().querySelectorAll('[data-score-cell]')).map((c) => c.getAttribute('data-score-cell'))).toEqual(['status', 'coverage']);
  });

  it('dice el próximo cierre de ventana de sus requisitos, si lo hay', () => {
    const later = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
    render({ ...TECH, requirements: [{ id: 'r1', code: 'R-1', text: 'x', type: 'operational', periodicity: 'monthly', status: 'pending', tests: [{ test_id: 't', test_code: 'T-1', display_name: 'x', status: 'pending', window_end: later, alert_at: null, checks: null, asset_coverage: null, accepts_evidence: false, evidence_fallback: false, check_links: [] }] }] });
    expect(el().querySelector('[data-test-next-window]')).not.toBeNull();
    TestBed.resetTestingModule();
    render(TECH);
    expect(el().querySelector('[data-test-next-window]')).toBeNull();
  });

  it('sin requisitos aplicables deja la dona vacía y lo dice', () => {
    render(TECH, 0, 0);
    expect(el().querySelector('[data-test-no-requirements]')).not.toBeNull();
  });

  it('sin medir no inventa un porcentaje: la dona dice «—» aunque haya requisitos (0 de 3), y el detalle sigue diciendo cuántos cumplen', () => {
    render(TECH, 0, 3);
    fixture.componentRef.setInput('look', readinessLook('not_measured'));
    fixture.detectChanges();
    const donut = el().querySelector('app-donut')!;
    expect(donut.querySelector('[data-donut-empty]')!.textContent!.trim()).toBe('—');
    expect(donut.textContent).not.toContain('0');
    expect(el().querySelector('[data-test-requirements]')).not.toBeNull();
    expect(el().querySelector('[data-test-no-requirements]')).toBeNull();
  });
});
