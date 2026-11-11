import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { throwError } from 'rxjs';
import { RiskService } from '@shared/domain/services/risk.service';
import { RiskListItem } from '@shared/domain/models/risk.models';
import { provideCatalogStub, provideRiskMatrixStub } from '@shared/testing/catalog-options';
import { RiskHeatmap } from './risk-heatmap';

const risk = (id: string, likelihood: number | null, impact: number | null, level: string | null): RiskListItem => ({
  id, code: id.toUpperCase(), name: `Riesgo ${id}`, trust_criterion: 'security', origin: 'catalog', is_active: true, likelihood, impact,
  inherent_risk_value: likelihood && impact ? likelihood * impact : null, inherent_risk_level: level, treatment: null, causes_count: 1,
});

describe('RiskHeatmap', () => {
  let fixture: ComponentFixture<RiskHeatmap>;

  function setup(risks: RiskListItem[]): void {
    TestBed.configureTestingModule({ imports: [RiskHeatmap], providers: [provideTranslateService(), provideRouter([]), provideCatalogStub(), provideRiskMatrixStub()] });
    fixture = TestBed.createComponent(RiskHeatmap);
    fixture.componentRef.setInput('risks', risks);
    fixture.componentRef.setInput('serviceId', 's1');
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const cell = (l: number, i: number) => el().querySelector<HTMLElement>(`[data-cell="${l}-${i}"]`)!;

  it('draws the scale the backend serves and counts the risks that fall in each cell', () => {
    setup([risk('r1', 4, 4, 'high'), risk('r2', 4, 4, 'high'), risk('r3', 5, 5, 'critical'), risk('r4', null, null, null)]);
    expect(el().querySelectorAll('[data-cell]').length).toBe(25);
    expect(cell(4, 4).getAttribute('data-count')).toBe('2');
    expect(cell(5, 5).getAttribute('data-count')).toBe('1');
    expect(cell(1, 1).getAttribute('data-count')).toBe('0');
  });

  it('is a heat map: every cell has the colour of its level, low the lightest and critical the strongest, even with no risks', () => {
    setup([]);
    expect(cell(1, 1).className).toContain('bg-risk-low-bg');
    expect(cell(2, 3).className).toContain('bg-risk-moderate-bg');
    expect(cell(4, 3).className).toContain('bg-risk-high-bg');
    expect(cell(5, 5).className).toContain('bg-risk-critical-bg');
  });

  it('shows the value of each empty cell (likelihood × impact), as the committee draws it', () => {
    setup([]);
    expect(cell(4, 4).textContent!.trim()).toBe('16');
    expect(cell(5, 5).textContent!.trim()).toBe('25');
    expect(cell(1, 1).textContent!.trim()).toBe('1');
  });

  it('an occupied cell takes the strong tone of its level and shows how many risks are in it', () => {
    setup([risk('r1', 5, 5, 'critical'), risk('r2', 1, 2, 'low')]);
    expect(cell(5, 5).className).toContain('text-risk-critical-on');
    expect(cell(5, 5).textContent!.trim()).toBe('1');
    expect(cell(1, 2).className).toContain('text-risk-low-on');
    expect(cell(5, 4).className).toContain('bg-risk-critical-bg');
  });

  it('if the matrix cannot be loaded it still shows the risks, with the level the server gave them, and the other cells stay neutral', () => {
    TestBed.configureTestingModule({
      imports: [RiskHeatmap],
      providers: [provideTranslateService(), provideRouter([]), provideCatalogStub(), { provide: RiskService, useValue: { matrix: () => throwError(() => new Error('x')) } }],
    });
    fixture = TestBed.createComponent(RiskHeatmap);
    fixture.componentRef.setInput('risks', [risk('r1', 5, 5, 'critical')]);
    fixture.componentRef.setInput('serviceId', 's1');
    fixture.detectChanges();
    expect(cell(5, 5).className).toContain('text-risk-critical-on');
    expect(cell(1, 1).className).toContain('bg-canvas');
    expect(cell(1, 1).textContent!.trim()).toBe('');
  });

  it('draws a legend with the four levels, from the lowest to the highest', () => {
    setup([]);
    expect(Array.from(el().querySelectorAll('[data-legend] li')).map((li) => li.textContent!.trim())).toEqual(['Bajo', 'Moderado', 'Alto', 'Crítico']);
  });

  it('says how many risks are evaluated and how many are not, without any average', () => {
    setup([risk('r1', 3, 3, 'moderate'), risk('r2', null, null, null), risk('r3', null, null, null)]);
    expect(el().querySelector('[data-evaluated]')!.textContent).toContain('COMPLIANCE.HEATMAP.EVALUATED');
    expect(el().querySelector('[data-not-evaluated]')!.textContent).toContain('COMPLIANCE.HEATMAP.NOT_EVALUATED');
    expect(el().textContent).not.toMatch(/promedio|average/i);
  });

  it('shows the highest level present, not the most common one', () => {
    setup([risk('r1', 1, 1, 'low'), risk('r2', 1, 2, 'low'), risk('r3', 4, 5, 'critical')]);
    expect(fixture.componentInstance.worstLevel()).toBe('critical');
  });

  it('with nothing evaluated it says so instead of drawing a green matrix', () => {
    setup([risk('r1', null, null, null)]);
    expect(el().querySelector('[data-heatmap-empty]')).not.toBeNull();
    expect(fixture.componentInstance.worstLevel()).toBeNull();
    expect(Array.from(el().querySelectorAll('[data-cell]')).every((c) => c.getAttribute('data-count') === '0')).toBeTrue();
  });

  it('a click on an occupied cell lists its risks, linked to the risk; an empty cell does nothing', () => {
    setup([risk('r1', 4, 4, 'high'), risk('r2', 4, 4, 'high'), risk('r3', 5, 5, 'critical')]);
    cell(1, 1).click();
    fixture.detectChanges();
    expect(el().querySelector('[data-picked-risks]')).toBeNull();
    cell(4, 4).click();
    fixture.detectChanges();
    const items = Array.from(el().querySelectorAll('[data-picked-risks] a'));
    expect(items.map((a) => a.textContent!.replace(/\s+/g, '').trim())).toEqual(['R1Riesgor1', 'R2Riesgor2']);
    expect(items[0].getAttribute('href')).toContain('/cumplimiento/riesgos');
    expect(items[0].getAttribute('href')).toContain('abrir=r1');
    cell(4, 4).click();
    fixture.detectChanges();
    expect(el().querySelector('[data-picked-risks]')).toBeNull();
  });
});
