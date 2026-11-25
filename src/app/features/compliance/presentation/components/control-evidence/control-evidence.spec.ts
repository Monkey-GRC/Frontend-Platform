import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { NEVER, Subject, of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { ControlEvidence as Summary } from '@features/compliance/domain/models/control.models';
import { EvidenceRequirement, EvidenceSubmission } from '@features/compliance/domain/models/evidence.models';
import { EvidenceService } from '@features/compliance/domain/services/evidence.service';
import { ControlEvidence } from './control-evidence';
import { ToastService } from '@shared/presentation/components/toast-container/toast.service';

const toastText = (): string => TestBed.inject(ToastService).toasts().map((t) => `${t.title} ${t.message}`).join(' | ');

const person = { id: 'u1', name: 'Laura', last_name: 'Gómez' };
const submission = (version: number, state: EvidenceSubmission['evidence_state'] = 'pending'): EvidenceSubmission => ({
  id: `s${version}`, version, file_name: `politica-v${version}.pdf`, file_type: 'application/pdf', file_size: 482113, integrity_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  submitted_by: person, submitted_at: '2026-10-14T17:05:12Z', evidence_state: state, ai: null,
});
const requirement = (id: string, submissions: EvidenceSubmission[] = []): EvidenceRequirement => ({
  id, code: `EV-${id}`, sequence: 1, description: `Documento ${id}`, dimension: 'policy', test: null, validity_within_period: 'Dentro del período de evaluación', origin: 'catalog',
  responsible: { id: 'r1', type: 'compliance', person_name: 'Marta Ruiz' }, submissions,
});
const SUMMARY: Summary[] = [{ requirement_id: 'e9', description: 'Política de accesos', responsible: null, latest_submission: { id: 's1', version: 2, evidence_state: 'pending' } }];

describe('ControlEvidence', () => {
  let api: jasmine.SpyObj<EvidenceService>;
  let fixture: ComponentFixture<ControlEvidence>;

  function setup(role: string, canUpload: boolean, items: EvidenceRequirement[] | 'missing' | 'down' = [requirement('e1', [submission(2), submission(1)]), requirement('e2')]): ControlEvidence {
    api = jasmine.createSpyObj<EvidenceService>('EvidenceService', ['list', 'listForTest', 'upload', 'download', 'uploadForTest']);
    api.list.and.returnValue(items === 'missing' ? throwError(() => new HttpErrorResponse({ status: 404 })) : items === 'down' ? throwError(() => new HttpErrorResponse({ status: 500 })) : of(items));
    TestBed.configureTestingModule({ imports: [ControlEvidence], providers: [provideTranslateService(), { provide: EvidenceService, useValue: api }] });
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(ControlEvidence);
    fixture.componentRef.setInput('controlId', 'c1');
    fixture.componentRef.setInput('summary', SUMMARY);
    fixture.componentRef.setInput('canUpload', canUpload);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('shows each required evidence with its code, its responsible and the delivered one with its version and status', () => {
    setup('admin_empresa', true);
    expect(text()).toContain('EV-e1');
    expect(text()).toContain('Documento e1');
    expect(text()).toContain('politica-v2.pdf');
    expect(text()).toContain('COMPLIANCE.EVIDENCE.NOT_DELIVERED');
    expect(fixture.nativeElement.querySelector('[data-validation="pending"]')).not.toBeNull();
  });

  it('keeps only the evidence of the dimension it is embedded for, without its own title', () => {
    setup('admin_empresa', true, [requirement('e1'), { ...requirement('e2'), dimension: 'server' }]);
    fixture.componentRef.setInput('dimension', 'policy');
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    expect(text()).toContain('Documento e1');
    expect(text()).not.toContain('Documento e2');
    expect(fixture.nativeElement.querySelector('h4')).toBeNull();
  });

  it('shows only the latest version and the previous ones when asked, the latest first', () => {
    const view = setup('admin_empresa', true);
    expect(text()).not.toContain('politica-v1.pdf');
    view.toggleVersions('e1');
    fixture.detectChanges();
    expect(text()).toContain('politica-v1.pdf');
  });

  it('shows the state the server derived from the review, and offers no way to approve or reject (D84)', () => {
    setup('admin_empresa', true, [requirement('e1', [submission(1, 'non_compliant')])]);
    expect(fixture.nativeElement.querySelector('[data-validation="non_compliant"]')).not.toBeNull();
    expect(text()).not.toContain('COMPLIANCE.EVIDENCE.APPROVE');
    expect(text()).not.toContain('COMPLIANCE.EVIDENCE.REJECT');
  });

  it('offers to upload only to the roles that can, and "new version" when there is already one', () => {
    setup('admin_empresa', true);
    expect(text()).toContain('COMPLIANCE.EVIDENCE.UPLOAD_NEW');
    expect(text()).toContain('COMPLIANCE.EVIDENCE.UPLOAD');
    TestBed.resetTestingModule();
    setup('auditor', false);
    expect(text()).not.toContain('COMPLIANCE.EVIDENCE.UPLOAD');
  });

  it('uploads the chosen file to the requirement, reloads the evidence and tells the drawer the control changed', () => {
    const view = setup('admin_empresa', true);
    api.upload.and.returnValue(of(submission(3)));
    let changed = 0;
    view.changed.subscribe(() => changed++);
    const file = new File(['x'], 'acta.pdf', { type: 'application/pdf' });

    view.startUpload('e2');
    view.file.set(file);
    view.send();

    expect(api.upload).toHaveBeenCalledWith('e2', file);
    expect(view.uploadingFor()).toBeNull();
    expect(toastText()).toContain('COMPLIANCE.EVIDENCE.UPLOADED');
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(changed).toBe(1);
  });

  it('does not send without a file and keeps the message of the backend when the upload fails', () => {
    const view = setup('admin_empresa', true);
    view.startUpload('e2');
    view.send();
    expect(api.upload).not.toHaveBeenCalled();

    api.upload.and.returnValue(throwError(() => new HttpErrorResponse({ status: 415, error: { message: 'Ese tipo de archivo no está permitido.', error: { code: 'UNSUPPORTED_MEDIA_TYPE' } } })));
    view.file.set(new File(['x'], 'raro.exe'));
    view.send();
    expect(view.error()).toBe('Ese tipo de archivo no está permitido.');
    expect(view.uploadingFor()).toBe('e2');
  });

  it('falls back to the summary of the control, with no upload, while the backend has no evidence endpoint', () => {
    const view = setup('admin_empresa', true, 'missing');
    expect(view.stage()).toBe('summary');
    expect(text()).toContain('Política de accesos');
    expect(text()).toContain('COMPLIANCE.EVIDENCE.SUMMARY_NOTE');
    expect(text()).not.toContain('COMPLIANCE.EVIDENCE.UPLOAD');
  });

  it('shows a real error with a retry for any other failure', () => {
    const view = setup('admin_empresa', true, 'down');
    expect(view.stage()).toBe('error');
    expect(text()).toContain('COMPLIANCE.EVIDENCE.LOAD_ERROR');
  });

  it('asks for a temporary link and opens it to download, without exposing a permanent url', () => {
    const view = setup('admin_empresa', true);
    api.download.and.returnValue(of({ url: 'https://storage/x', file_name: 'a.pdf', expires_in: 300 }));
    const open = spyOn(window, 'open');
    view.download(submission(2));
    expect(api.download).toHaveBeenCalledWith('s2', 'attachment');
    expect(open).toHaveBeenCalledWith('https://storage/x', '_blank', 'noopener');
  });

  describe('viewing the evidence on screen (MD-178)', () => {
    const link = (url: string) => of({ url, file_name: 'a.pdf', file_type: 'application/pdf', disposition: 'inline' as const, expires_in: 300 });
    const asType = (s: EvidenceSubmission, file_type: string): EvidenceSubmission => ({ ...s, file_type });
    const q = (selector: string) => fixture.nativeElement.querySelector(selector) as HTMLElement | null;

    it('offers "view" only for PDF, PNG and JPG; a Word or Excel file can only be downloaded', () => {
      setup('admin_empresa', true, [requirement('e1', [asType(submission(1), 'application/pdf')]), requirement('e2', [asType(submission(1), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')])]);
      const rows = Array.from(fixture.nativeElement.querySelectorAll('tbody tr')) as HTMLElement[];
      expect(rows[0].querySelector('[data-preview-open]')).not.toBeNull();
      expect(rows[1].querySelector('[data-preview-open]')).toBeNull();
      expect(rows[1].querySelector('[data-download]')).not.toBeNull();
    });

    it('asks for an inline link and shows a PDF in a frame, without opening a tab nor storing the url anywhere else', () => {
      const view = setup('admin_empresa', true);
      api.download.and.returnValue(link('https://storage/x.pdf?sig=1'));
      const open = spyOn(window, 'open');
      view.openPreview(submission(2));
      fixture.detectChanges();
      expect(api.download).toHaveBeenCalledWith('s2', 'inline');
      expect(open).not.toHaveBeenCalled();
      expect(q('[data-preview-pdf]')?.getAttribute('src')).toBe('https://storage/x.pdf?sig=1');
    });

    it('shows an image with an <img>, not a frame', () => {
      const view = setup('admin_empresa', true);
      api.download.and.returnValue(link('https://storage/x.png?sig=1'));
      view.openPreview(asType(submission(1), 'image/png'));
      fixture.detectChanges();
      expect(q('[data-preview-image]')?.getAttribute('src')).toBe('https://storage/x.png?sig=1');
      expect(q('[data-preview-pdf]')).toBeNull();
    });

    it('refuses a link that is not http(s): nothing is put in the frame', () => {
      const view = setup('admin_empresa', true);
      api.download.and.returnValue(link('javascript:alert(1)'));
      view.openPreview(submission(2));
      fixture.detectChanges();
      expect(view.previewFailed()).toBeTrue();
      expect(q('[data-preview-pdf]')).toBeNull();
      expect(q('[data-preview-error]')).not.toBeNull();
    });

    it('asks for another link when the first one expires, without closing the viewer', () => {
      const view = setup('admin_empresa', true);
      api.download.and.returnValues(link('https://storage/1'), link('https://storage/2'));
      view.openPreview(submission(2));
      view.refreshPreview();
      fixture.detectChanges();
      expect(api.download).toHaveBeenCalledTimes(2);
      expect(view.previewOf()?.id).toBe('s2');
      expect(q('[data-preview-pdf]')?.getAttribute('src')).toBe('https://storage/2');
    });

    it('shows an error with a retry when the link cannot be made, and clears everything on close', () => {
      const view = setup('admin_empresa', true);
      api.download.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
      view.openPreview(submission(2));
      fixture.detectChanges();
      expect(q('[data-preview-error]')).not.toBeNull();
      view.closePreview();
      fixture.detectChanges();
      expect(view.previewOf()).toBeNull();
      expect(view.previewUrl()).toBeNull();
      expect(q('[data-preview-error]')).toBeNull();
    });

    it('falls back to the download when the server says that type cannot be shown (422 disposition.not_supported)', () => {
      const view = setup('admin_empresa', true);
      const refusal = new HttpErrorResponse({ status: 422, error: { error: { code: 'VALIDATION_FAILED', fields: [{ field: 'disposition', code: 'disposition.not_supported', message: 'x' }] } } });
      api.download.and.returnValues(throwError(() => refusal), of({ url: 'https://storage/dl', file_name: 'a.pdf', expires_in: 300 }));
      const open = spyOn(window, 'open');
      view.openPreview(submission(2));
      expect(api.download.calls.allArgs()).toEqual([['s2', 'inline'], ['s2', 'attachment']]);
      expect(open).toHaveBeenCalledWith('https://storage/dl', '_blank', 'noopener');
      expect(view.previewOf()).toBeNull();
    });
  });

  describe('under a documentary test of the control (D88)', () => {
    const T1 = { id: 'tid-1', code: 'T-DOC-001', display_name: 'Revisión de diseño' };
    const T2 = { id: 'tid-2', code: 'T-DOC-002', display_name: 'Ejecución durante el período' };
    const own = (id: string, test: typeof T1 | null): EvidenceRequirement => ({ ...requirement(id), origin: 'own', test });

    function under(items: EvidenceRequirement[], canUpload = true, shared: { id: string; code: string }[] = []): ControlEvidence {
      const view = setup('admin_empresa', canUpload, items);
      api.listForTest.and.returnValue(of({ test_id: T1.id, shared_with: shared, items }));
      fixture.componentRef.setInput('dimension', 'policy');
      fixture.componentRef.setInput('embedded', true);
      fixture.componentRef.setInput('testId', T1.id);
      fixture.detectChanges();
      return view;
    }

    it('asks the server for the evidence of THIS test, not the whole control', () => {
      under([]);
      expect(api.listForTest).toHaveBeenCalledWith('c1', 'tid-1', 'technical'); // la vista técnica es del admin de la empresa y del auditor
    });

    it('tells which other controls the test also applies to, with their codes visible (D85)', () => {
      under([{ ...own('mine', T1), submissions: [submission(1)] }], true, [{ id: 'k2', code: 'IAC-12' }, { id: 'k3', code: 'IAC-4' }]);
      const note = fixture.nativeElement.querySelector('[data-shared-with]') as HTMLElement;
      expect(note).not.toBeNull();
      expect(note.textContent).toContain('COMPLIANCE.EVIDENCE.SHARED_WITH');
    });

    it('says nothing about sharing when the test is only in this control', () => {
      under([own('mine', T1)]);
      expect(fixture.nativeElement.querySelector('[data-shared-with]')).toBeNull();
    });

    it('for a test of any dimension it uses the same centered block with the upload and the sharing note (MD-499)', () => {
      const view = setup('admin_empresa', true, []);
      const mine = { ...own('a', { id: 'tid-9', code: 'T-SRV-009', display_name: 'Servidores' }), dimension: 'server', submissions: [submission(1)] };
      api.listForTest.and.returnValue(of({ test_id: 'tid-9', shared_with: [{ id: 'k2', code: 'IAC-12' }], items: [mine] }));
      fixture.componentRef.setInput('dimension', 'server');
      fixture.componentRef.setInput('embedded', true);
      fixture.componentRef.setInput('testId', 'tid-9');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-test-evidence-block] [data-upload-open]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[data-shared-with]')).not.toBeNull();
      expect(view.documentary()).toBeTrue();
    });

    it('ignores a slow answer for a previous test when the test changes', () => {
      const view = setup('admin_empresa', true, []);
      const slow = new Subject<{ test_id: string; shared_with: []; items: EvidenceRequirement[] }>();
      api.listForTest.and.returnValues(slow, of({ test_id: 'tid-2', shared_with: [], items: [] }));
      fixture.componentRef.setInput('dimension', 'policy');
      fixture.componentRef.setInput('testId', 'tid-1');
      fixture.detectChanges();
      fixture.componentRef.setInput('testId', 'tid-2');
      fixture.detectChanges();
      slow.next({ test_id: 'tid-1', shared_with: [], items: [{ ...own('old', { ...T1, id: 'tid-1' }), submissions: [submission(9)] }] });
      fixture.detectChanges();
      expect(view.items().length).toBe(0);
    });

    it('shows only what was delivered for THIS test: not another test of the control, not the document the catalog suggests', () => {
      under([{ ...own('mine', T1), submissions: [submission(1)] }, { ...own('other', T2), submissions: [submission(7)] }, requirement('suggested')]);
      expect(text()).toContain('politica-v1.pdf');
      expect(text()).not.toContain('politica-v7.pdf');
      expect(text()).not.toContain('Documento suggested');
      // Bajo la prueba, la instrucción la dice una vez la lista de pruebas, no cada bloque (MD-499).
      expect(fixture.nativeElement.querySelector('[data-per-control-note]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-test-evidence-block] [data-evidence-state]')).not.toBeNull();
    });

    it('on a test with the evidence fallback it says there is no integration connected and keeps the upload block (MD-499)', () => {
      under([own('mine', T1)]);
      expect(fixture.nativeElement.querySelector('[data-fallback-tag]')).toBeNull();
      fixture.componentRef.setInput('fallback', true);
      fixture.componentRef.setInput('dimension', 'cloud');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-fallback-tag]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[data-fallback-note]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[data-test-evidence-block] [data-upload-open]')).not.toBeNull();
    });

    it('with nothing delivered yet it says so and offers "upload evidence" straight away, with nothing to prepare first', () => {
      under([own('other', T2)]);
      // Una sola unidad: el estado «Sin subir» y la acción principal en la misma cabecera del bloque (MD-499).
      const block = fixture.nativeElement.querySelector('[data-test-evidence-block]') as HTMLElement;
      expect(block.querySelector('[data-empty]')!.textContent).toContain('COMPLIANCE.EVIDENCE.NOT_UPLOADED');
      expect(block.querySelector('[data-upload-open]')!.className).toContain('mk-btn-sm');
      // Centrado, a todo el alto: estado arriba, lo que se espera en medio y la acción abajo (Rod).
      expect(block.className).toContain('justify-center');
      expect(block.querySelector('[data-evidence-expected]')).not.toBeNull();
      expect(block.lastElementChild!.hasAttribute('data-upload-open')).toBeTrue();
      expect(fixture.nativeElement.querySelector('[data-upload-open]').textContent).toContain('COMPLIANCE.EVIDENCE.UPLOAD');
      expect(fixture.nativeElement.querySelector('[data-upload-open]').textContent).not.toContain('UPLOAD_NEW');
    });

    it('offers "new version" once there is something delivered, and nothing to a role that cannot upload', () => {
      under([{ ...own('mine', T1), submissions: [submission(2), submission(1)] }]);
      expect(fixture.nativeElement.querySelector('[data-upload-open]').textContent).toContain('COMPLIANCE.EVIDENCE.UPLOAD_NEW');
      TestBed.resetTestingModule();
      under([own('mine', T1)], false);
      expect(fixture.nativeElement.querySelector('[data-upload-open]')).toBeNull();
    });

    it('uploads the file for THIS test of the control in one step, reloads and tells the drawer', () => {
      const view = under([]);
      api.uploadForTest.and.returnValue(of(submission(1)));
      let changed = 0;
      view.changed.subscribe(() => changed++);
      const file = new File(['x'], 'politica.pdf', { type: 'application/pdf' });

      view.startUpload('__test__');
      view.file.set(file);
      view.send();

      expect(api.uploadForTest).toHaveBeenCalledWith('c1', 'tid-1', file);
      expect(api.upload).not.toHaveBeenCalled();
      expect(view.uploadingFor()).toBeNull();
      expect(toastText()).toContain('COMPLIANCE.EVIDENCE.UPLOADED');
      expect(api.listForTest).toHaveBeenCalledTimes(2); // la carga de la prueba y la recarga tras subir
      expect(changed).toBe(1);
    });

    it('keeps the message of the backend when the upload fails, and the form open', () => {
      const view = under([]);
      api.uploadForTest.and.returnValue(throwError(() => new HttpErrorResponse({ status: 415, error: { message: 'Ese tipo de archivo no está permitido.', error: { code: 'UNSUPPORTED_MEDIA_TYPE' } } })));
      view.startUpload('__test__');
      view.file.set(new File(['x'], 'raro.exe'));
      view.send();
      expect(view.error()).toBe('Ese tipo de archivo no está permitido.');
      expect(view.uploadingFor()).toBe('__test__');
    });
  });

  describe('suggested documents of the catalog', () => {
    it('lists them as a guide only, with no upload and none of the deliveries of any test', () => {
      setup('admin_empresa', true, [requirement('guide'), { ...requirement('mine'), origin: 'own', test: { id: 'tid-1', code: 'T-DOC-001', display_name: null } }]);
      fixture.componentRef.setInput('dimension', 'policy');
      fixture.componentRef.setInput('suggested', true);
      fixture.detectChanges();
      const box = fixture.nativeElement.querySelector('[data-suggested]');
      expect(box.textContent).toContain('Documento guide');
      expect(box.textContent).not.toContain('Documento mine');
      expect(fixture.nativeElement.querySelector('[data-upload-open]')).toBeNull();
    });
  });
  it('waits for the backend before showing anything while it loads', () => {
    api = jasmine.createSpyObj<EvidenceService>('EvidenceService', ['list', 'listForTest', 'upload', 'download', 'uploadForTest']);
    api.list.and.returnValue(NEVER);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ControlEvidence], providers: [provideTranslateService(), { provide: EvidenceService, useValue: api }] });
    fixture = TestBed.createComponent(ControlEvidence);
    fixture.componentRef.setInput('controlId', 'c1');
    fixture.detectChanges();
    expect(fixture.componentInstance.stage()).toBe('loading');
  });
});
