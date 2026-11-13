import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { Finding, FindingsPage } from '@features/compliance/domain/models/finding.models';
import { FindingService } from '@features/compliance/domain/services/finding.service';
import { TestFindings } from './test-findings';

const finding = (id: string, patch: Partial<Finding> = {}): Finding => ({
  id,
  title: `Hallazgo ${id}`,
  severity: 'high',
  resources: [{ name: 'bucket-a', uid: 'arn:aws:s3:::bucket-a', region: 'us-east-1' }],
  resources_total: 1,
  remediation: { text: 'Activa **el bloqueo**.\n- Revisa los permisos', language: 'es', is_ai_generated: true },
  ...patch,
});
const page = (items: Finding[], total = items.length): FindingsPage => ({ test_id: 't1', measured_at: '2026-10-23T10:00:00Z', items, page: 1, page_size: 20, total, total_pages: 1 });

// D90 · Qué falló y cómo corregirlo, bajo una prueba técnica que no cumple.
describe('TestFindings (D90)', () => {
  let api: jasmine.SpyObj<FindingService>;
  let fixture: ComponentFixture<TestFindings>;

  function setup(result: ReturnType<FindingService['list']>): TestFindings {
    api = jasmine.createSpyObj<FindingService>('FindingService', ['list']);
    api.list.and.returnValue(result);
    TestBed.configureTestingModule({ imports: [TestFindings], providers: [provideTranslateService(), { provide: FindingService, useValue: api }] });
    fixture = TestBed.createComponent(TestFindings);
    fixture.componentRef.setInput('controlId', 'c1');
    fixture.componentRef.setInput('testId', 't1');
    fixture.detectChanges();
    return fixture.componentInstance;
  }
  const el = () => fixture.nativeElement as HTMLElement;
  const q = (s: string) => el().querySelector<HTMLElement>(s);
  const open = () => {
    q('[data-findings-toggle]')!.click();
    fixture.detectChanges();
  };

  it('does not ask for anything until the person opens it', () => {
    setup(of(page([])));
    expect(api.list).not.toHaveBeenCalled();
    open();
    expect(api.list).toHaveBeenCalledOnceWith('c1', 't1', 1);
  });

  it('shows each finding with its severity, its affected resources and the guidance as plain text', () => {
    setup(of(page([finding('a')])));
    open();
    expect(el().querySelectorAll('[data-finding]').length).toBe(1);
    expect(q('[data-finding]')!.textContent).toContain('Hallazgo a');
    expect(q('[data-finding]')!.textContent).toContain('bucket-a');
    const guide = q('[data-finding-remediation]')!.textContent!;
    expect(guide).toContain('Activa el bloqueo.'); // sin las marcas de formato
    expect(guide).not.toContain('**');
    expect(guide).toContain('Revisa los permisos');
  });

  it('shows a command in its own block, separate from the prose', () => {
    setup(of(page([finding('a', { remediation: { text: 'Ejecute:\n```\nsystemctl unmask tmp.mount\n```\nY reinicie.', language: 'es', is_ai_generated: true } })])));
    open();
    expect(q('[data-finding-code]')?.textContent).toBe('systemctl unmask tmp.mount');
    expect(q('[data-finding-remediation]')!.textContent).toContain('Y reinicie.');
  });

  it('says it was translated by AI when nobody has reviewed the translation', () => {
    setup(of(page([finding('a')])));
    open();
    expect(q('[data-finding-ai]')).not.toBeNull();
    expect(q('[data-finding-original]')).toBeNull();
  });

  it('says the guidance is the English original when there is no translation', () => {
    setup(of(page([finding('a', { remediation: { text: 'Block public access.', language: 'en', is_ai_generated: false } })])));
    open();
    expect(q('[data-finding-original]')).not.toBeNull();
    expect(q('[data-finding-ai]')).toBeNull();
  });

  it('does not invent guidance when the check has none', () => {
    setup(of(page([finding('a', { remediation: null })])));
    open();
    expect(q('[data-finding-no-guide]')).not.toBeNull();
  });

  it('shows five resources and lets the person see all of them', () => {
    const resources = Array.from({ length: 8 }, (_, i) => ({ name: `r${i}`, uid: `u${i}`, region: null }));
    setup(of(page([finding('a', { resources, resources_total: 8 })])));
    open();
    expect(el().querySelectorAll('[data-finding] ul li').length).toBe(5);
    el().querySelector<HTMLButtonElement>('[data-finding] button.text-xs')!.click();
    fixture.detectChanges();
    expect(el().querySelectorAll('[data-finding] ul li').length).toBe(8);
  });

  it('says so when the last assessment left nothing to fix', () => {
    setup(of(page([])));
    open();
    expect(q('[data-findings-empty]')).not.toBeNull();
  });

  it('offers to retry when loading fails', () => {
    const c = setup(throwError(() => new HttpErrorResponse({ status: 500 })));
    open();
    expect(q('[data-findings-error]')).not.toBeNull();
    api.list.and.returnValue(of(page([finding('a')])));
    c.load();
    fixture.detectChanges();
    expect(q('[data-finding]')).not.toBeNull();
  });

  // D112 · Los servidores: la sonda no califica sus checks, y lo afectado es un activo del cliente.
  describe('a server test', () => {
    const serverFinding = (id: string) => finding(id, { severity: null, resources: [{ name: 'srv-prod-01', uid: null, region: null }], resources_total: 1 });
    function openServer(items: Finding[]) {
      setup(of(page(items)));
      fixture.componentRef.setInput('dimension', 'server');
      fixture.detectChanges();
      open();
    }

    it('shows no severity level when there is none, and does not promise an order by severity', () => {
      openServer([serverFinding('a'), serverFinding('b')]);
      expect(q('[data-finding-severity]')).toBeNull();
      expect(el().textContent).toContain('SUMMARY_UNRANKED');
      expect(el().textContent).not.toContain('FINDINGS.SUMMARY"');
    });

    it('names the affected server and says it is an asset, not a resource', () => {
      openServer([serverFinding('a')]);
      expect(q('[data-finding]')!.textContent).toContain('srv-prod-01');
      expect(q('[data-finding]')!.textContent).toContain('AFFECTED_ASSETS');
    });

    it('keeps the severity chip and the order wording when the findings do come rated', () => {
      openServer([finding('a', { severity: 'low' })]);
      expect(q('[data-finding-severity]')).not.toBeNull();
      expect(el().textContent).not.toContain('SUMMARY_UNRANKED');
    });
  });

  it('still says «resources» for a cloud test', () => {
    setup(of(page([finding('a')])));
    open();
    expect(q('[data-finding]')!.textContent).toContain('FINDINGS.AFFECTED');
    expect(q('[data-finding]')!.textContent).not.toContain('AFFECTED_ASSETS');
  });

  it('asks for the next page when there are more findings', () => {
    setup(of(page([finding('a')], 2)));
    open();
    api.list.and.returnValue(of({ ...page([finding('b')], 2), page: 2 }));
    q('[data-findings-more]')!.click();
    fixture.detectChanges();
    expect(api.list).toHaveBeenCalledWith('c1', 't1', 2);
    expect(el().querySelectorAll('[data-finding]').length).toBe(2);
    expect(q('[data-findings-more]')).toBeNull();
  });
});