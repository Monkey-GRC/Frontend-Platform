import { CatalogService } from '@shared/domain/services/catalog.service';
import { of } from 'rxjs';
import { provideCatalogStub, provideRiskMatrixStub } from '@shared/testing/catalog-options';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { MatrixCell, MatrixPosition, RiskMatrix } from './risk-matrix';

describe('RiskMatrix', () => {
  let fixture: ComponentFixture<RiskMatrix>;
  let picked: MatrixCell[];

  function setup(inputs: { editable?: boolean; disabled?: boolean; selected?: MatrixCell | null; saved?: MatrixPosition | null } = {}): void {
    TestBed.configureTestingModule({ imports: [RiskMatrix], providers: [provideCatalogStub(), provideRiskMatrixStub(), provideTranslateService({ fallbackLang: 'es' })] });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', { COMPLIANCE: { RISK_ASSESSMENT: { CELL_ARIA: 'Probabilidad {{likelihood}}, impacto {{impact}}' } } });
    translate.use('es');
    fixture = TestBed.createComponent(RiskMatrix);
    for (const [name, value] of Object.entries({ editable: false, disabled: false, selected: null, saved: null, ...inputs })) fixture.componentRef.setInput(name, value);
    picked = [];
    fixture.componentInstance.picked.subscribe((c) => picked.push(c));
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const cell = (l: number, i: number) => el().querySelector<HTMLElement>(`[data-cell="${l}-${i}"]`)!;
  const keydown = (target: HTMLElement, key: string) => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  };

  it('takes its size from the scale that the backend serves: a scale of 3 draws 9 cells, not 25', () => {
    TestBed.configureTestingModule({
      imports: [RiskMatrix],
      providers: [provideTranslateService(), provideRiskMatrixStub(), { provide: CatalogService, useValue: { options: () => of(['1', '2', '3'].map((v) => ({ value: v, label: v }))) } }],
    });
    fixture = TestBed.createComponent(RiskMatrix);
    fixture.detectChanges();
    expect(el().querySelectorAll('[data-cell]').length).toBe(9);
    expect(el().querySelector('[data-cell="3-1"]')).not.toBeNull();
    expect(el().querySelector('[data-cell="5-5"]')).toBeNull();
  });

  it('draws the 25 cells with the likelihood going up and the impact going to the right', () => {
    setup();
    const cells = Array.from(el().querySelectorAll('[data-cell]')).map((c) => c.getAttribute('data-cell'));
    expect(cells.length).toBe(25);
    expect(cells[0]).toBe('5-1');
    expect(cells[4]).toBe('5-5');
    expect(cells[24]).toBe('1-5');
  });

  it('is read-only by default: the cells are not buttons and nothing can be picked', () => {
    setup({ saved: { likelihood: 2, impact: 3, level: 'moderate' } });
    expect(el().querySelector('button')).toBeNull();
    cell(2, 3).click();
    expect(picked).toEqual([]);
  });

  it('marks the saved cell and paints it with the strong tone of the level of the server, and only that cell', () => {
    setup({ saved: { likelihood: 5, impact: 4, level: 'critical' } });
    expect(cell(5, 4).getAttribute('aria-current')).toBe('true');
    expect(cell(5, 4).className).toContain('text-risk-critical-on');
    expect(el().querySelectorAll('[aria-current="true"]').length).toBe(1);
    expect(cell(1, 1).className).not.toContain('text-risk-critical-on');
  });

  it('paints every cell as a heat map, from green to red, with the level that the backend gives each one', () => {
    setup();
    expect(cell(1, 1).className).toContain('bg-risk-low-bg'); // 1 → Bajo
    expect(cell(2, 3).className).toContain('bg-risk-moderate-bg'); // 6 → Moderado
    expect(cell(4, 3).className).toContain('bg-risk-high-bg'); // 12 → Alto
    expect(cell(5, 5).className).toContain('bg-risk-critical-bg'); // 25 → Crítico
  });

  it('paints a saved cell of an unknown level neutral, not as a failure', () => {
    setup({ saved: { likelihood: 1, impact: 1, level: null } });
    expect(cell(1, 1).className).not.toContain('risk-critical');
    expect(cell(1, 1).className).toContain('bg-neutral');
  });

  it('picks the cell that is clicked when it is editable, and tells which one', () => {
    setup({ editable: true });
    cell(3, 4).click();
    expect(picked).toEqual([{ likelihood: 3, impact: 4 }]);
  });

  it('marks the chosen cell as pressed and gives every cell an accessible name with its values', () => {
    setup({ editable: true, selected: { likelihood: 2, impact: 5 } });
    expect(cell(2, 5).getAttribute('aria-pressed')).toBe('true');
    expect(cell(2, 4).getAttribute('aria-pressed')).toBe('false');
    expect(cell(4, 1).getAttribute('aria-label')).toBe('Probabilidad 4, impacto 1');
  });

  it('does not pick anything while it is disabled', () => {
    setup({ editable: true, disabled: true });
    cell(3, 3).click();
    expect(picked).toEqual([]);
    expect(cell(3, 3).hasAttribute('disabled')).toBeTrue();
  });

  it('has a single tab stop: the chosen cell, or the saved one, or the middle', () => {
    setup({ editable: true, selected: { likelihood: 2, impact: 2 } });
    const stops = Array.from(el().querySelectorAll('[data-cell][tabindex="0"]')).map((c) => c.getAttribute('data-cell'));
    expect(stops).toEqual(['2-2']);
    TestBed.resetTestingModule();
    setup({ editable: true });
    expect(Array.from(el().querySelectorAll('[data-cell][tabindex="0"]')).map((c) => c.getAttribute('data-cell'))).toEqual(['3-3']);
  });

  it('moves the focus with the arrows, up for more likelihood and right for more impact, and stops at the edges', async () => {
    setup({ editable: true });
    document.body.appendChild(el());
    keydown(cell(3, 3), 'ArrowUp');
    await Promise.resolve();
    expect(document.activeElement).toBe(cell(4, 3));
    keydown(cell(4, 3), 'ArrowRight');
    await Promise.resolve();
    expect(document.activeElement).toBe(cell(4, 4));
    keydown(cell(4, 4), 'ArrowDown');
    await Promise.resolve();
    expect(document.activeElement).toBe(cell(3, 4));
    keydown(cell(1, 1), 'ArrowDown');
    keydown(cell(1, 1), 'ArrowLeft');
    await Promise.resolve();
    expect(document.activeElement).toBe(cell(1, 1));
    el().remove();
  });
});
