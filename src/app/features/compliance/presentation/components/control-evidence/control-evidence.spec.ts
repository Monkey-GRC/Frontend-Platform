import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { NEVER, of, throwError } from 'rxjs';
import { SessionService } from '@core/domain/services/session.service';
import { ControlEvidence as Summary } from '../../../domain/models/control.models';
import { EvidenceRequirement, EvidenceSubmission } from '../../../domain/models/evidence.models';
import { EvidenceService } from '../../../domain/services/evidence.service';
import { ControlEvidence } from './control-evidence';

const person = { id: 'u1', name: 'Laura', last_name: 'Gómez' };
const submission = (version: number, status: EvidenceSubmission['validation_status'] = 'pending', note: string | null = null): EvidenceSubmission => ({
  id: `s${version}`, version, file_name: `politica-v${version}.pdf`, file_type: 'application/pdf', file_size: 482113, integrity_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  validation_status: status, submitted_by: person, submitted_at: '2026-10-14T17:05:12Z', approved_by: null, approved_at: null, decision_note: note, ai: null,
});
const requirement = (id: string, submissions: EvidenceSubmission[] = []): EvidenceRequirement => ({
  id, code: `EV-${id}`, sequence: 1, description: `Documento ${id}`, dimension: 'policy', validity_within_period: 'Dentro del período de evaluación', origin: 'catalog',
  responsible: { id: 'r1', type: 'compliance', person_name: 'Marta Ruiz' }, submissions,
});
const SUMMARY: Summary[] = [{ requirement_id: 'e9', description: 'Política de accesos', responsible: null, latest_submission: { id: 's1', version: 2, validation_status: 'pending' } }];

describe('ControlEvidence', () => {
  let api: jasmine.SpyObj<EvidenceService>;
  let fixture: ComponentFixture<ControlEvidence>;

  function setup(role: string, canUpload: boolean, items: EvidenceRequirement[] | 'missing' | 'down' = [requirement('e1', [submission(2), submission(1)]), requirement('e2')]): ControlEvidence {
    api = jasmine.createSpyObj<EvidenceService>('EvidenceService', ['list', 'upload', 'download']);
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

  it('shows only the latest version and the previous ones when asked, the latest first', () => {
    const view = setup('admin_empresa', true);
    expect(text()).not.toContain('politica-v1.pdf');
    view.toggleVersions('e1');
    fixture.detectChanges();
    expect(text()).toContain('politica-v1.pdf');
  });

  it('shows the note of a rejected evidence so the user knows what to fix', () => {
    setup('admin_empresa', true, [requirement('e1', [submission(1, 'rejected', 'No está firmado por la dirección.')])]);
    expect(text()).toContain('COMPLIANCE.EVIDENCE.REJECTED_NOTE');
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
    expect(view.notice()).not.toBeNull();
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
    expect(api.download).toHaveBeenCalledWith('s2');
    expect(open).toHaveBeenCalledWith('https://storage/x', '_blank', 'noopener');
  });

  it('waits for the backend before showing anything while it loads', () => {
    api = jasmine.createSpyObj<EvidenceService>('EvidenceService', ['list', 'upload', 'download']);
    api.list.and.returnValue(NEVER);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ControlEvidence], providers: [provideTranslateService(), { provide: EvidenceService, useValue: api }] });
    fixture = TestBed.createComponent(ControlEvidence);
    fixture.componentRef.setInput('controlId', 'c1');
    fixture.detectChanges();
    expect(fixture.componentInstance.stage()).toBe('loading');
  });
});
