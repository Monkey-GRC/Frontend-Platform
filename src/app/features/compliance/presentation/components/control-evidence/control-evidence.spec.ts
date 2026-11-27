import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { NEVER, Observable, Subject, of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { ControlEvidence as Summary } from '@features/compliance/domain/models/control.models';
import { EvidenceRequirement, EvidenceSubmission, EvidenceUploadEvent } from '@features/compliance/domain/models/evidence.models';
import { ControlManagementService } from '@features/compliance/domain/services/control-management.service';
import { EvidenceService } from '@features/compliance/domain/services/evidence.service';
import { ControlEvidence, UPLOAD_IDLE_MS } from './control-evidence';
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

const management: { listOccurrences: unknown } = { listOccurrences: () => of([{ id: 'oc1', requirement: { id: 'r1', code: 'IDA-11' }, occurred_on: '2026-11-20', description: 'Alta de proveedor', has_evidence: false }]) };

describe('ControlEvidence', () => {
  let api: jasmine.SpyObj<EvidenceService>;
  let fixture: ComponentFixture<ControlEvidence>;

  function setup(role: string, canUpload: boolean, items: EvidenceRequirement[] | 'missing' | 'down' = [requirement('e1', [submission(2), submission(1)]), requirement('e2')]): ControlEvidence {
    api = jasmine.createSpyObj<EvidenceService>('EvidenceService', ['list', 'listForTest', 'upload', 'download', 'uploadForTest']);
    api.list.and.returnValue(items === 'missing' ? throwError(() => new HttpErrorResponse({ status: 404 })) : items === 'down' ? throwError(() => new HttpErrorResponse({ status: 500 })) : of(items));
    TestBed.configureTestingModule({ imports: [ControlEvidence], providers: [provideTranslateService(), { provide: EvidenceService, useValue: api }, { provide: ControlManagementService, useValue: management }] });
    TestBed.inject(SessionService).set({ id: 'u1', email: 'a@x.com', name: null, last_name: null, role }, { id: 'c', name: 'ACME' });
    fixture = TestBed.createComponent(ControlEvidence);
    fixture.componentRef.setInput('controlId', 'c1');
    fixture.componentRef.setInput('summary', SUMMARY);
    fixture.componentRef.setInput('canUpload', canUpload);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const done = (n: number) => of({ kind: 'done' as const, submission: submission(n) });
  const zones = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[data-dropzone]'));
  const fileInput = (i = 0) => (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[type="file"]')[i];
  function choose(file: File, i = 0): void {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = fileInput(i);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }
  const pdf = (name = 'acta.pdf') => new File(['x'], name, { type: 'application/pdf' });
  const q = (selector: string) => (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(selector);
  /** «Subir» (or «Reintentar») in the preview of the chosen file. */
  function confirm(): void {
    q('[data-upload-file]')!.click();
    fixture.detectChanges();
  }
  /** Choose a file and upload it from its preview. */
  function chooseAndSend(file: File, i = 0): void {
    choose(file, i);
    confirm();
  }

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

  it('shows the drop zone straight away to the roles that can upload, with the types line, and nothing to a role that cannot', () => {
    setup('admin_empresa', true);
    expect(zones().length).toBe(2);
    expect(fixture.nativeElement.querySelector('[data-upload-open]')).toBeNull();
    const zone = zones()[1];
    expect(zone.getAttribute('aria-describedby')).toBe('evidence-e2-types');
    expect(fixture.nativeElement.querySelector('#evidence-e2-types').textContent).toContain('COMMON.FILE.ACCEPTED');
    expect(zones()[0].textContent).toContain('COMPLIANCE.EVIDENCE.REPLACE_HINT');
    expect(zone.textContent).toContain('COMMON.FILE.DROP_OR_CLICK');
    TestBed.resetTestingModule();
    setup('auditor', false);
    expect(zones().length).toBe(0);
  });

  it('opens the system file picker with a click, Enter or Space on the zone', () => {
    setup('admin_empresa', true);
    const click = spyOn(fileInput(1), 'click');
    zones()[1].click();
    zones()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    zones()[1].dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(click).toHaveBeenCalledTimes(3);
  });

  it('shows a preview of the chosen file (name, type, size) and sends nothing until «Subir»', () => {
    setup('admin_empresa', true);
    choose(pdf('Política de accesos.pdf'), 1);
    expect(api.upload).not.toHaveBeenCalled();
    const preview = q('[data-file-preview]')!;
    expect(preview.querySelector('[data-file-name]')!.textContent).toContain('Política de accesos.pdf');
    expect(preview.querySelector('[data-file-meta]')!.textContent).toContain('PDF');
    expect(preview.querySelector('[data-file-meta]')!.textContent).toContain('1 B');
    expect(preview.querySelector('[data-file-icon]')!.textContent).toContain('picture_as_pdf');
    expect(preview.querySelector('[data-upload-file]')!.textContent).toContain('COMPLIANCE.EVIDENCE.UPLOAD_FILE');
    expect(preview.querySelector('[data-change-file]')).not.toBeNull();
    // Quitar vuelve a la zona, sin subir nada.
    (preview.querySelector('[data-remove-file]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(q('[data-file-preview]')).toBeNull();
    expect(zones().length).toBe(2);
    expect(api.upload).not.toHaveBeenCalled();
  });

  it('shows a thumbnail when the file is an image', () => {
    setup('admin_empresa', true);
    choose(new File(['x'], 'captura.png', { type: 'image/png' }), 1);
    const thumb = q('[data-file-preview] [data-file-thumb]') as HTMLImageElement;
    expect(thumb).not.toBeNull();
    expect(thumb.getAttribute('src')).toMatch(/^blob:/);
  });

  it('«Cambiar archivo» opens the picker again and the new file replaces the preview', () => {
    setup('admin_empresa', true);
    choose(pdf('uno.pdf'), 1);
    const click = spyOn(fileInput(1), 'click');
    q('[data-change-file]')!.click();
    expect(click).toHaveBeenCalled();
    choose(pdf('dos.pdf'), 1);
    expect(q('[data-file-preview] [data-file-name]')!.textContent).toContain('dos.pdf');
  });

  it('uploads on «Subir» with the real progress (percent), then a moving bar while the server saves, then success, reload and the drawer told', () => {
    const view = setup('admin_empresa', true);
    const upload = new Subject<EvidenceUploadEvent>();
    api.upload.and.returnValue(upload);
    let changed = 0;
    view.changed.subscribe(() => changed++);
    const file = pdf();

    chooseAndSend(file, 1);
    expect(api.upload).toHaveBeenCalledOnceWith('e2', file);
    expect(q('[data-uploading] [data-file-name]')!.textContent).toContain('acta.pdf');
    expect(q('[data-upload-state]')!.textContent).toContain('COMPLIANCE.EVIDENCE.UPLOADING');
    expect(q('[data-uploading] [data-cancel]')).not.toBeNull();
    expect(q('[data-uploading] [data-upload-file]')).toBeNull();
    // Before the first progress event there is no figure yet: a moving bar, not a still 0 %.
    expect(q('[data-upload-indeterminate]')).not.toBeNull();
    upload.next({ kind: 'progress', percent: 40 });
    fixture.detectChanges();
    expect(q('[data-uploading] [data-value]')!.getAttribute('data-value')).toBe('40');
    expect(q('[data-upload-percent]')!.textContent).toContain('COMPLIANCE.EVIDENCE.UPLOAD_PERCENT');
    expect(q('[data-upload-indeterminate]')).toBeNull();
    // Bytes sent, server still saving: never a full, still bar.
    upload.next({ kind: 'progress', percent: 100 });
    fixture.detectChanges();
    expect(q('[data-upload-state]')!.textContent).toContain('COMPLIANCE.EVIDENCE.PROCESSING');
    expect(q('[data-upload-indeterminate]')).not.toBeNull();
    expect(q('[data-upload-percent]')).toBeNull();
    upload.next({ kind: 'done', submission: submission(3) });
    upload.complete();
    fixture.detectChanges();

    expect(view.uploadingFor()).toBeNull();
    expect(q('[data-uploading]')).toBeNull();
    expect(q('[data-file-preview]')).toBeNull();
    expect(zones().length).toBe(2);
    const ok = q('[data-message][data-tone="success"]')!;
    expect(ok.textContent).toContain('COMPLIANCE.EVIDENCE.UPLOADED_FILE');
    // El éxito se dice en la propia zona, sin toast duplicado.
    expect(toastText()).not.toContain('COMPLIANCE.EVIDENCE.UPLOADED');
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(changed).toBe(1);
  });

  it('without a known total the bar is indeterminate and animated, not a full bar', () => {
    setup('admin_empresa', true);
    const upload = new Subject<EvidenceUploadEvent>();
    api.upload.and.returnValue(upload);
    chooseAndSend(pdf(), 1);
    upload.next({ kind: 'progress', percent: null });
    fixture.detectChanges();
    expect(q('[data-upload-indeterminate]')).not.toBeNull();
    expect(q('[data-uploading] app-progress-line')).toBeNull();
    expect(q('[data-upload-state]')!.textContent).toContain('COMPLIANCE.EVIDENCE.UPLOADING');
  });

  it('never stays in «Subiendo…»: with no news from the upload it fails with a message and «Reintentar»', fakeAsync(() => {
    const view = setup('admin_empresa', true);
    api.upload.and.returnValue(new Observable<EvidenceUploadEvent>(() => undefined));
    chooseAndSend(pdf(), 1);
    expect(q('[data-uploading]')).not.toBeNull();
    tick(UPLOAD_IDLE_MS);
    fixture.detectChanges();
    expect(view.sending()).toBeFalse();
    expect(q('[data-uploading]')).toBeNull();
    expect(q('[data-file-preview] [data-message]')!.textContent).toContain('COMPLIANCE.EVIDENCE.UPLOAD_TIMEOUT');
    expect(q('[data-upload-file]')!.textContent).toContain('COMMON.RETRY');
    api.upload.and.returnValue(done(1));
    confirm();
    expect(api.upload).toHaveBeenCalledTimes(2);
    flush();
  }));

  it('does not send a file of a wrong type or too big, and says why in the zone', () => {
    setup('admin_empresa', true);
    choose(new File(['x'], 'raro.exe'), 1);
    expect(api.upload).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-problem]').textContent).toContain('COMMON.FILE.ERROR_TYPE');
    const big = pdf('grande.pdf');
    Object.defineProperty(big, 'size', { value: 26 * 1024 * 1024 });
    choose(big, 1);
    expect(api.upload).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-problem]').textContent).toContain('COMMON.FILE.ERROR_SIZE');
  });

  it('cancels the upload in course: aborts the request and says so in the zone', () => {
    const view = setup('admin_empresa', true);
    let aborted = false;
    api.upload.and.returnValue(new Observable<EvidenceUploadEvent>(() => () => (aborted = true)));
    chooseAndSend(pdf(), 1);
    (fixture.nativeElement.querySelector('[data-cancel]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(aborted).toBeTrue();
    expect(view.sending()).toBeFalse();
    // The file stays in its preview, ready to upload again.
    expect(q('[data-file-preview] [data-upload-file]')!.textContent).toContain('COMPLIANCE.EVIDENCE.UPLOAD_FILE');
    const note = fixture.nativeElement.querySelector('[data-message]') as HTMLElement;
    expect(note.textContent).toContain('COMPLIANCE.EVIDENCE.UPLOAD_CANCELED');
    expect(note.getAttribute('data-tone')).toBe('info');
    expect(note.className).not.toContain('text-bad-ink');
    expect(api.list).toHaveBeenCalledTimes(1);
    api.upload.and.returnValue(done(1));
    choose(pdf('otra.pdf'), 1);
    expect(fixture.nativeElement.querySelector('[data-message]')).toBeNull();
  });

  it('keeps the message of the backend in the zone when the upload fails, and lets you try again', () => {
    const view = setup('admin_empresa', true);
    api.upload.and.returnValue(throwError(() => new HttpErrorResponse({ status: 415, error: { message: 'Ese tipo de archivo no está permitido.', error: { code: 'UNSUPPORTED_MEDIA_TYPE' } } })));
    chooseAndSend(pdf(), 1);
    expect(fixture.nativeElement.querySelector('[data-message]').textContent).toContain('Ese tipo de archivo no está permitido.');
    expect(fixture.nativeElement.querySelector('[data-message]').getAttribute('data-tone')).toBe('error');
    expect(view.uploadingFor()).toBeNull();
    // Every error ends with «Reintentar» on the same file.
    expect(q('[data-upload-file]')!.textContent).toContain('COMMON.RETRY');
    confirm();
    expect(api.upload).toHaveBeenCalledTimes(2);
    api.upload.and.returnValue(done(1));
    choose(pdf('otra.pdf'), 1);
    expect(fixture.nativeElement.querySelector('[data-message]')).toBeNull();
    confirm();
    expect(api.upload).toHaveBeenCalledTimes(3);
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
      expect(fixture.nativeElement.querySelector('[data-test-evidence-block] [data-dropzone]')).not.toBeNull();
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
      expect(fixture.nativeElement.querySelector('[data-test-evidence-block] [data-dropzone]')).not.toBeNull();
    });

    it('with nothing delivered yet it says so and offers "upload evidence" straight away, with nothing to prepare first', () => {
      under([own('other', T2)]);
      // Una sola unidad: el estado «Sin subir» y la acción principal en la misma cabecera del bloque (MD-499).
      const block = fixture.nativeElement.querySelector('[data-test-evidence-block]') as HTMLElement;
      expect(block.querySelector('[data-empty]')!.textContent).toContain('COMPLIANCE.EVIDENCE.NOT_UPLOADED');
      // Centrado, a todo el alto: estado arriba, lo que se espera en medio y la zona de carga abajo (Rod).
      expect(block.className).toContain('justify-center');
      expect(block.querySelector('[data-evidence-expected]')).not.toBeNull();
      expect(block.lastElementChild!.hasAttribute('data-upload-zone')).toBeTrue();
      expect(block.querySelector('[data-dropzone]')!.textContent).toContain('COMMON.FILE.DROP_OR_CLICK');
    });

    it('invites to replace once there is something delivered, and shows no zone to a role that cannot upload', () => {
      under([{ ...own('mine', T1), submissions: [submission(2), submission(1)] }]);
      expect(fixture.nativeElement.querySelector('[data-dropzone]').textContent).toContain('COMPLIANCE.EVIDENCE.REPLACE_HINT');
      TestBed.resetTestingModule();
      under([own('mine', T1)], false);
      expect(fixture.nativeElement.querySelector('[data-dropzone]')).toBeNull();
    });

    it('asks for the case when the test serves an on-demand requirement: the zone is blocked until one is chosen, then sends it with the file (DT-115)', () => {
      const view = under([]);
      fixture.componentRef.setInput('occurrenceRequirementId', 'r1');
      fixture.detectChanges();
      api.uploadForTest.and.returnValue(done(1));
      expect(fixture.nativeElement.querySelector('[data-field="occurrence"]')).not.toBeNull();
      expect(zones()[0].getAttribute('aria-disabled')).toBe('true');
      expect(zones()[0].textContent).toContain('COMPLIANCE.APPROVAL.OCCURRENCE.ERR_CASE');
      const file = pdf();
      view.send('__test__', file);
      expect(api.uploadForTest).not.toHaveBeenCalled();
      view.occurrenceId.set('oc1');
      fixture.detectChanges();
      expect(zones()[0].getAttribute('aria-disabled')).toBe('false');
      chooseAndSend(file);
      expect(api.uploadForTest).toHaveBeenCalledWith('c1', 'tid-1', file, 'oc1');
    });

    describe('cases of an on-demand requirement', () => {
      const CASE = { id: 'oc1', requirement: { id: 'r1', code: 'IDA-11' }, occurred_on: '2026-11-20', description: 'Alta de proveedor', has_evidence: false };
      const original = management.listOccurrences;
      afterEach(() => (management.listOccurrences = original));

      it('asks for the cases when the card shows, with no click needed', () => {
        const list = jasmine.createSpy('listOccurrences').and.returnValue(of([CASE]));
        management.listOccurrences = list;
        const view = under([]);
        fixture.componentRef.setInput('occurrenceRequirementId', 'r1');
        fixture.detectChanges();
        expect(list).toHaveBeenCalledOnceWith('c1', 'r1');
        expect(view.occurrences().map((o) => o.id)).toEqual(['oc1']);
      });

      it('shows a skeleton region for the cases in a blocked zone while they load', () => {
        const pending = new Subject<never[]>();
        management.listOccurrences = () => pending;
        under([]);
        fixture.componentRef.setInput('occurrenceRequirementId', 'r1');
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-occurrences-loading]')).not.toBeNull();
        expect(zones()[0].getAttribute('aria-disabled')).toBe('true');
        expect(fixture.nativeElement.querySelector('[data-field="occurrence"]')).toBeNull();
      });

      it('warns to register a case first when the list comes empty: no selector and a blocked zone', () => {
        management.listOccurrences = () => of([]);
        under([]);
        fixture.componentRef.setInput('occurrenceRequirementId', 'r1');
        fixture.detectChanges();
        expect(zones()[0].textContent).toContain('COMPLIANCE.APPROVAL.OCCURRENCE.NONE_FIRST');
        expect(zones()[0].getAttribute('aria-disabled')).toBe('true');
        expect(fixture.nativeElement.querySelector('[data-field="occurrence"]')).toBeNull();
      });

      it('asks again when the detail of the control changes, so a case registered in between shows up', () => {
        const list = jasmine.createSpy('listOccurrences').and.returnValues(of([]), of([CASE]));
        management.listOccurrences = list;
        const view = under([]);
        fixture.componentRef.setInput('occurrenceRequirementId', 'r1');
        fixture.detectChanges();
        expect(view.occurrences()).toEqual([]);
        fixture.componentRef.setInput('summary', [...SUMMARY]);
        fixture.detectChanges();
        expect(list).toHaveBeenCalledTimes(2);
        expect(view.occurrences().map((o) => o.id)).toEqual(['oc1']);
        expect(fixture.nativeElement.querySelector('[data-field="occurrence"]')).not.toBeNull();
      });

      it('ignores the cases of an older request that arrive after a newer one', () => {
        const old = new Subject<never[]>();
        const fresh = new Subject<never[]>();
        management.listOccurrences = jasmine.createSpy('listOccurrences').and.returnValues(old, fresh) as never;
        const view = under([]);
        fixture.componentRef.setInput('occurrenceRequirementId', 'r1');
        fixture.detectChanges();
        fixture.componentRef.setInput('summary', [...SUMMARY]);
        fixture.detectChanges();
        fresh.next([{ id: 'new', occurred_on: '2026-11-20', description: 'n' }] as never);
        old.next([{ id: 'old', occurred_on: '2026-11-19', description: 'o' }] as never);
        expect(view.occurrences().map((o) => o.id)).toEqual(['new']);
      });

      it('does not ask for the cases to a role that cannot upload', () => {
        const list = jasmine.createSpy('listOccurrences').and.returnValue(of([]));
        management.listOccurrences = list;
        under([], false);
        fixture.componentRef.setInput('occurrenceRequirementId', 'r1');
        fixture.detectChanges();
        expect(list).not.toHaveBeenCalled();
      });

      it('shows its own message on a 422 occurrence_id.invalid instead of the generic one', () => {
        management.listOccurrences = () => of([CASE]);
        const view = under([]);
        fixture.componentRef.setInput('occurrenceRequirementId', 'r1');
        fixture.detectChanges();
        view.occurrenceId.set('oc1');
        api.uploadForTest.and.returnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { error: { fields: [{ field: 'occurrence_id', code: 'occurrence_id.invalid', message: 'x' }] } } })));
        fixture.detectChanges();
        chooseAndSend(pdf());
        expect(fixture.nativeElement.querySelector('[data-message]').textContent).toContain('COMPLIANCE.APPROVAL.OCCURRENCE.ERR_INVALID');
      });
    });

    it('does not ask for a case when the test is not of an on-demand requirement', () => {
      under([]);
      expect(fixture.nativeElement.querySelector('[data-field="occurrence"]')).toBeNull();
      expect(zones()[0].getAttribute('aria-disabled')).toBe('false');
    });

    it('uploads the file for THIS test of the control in one step, reloads and tells the drawer', () => {
      const view = under([]);
      api.uploadForTest.and.returnValue(done(1));
      let changed = 0;
      view.changed.subscribe(() => changed++);
      const file = pdf('politica.pdf');

      chooseAndSend(file);

      expect(api.uploadForTest).toHaveBeenCalledWith('c1', 'tid-1', file, null);
      expect(api.upload).not.toHaveBeenCalled();
      expect(view.uploadingFor()).toBeNull();
      expect(q('[data-message][data-tone="success"]')?.textContent).toContain('COMPLIANCE.EVIDENCE.UPLOADED_FILE');
      expect(toastText()).not.toContain('COMPLIANCE.EVIDENCE.UPLOADED');
      expect(api.listForTest).toHaveBeenCalledTimes(2); // la carga de la prueba y la recarga tras subir
      expect(changed).toBe(1);
    });

    it('keeps the message of the backend in the zone when the upload fails', () => {
      const view = under([]);
      api.uploadForTest.and.returnValue(throwError(() => new HttpErrorResponse({ status: 415, error: { message: 'Ese tipo de archivo no está permitido.', error: { code: 'UNSUPPORTED_MEDIA_TYPE' } } })));
      chooseAndSend(pdf());
      expect(fixture.nativeElement.querySelector('[data-message]').textContent).toContain('Ese tipo de archivo no está permitido.');
      expect(view.uploadingFor()).toBeNull();
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
      expect(fixture.nativeElement.querySelector('[data-dropzone]')).toBeNull();
    });
  });
  it('waits for the backend before showing anything while it loads', () => {
    api = jasmine.createSpyObj<EvidenceService>('EvidenceService', ['list', 'listForTest', 'upload', 'download', 'uploadForTest']);
    api.list.and.returnValue(NEVER);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ControlEvidence], providers: [provideTranslateService(), { provide: EvidenceService, useValue: api }, { provide: ControlManagementService, useValue: management }] });
    fixture = TestBed.createComponent(ControlEvidence);
    fixture.componentRef.setInput('controlId', 'c1');
    fixture.detectChanges();
    expect(fixture.componentInstance.stage()).toBe('loading');
  });
});
