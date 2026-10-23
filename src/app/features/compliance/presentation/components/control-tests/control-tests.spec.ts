import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { ControlDimensionDetail } from '../../../domain/models/control.models';
import { ControlTest, ControlTests } from './control-tests';

const DIMENSIONS: ControlDimensionDetail[] = [
  { dimension: 'policy', applies: true, type: 'manual', reason_not_applicable: null },
  { dimension: 'server', applies: true, type: 'automated', reason_not_applicable: null },
];
const TESTS: ControlTest[] = [
  { test_id: 'id-srv-1', test_code: 'T-SRV-001', display_name: 'Evaluación de configuración de servidores', dimension: 'server', state: 'no_assets' },
  { test_id: 'id-doc-2', test_code: 'T-DOC-002', display_name: 'Validación de la ejecución de la revisión', dimension: 'policy', state: 'pending' },
  { test_id: 'id-doc-1', test_code: 'T-DOC-001', display_name: 'Revisión de diseño y vigencia de la política', dimension: 'policy', state: 'compliant' },
];

@Component({
  selector: 'app-host',
  imports: [ControlTests],
  template: `
    <app-control-tests [tests]="tests" [dimensions]="dimensions" [total]="3" [evidenceTpl]="upload" />
    <ng-template #upload let-dimension let-testId="testId" let-testCode="testCode"><button type="button" data-upload [attr.data-dimension]="dimension" [attr.data-test-id]="testId" [attr.data-test-code]="testCode">subir</button></ng-template>
  `,
})
class Host {
  tests = TESTS;
  dimensions = DIMENSIONS;
}

describe('ControlTests', () => {
  let fixture: ComponentFixture<ControlTests>;

  function render(tests: ControlTest[] | null | undefined, total = 3): HTMLElement {
    TestBed.configureTestingModule({ imports: [ControlTests], providers: [provideTranslateService({ fallbackLang: 'es' })] });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', {
      COMPLIANCE: {
        TEST_STATE: { COMPLIANT: 'Cumple', NON_COMPLIANT: 'No cumple', PENDING: 'Pendiente', NO_ASSETS: 'Sin activos' },
        CONTROL_TYPE: { MANUAL: 'Manual', AUTOMATED: 'Automática' },
        DIMENSION: { POLICY: 'Política / Documental', SERVER: 'Servidor' },
      },
    });
    translate.use('es');
    fixture = TestBed.createComponent(ControlTests);
    fixture.componentRef.setInput('tests', tests);
    fixture.componentRef.setInput('dimensions', DIMENSIONS);
    fixture.componentRef.setInput('total', total);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists every test of the control with its code, its neutral name and whether it passes', () => {
    const el = render(TESTS);
    expect(el.textContent).toContain('T-DOC-001');
    expect(el.textContent).toContain('Revisión de diseño y vigencia de la política');
    expect(el.querySelector('[data-test-state="compliant"]')!.textContent).toContain('Cumple');
    expect(el.querySelectorAll('li').length).toBe(3);
  });

  it('tells apart the manual tests from the automatic ones, by the type of their dimension', () => {
    const el = render(TESTS);
    const rows = Array.from(el.querySelectorAll('li')).map((li) => li.textContent ?? '');
    expect(rows.find((r) => r.includes('T-DOC-001'))).toContain('Manual');
    expect(rows.find((r) => r.includes('T-SRV-001'))).toContain('Automática');
  });

  it('shows a test with no connected assets as such, not as a failure', () => {
    const el = render(TESTS);
    const none = el.querySelector('[data-test-state="no_assets"]')!;
    expect(none.textContent).toContain('Sin activos');
    expect(none.className).not.toContain('bg-red');
  });

  it('keeps the tests of the same dimension together and in order of code', () => {
    const el = render(TESTS);
    const codes = Array.from(el.querySelectorAll('li p span.font-mono')).map((s) => s.textContent!.trim());
    expect(codes).toEqual(['T-DOC-001', 'T-DOC-002', 'T-SRV-001']);
  });

  it('offers the evidence under EACH manual test, with the id and the code of that test, and never under the automatic ones (D88)', () => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService({ fallbackLang: 'es' })] });
    const host = TestBed.createComponent(Host);
    host.detectChanges();
    const el = host.nativeElement as HTMLElement;
    const slots = Array.from(el.querySelectorAll('[data-test-evidence] [data-upload]'));
    expect(slots.map((s) => s.getAttribute('data-test-code'))).toEqual(['T-DOC-001', 'T-DOC-002']);
    expect(slots.map((s) => s.getAttribute('data-test-id'))).toEqual(['id-doc-1', 'id-doc-2']);
    for (const s of slots) expect(s.getAttribute('data-dimension')).toBe('policy');
    // cada espacio queda dentro de la fila de SU prueba
    for (const s of slots) expect(s.closest('li')!.textContent).toContain(s.getAttribute('data-test-code')!);
    expect(Array.from(el.querySelectorAll('li')).find((li) => li.textContent!.includes('T-SRV-001'))!.querySelector('[data-test-evidence]')).toBeNull();
  });

  describe('short description', () => {
    const SHORT = 'Verifica que existe una política vigente.';
    const LONG = 'Verificar que los servidores en alcance cumplen la línea base de configuración segura definida, comprobándola de forma automática sobre el 100% de los servidores y dejando constancia de las desviaciones.';

    it('shows the description under the name of each test that has one', () => {
      const el = render([{ ...TESTS[2], display_description: SHORT }, TESTS[1]]);
      const descriptions = el.querySelectorAll('[data-test-description]');
      expect(descriptions.length).toBe(1);
      expect(descriptions[0].textContent).toContain(SHORT);
    });

    it('does not offer "show more" for a short description', () => {
      const el = render([{ ...TESTS[2], display_description: SHORT }]);
      expect(el.querySelector('button')).toBeNull();
    });

    it('clamps a long description and expands it on demand', () => {
      const el = render([{ ...TESTS[2], display_description: LONG }]);
      const text = el.querySelector('[data-test-description]')!;
      const button = el.querySelector('button')!;
      expect(text.classList).toContain('line-clamp-2');
      expect(button.getAttribute('aria-expanded')).toBe('false');
      button.click();
      fixture.detectChanges();
      expect(text.classList).not.toContain('line-clamp-2');
      expect(button.getAttribute('aria-expanded')).toBe('true');
    });
  });

  it('says how many tests the control has when the view does not bring the list', () => {
    const el = render(null, 3);
    expect(el.querySelectorAll('li').length).toBe(0);
    expect(el.textContent).toContain('COMPLIANCE.TESTS.COUNT_ONLY');
  });

  it('says so when the control has no tests', () => {
    const el = render([]);
    expect(el.textContent).toContain('COMPLIANCE.TESTS.NONE');
  });
});
