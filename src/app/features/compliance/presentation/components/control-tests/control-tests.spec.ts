import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { ControlDimensionDetail } from '@features/compliance/domain/models/control.models';
import { FindingService } from '@features/compliance/domain/services/finding.service';
import { ControlTest, ControlTests } from './control-tests';

const DIMENSIONS: ControlDimensionDetail[] = [
  { dimension: 'policy', applies: true, type: 'manual', reason_not_applicable: null },
  { dimension: 'server', applies: true, type: 'automated', reason_not_applicable: null },
];
const TESTS: ControlTest[] = [
  { test_id: 'id-srv-1', test_code: 'T-SRV-001', display_name: 'Evaluación de configuración de servidores', dimension: 'server', status: 'pending', accepts_evidence: false, evidence_fallback: false },
  { test_id: 'id-doc-2', test_code: 'T-DOC-002', display_name: 'Validación de la ejecución de la revisión', dimension: 'policy', status: 'pending', accepts_evidence: true, evidence_fallback: false },
  { test_id: 'id-doc-1', test_code: 'T-DOC-001', display_name: 'Revisión de diseño y vigencia de la política', dimension: 'policy', status: 'correct', accepts_evidence: true, evidence_fallback: false },
];

@Component({
  selector: 'app-host',
  imports: [ControlTests],
  template: `
    <app-control-tests [tests]="tests" [dimensions]="dimensions" [total]="3" [canUpload]="canUpload" [evidenceTpl]="upload" />
    <ng-template #upload let-dimension let-testId="testId" let-testCode="testCode"><button type="button" data-upload [attr.data-dimension]="dimension" [attr.data-test-id]="testId" [attr.data-test-code]="testCode">subir</button></ng-template>
  `,
})
class Host {
  tests = TESTS;
  dimensions = DIMENSIONS;
  canUpload = true;
}

describe('ControlTests intro', () => {
  it('shows one single intro under the title: how to upload for who can, what the tests verify for who cannot', () => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    const host = TestBed.createComponent(Host);
    host.detectChanges();
    const el = host.nativeElement as HTMLElement;
    expect(el.querySelectorAll('[data-evidence-help]').length).toBe(1);
    expect(el.querySelector('[data-evidence-help]')!.textContent).toContain('COMPLIANCE.EVIDENCE.TEST_NOTE');
    host.componentInstance.canUpload = false;
    host.changeDetectorRef.markForCheck();
    host.detectChanges();
    expect(el.querySelectorAll('[data-evidence-help]').length).toBe(1);
    expect(el.querySelector('[data-evidence-help]')!.textContent).toContain('COMPLIANCE.REQUIRES.INTRO');
  });
});

describe('ControlTests', () => {
  let fixture: ComponentFixture<ControlTests>;

  function render(tests: ControlTest[] | null | undefined, total = 3): HTMLElement {
    TestBed.configureTestingModule({ imports: [ControlTests], providers: [provideTranslateService({ fallbackLang: 'es' })] });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', {
      COMPLIANCE: {
        TEST_STATUS: { CORRECT: 'Cumple', EXCEPTION: 'No cumple', PENDING: 'Pendiente', NOT_APPLICABLE: 'No aplica' },
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
    expect(el.querySelector('[data-test-state="correct"]')!.textContent).toContain('Cumple');
    expect(el.querySelectorAll('tbody tr').length).toBe(3);
  });

  it('tells apart the manual tests from the automatic ones, by the type of their dimension', () => {
    const el = render(TESTS);
    const rows = Array.from(el.querySelectorAll('tbody tr')).map((li) => li.textContent ?? '');
    expect(rows.find((r) => r.includes('T-DOC-001'))).toContain('Manual');
    expect(rows.find((r) => r.includes('T-SRV-001'))).toContain('Automática');
  });

  it('shows a pending test as pending, not as a failure', () => {
    const el = render(TESTS);
    const none = el.querySelector('[data-test-state="pending"]')!;
    expect(none.textContent).toContain('Pendiente');
    expect(none.className).not.toContain('bg-red');
  });

  it('keeps the tests of the same dimension together and in order of code', () => {
    const el = render(TESTS);
    const codes = Array.from(el.querySelectorAll('tbody tr p app-tag')).map((s) => s.textContent!.trim());
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
    for (const s of slots) expect(s.closest('tr')!.textContent).toContain(s.getAttribute('data-test-code')!);
    expect(Array.from(el.querySelectorAll('tbody tr')).find((li) => li.textContent!.includes('T-SRV-001'))!.querySelector('[data-test-evidence]')).toBeNull();
  });

  it('offers what failed and how to fix it only under an automatic test that does not comply, and only when it knows the control (D90)', () => {
    const cloud: ControlTest = { test_id: 'id-cld-1', test_code: 'T-CLD-001', display_name: 'Acceso público', dimension: 'cloud', status: 'exception', accepts_evidence: false, evidence_fallback: false };
    const passing: ControlTest = { ...cloud, test_id: 'id-cld-2', test_code: 'T-CLD-002', status: 'correct', accepts_evidence: false, evidence_fallback: false };
    const withControl = (id: string | null, tests: ControlTest[] = [cloud, passing, TESTS[0]]) => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [ControlTests], providers: [provideTranslateService({ fallbackLang: 'es' }), { provide: FindingService, useValue: {} }] });
      fixture = TestBed.createComponent(ControlTests);
      fixture.componentRef.setInput('tests', tests);
      fixture.componentRef.setInput('dimensions', [...DIMENSIONS, { dimension: 'cloud', applies: true, type: 'automated', reason_not_applicable: null }]);
      fixture.componentRef.setInput('controlId', id);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };
    const el = withControl('c1');
    const rows = Array.from(el.querySelectorAll('tbody tr')).filter((li) => li.querySelector('app-test-findings'));
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('T-CLD-001');
    expect(withControl(null).querySelector('app-test-findings')).toBeNull();

    // D112 · Una prueba de servidores que no cumple también dice qué falló y cómo corregirlo; una documental no.
    const server: ControlTest = { test_id: 'id-srv-9', test_code: 'T-SRV-009', display_name: 'Configuración de servidores', dimension: 'server', status: 'exception', accepts_evidence: false, evidence_fallback: false };
    const manual: ControlTest = { test_id: 'id-doc-9', test_code: 'T-DOC-009', display_name: 'Revisión de política', dimension: 'policy', status: 'exception', accepts_evidence: true, evidence_fallback: false };
    const mixed = Array.from(withControl('c1', [server, manual]).querySelectorAll('tbody tr')).filter((li) => li.querySelector('app-test-findings'));
    expect(mixed.length).toBe(1);
    expect(mixed[0].textContent).toContain('T-SRV-009');
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

    it('does not offer «ver más» for a description that fits', () => {
      const el = render([{ ...TESTS[2], display_description: SHORT }]);
      expect(el.querySelector('[data-expandable-toggle]')).toBeNull();
    });

    it('hands a description to the shared expandable text, clamped to two lines (the link only appears if it is really cut, MD-499)', () => {
      const el = render([{ ...TESTS[2], display_description: LONG }]);
      const text = el.querySelector('[data-test-description] [data-expandable-text]')!;
      expect(text.textContent).toContain(LONG);
      expect(text.classList).toContain('line-clamp-2');
    });
  });

  it('gives every test the same two columns: its evidence, or how it is met when nothing is uploaded from here (MD-499)', () => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    const host = TestBed.createComponent(Host);
    host.componentInstance.tests = [...TESTS, { test_id: 'id-proc-1', test_code: 'T-ACT-2-01', display_name: 'Revisión trimestral', dimension: 'process', status: 'pending', accepts_evidence: false, evidence_fallback: false }];
    host.detectChanges();
    const el = host.nativeElement as HTMLElement;
    const row = (code: string) => Array.from(el.querySelectorAll<HTMLElement>('tbody tr')).find((r) => r.textContent!.includes(code))!;
    expect(row('T-DOC-001').querySelector('[data-aside="evidence"] [data-test-evidence]')).not.toBeNull();
    expect(row('T-SRV-001').querySelector('[data-aside="automated"] [data-test-how]')!.textContent).toContain('COMPLIANCE.TESTS.HOW_AUTOMATED');
    // Una prueba que no acepta evidencia no lleva subida: lo dice, con la misma caja.
    expect(row('T-ACT-2-01').querySelector('[data-aside="none"] [data-test-how]')!.textContent).toContain('COMPLIANCE.TESTS.HOW_NO_UPLOAD');
    // La instrucción de la evidencia, una sola vez.
    expect(el.querySelectorAll('[data-evidence-help]').length).toBe(1);
  });

  it('offers the upload only on tests that accept evidence, whatever their dimension (MD-499)', () => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    const host = TestBed.createComponent(Host);
    host.componentInstance.tests = [
      { test_id: 'id-cld-5', test_code: 'T-CLD-005', display_name: 'Respaldo', dimension: 'cloud', status: 'pending', accepts_evidence: true, evidence_fallback: true },
      { test_id: 'id-doc-5', test_code: 'T-DOC-005', display_name: 'Política', dimension: 'policy', status: 'pending', accepts_evidence: false, evidence_fallback: false },
    ];
    host.detectChanges();
    const el = host.nativeElement as HTMLElement;
    const row = (code: string) => Array.from(el.querySelectorAll<HTMLElement>('tbody tr')).find((r) => r.textContent!.includes(code))!;
    expect(row('T-CLD-005').querySelector('[data-aside="evidence"] [data-test-evidence]')).not.toBeNull();
    expect(row('T-DOC-005').querySelector('[data-test-evidence]')).toBeNull();
  });

  it('lists the evidence tests for a view without the technical detail (MD-499)', () => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    const fixture = TestBed.createComponent(ControlTests);
    fixture.componentRef.setInput('evidenceTests', [{ test_id: 'id-x', test_code: 'T-PRO-001', display_name: 'Revisión', dimension: 'process', status: 'pending', evidence_fallback: false, requirement_id: null }]);
    fixture.componentRef.setInput('evidenceTpl', null);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('T-PRO-001');
  });

  it('says how many tests the control has when the view does not bring the list', () => {
    const el = render(null, 3);
    expect(el.querySelectorAll('tbody tr').length).toBe(0);
    expect(el.textContent).toContain('COMPLIANCE.TESTS.COUNT_ONLY');
  });

  it('says so when the control has no tests', () => {
    const el = render([]);
    expect(el.textContent).toContain('COMPLIANCE.TESTS.NONE');
  });
});
