import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { CatalogService } from '@shared/domain/services/catalog.service';
import { ControlDetailManagement, ManagementAction, ManagementManualTest } from '@features/compliance/domain/models/control.models';
import { ControlManualTests } from './control-manual-tests';

const ANA = { id: 'u1', name: 'Ana', last_name: 'Pérez' };
const test = (id: string, over: Partial<ManagementManualTest> = {}): ManagementManualTest => ({
  test: { id, code: `T-${id}`, display_name: `Prueba ${id}` }, requirement_id: 'r1', status: 'pending', accepts_evidence: true, latest_result: null, allowed_actions: [], ...over,
});

describe('ControlManualTests', () => {
  let fixture: ComponentFixture<ControlManualTests>;
  let el: HTMLElement;

  function setup(tests: ManagementManualTest[]): void {
    const options = () => of([{ value: 'observation', label: 'Observación' }]);
    TestBed.configureTestingModule({ imports: [ControlManualTests], providers: [provideTranslateService(), { provide: CatalogService, useValue: { options } }] });
    fixture = TestBed.createComponent(ControlManualTests);
    fixture.componentRef.setInput('management', { manual_tests: tests, requirements: [] } as Partial<ControlDetailManagement> as ControlDetailManagement);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  it('shows the code and the name of each test, and its latest result with who, when and the note', () => {
    setup([test('a', { latest_result: { result: 'observation', note: 'Falta una firma', registered_by: ANA, registered_at: '2026-11-20T10:00:00Z' } }), test('b')]);
    expect(el.textContent).toContain('T-a · Prueba a');
    expect(el.querySelector('[data-latest-result]')?.textContent).toContain('Observación');
    expect(el.querySelector('[data-latest-result]')?.textContent).toContain('Ana Pérez');
    expect(el.querySelector('[data-latest-result]')?.textContent).toContain('Falta una firma');
    expect(el.querySelectorAll('[data-no-result]').length).toBe(1);
  });

  it('shows the result as a status, who and when in one cut line, and a long note in two lines with Show more', () => {
    const note = 'n'.repeat(500);
    setup([test('a', { status: 'exception', allowed_actions: ['register_result'] as ManagementAction[], test: { id: 'a', code: 'T-a', display_name: 'Prueba '.repeat(30) }, latest_result: { result: 'exception', note, registered_by: ANA, registered_at: '2026-11-20T10:00:00Z' } })]);
    expect(el.querySelector('[data-latest-result] app-status-indicator')!.getAttribute('data-tone')).toBe('bad');
    const by = el.querySelector('[data-result-by]')!;
    expect(by.className).toContain('whitespace-nowrap');
    expect(by.className).toContain('truncate');
    expect(by.getAttribute('title')).toContain('Ana Pérez');
    const text = el.querySelector('[data-result-note] [data-expandable-text]')!;
    expect(text.className).toContain('line-clamp-2');
    expect(text.textContent).toContain(note);
    expect(el.querySelector('[data-register-result]')!.className).toContain('whitespace-nowrap');
    expect(el.querySelector('[data-test-name]')!.className).toContain('line-clamp-3');
  });

  it('has the action column and the button only when the server allowed registering', () => {
    setup([test('a', { allowed_actions: ['register_result'] as ManagementAction[] }), test('b')]);
    expect(el.querySelectorAll('[data-register-result]').length).toBe(1);
    let picked: ManagementManualTest | null = null;
    fixture.componentInstance.registerResult.subscribe((t) => (picked = t));
    el.querySelector<HTMLButtonElement>('[data-register-result]')!.click();
    expect(picked!.test.id).toBe('a');
  });

  it('has no register button when the server did not allow registering', () => {
    setup([test('c')]);
    expect(el.querySelector('[data-register-result]')).toBeNull();
  });

  it('says there are none when the control has no manual tests', () => {
    setup([]);
    expect(el.textContent).toContain('COMPLIANCE.APPROVAL.TESTS.NONE');
  });
});
