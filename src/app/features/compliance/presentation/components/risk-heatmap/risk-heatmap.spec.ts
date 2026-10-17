import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { RiskListItem } from '../../../domain/models/risk.models';
import { provideCatalogStub } from '../../../testing/catalog-options';
import { RiskHeatmap } from './risk-heatmap';

const risk = (id: string, likelihood: number | null, impact: number | null, level: string | null): RiskListItem => ({
  id, code: id.toUpperCase(), name: `Riesgo ${id}`, trust_criterion: 'security', origin: 'catalog', is_active: true, likelihood, impact,
  inherent_risk_value: likelihood && impact ? likelihood * impact : null, inherent_risk_level: level, treatment: null, causes_count: 1,
});

describe('RiskHeatmap', () => {
  let fixture: ComponentFixture<RiskHeatmap>;

  function setup(risks: RiskListItem[]): void {
    TestBed.configureTestingModule({ imports: [RiskHeatmap], providers: [provideTranslateService(), provideRouter([]), provideCatalogStub()] });
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

  it('colours an occupied cell with the level the server gave its risks, and leaves the empty ones neutral', () => {
    setup([risk('r1', 5, 5, 'critical')]);
    expect(cell(5, 5).className).toContain('red');
    expect(cell(1, 1).className).not.toContain('red');
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
    expect(items[0].getAttribute('href')).toContain('/services/s1/cumplimiento/riesgos');
    expect(items[0].getAttribute('href')).toContain('abrir=r1');
    cell(4, 4).click();
    fixture.detectChanges();
    expect(el().querySelector('[data-picked-risks]')).toBeNull();
  });
});
