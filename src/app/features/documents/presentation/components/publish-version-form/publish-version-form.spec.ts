import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { NEVER, of, throwError } from 'rxjs';
import { DocumentVersion } from '@features/documents/domain/models/document.models';
import { DocumentService } from '@features/documents/domain/services/document.service';
import { PublishVersionForm } from './publish-version-form';

const VERSION = { id: 'v3', number: 3 } as DocumentVersion;
const FILE = new File(['contenido'], 'politica.pdf', { type: 'application/pdf' });

describe('PublishVersionForm (D133 punto 5, D152)', () => {
  let api: jasmine.SpyObj<DocumentService>;
  let fixture: ComponentFixture<PublishVersionForm>;
  let form: PublishVersionForm;

  function setup(assignedCount = 0): void {
    api = jasmine.createSpyObj<DocumentService>('DocumentService', ['publishVersion']);
    api.publishVersion.and.returnValue(of(VERSION));
    TestBed.configureTestingModule({ imports: [PublishVersionForm], providers: [provideTranslateService({ fallbackLang: 'es' }), { provide: DocumentService, useValue: api }] });
    fixture = TestBed.createComponent(PublishVersionForm);
    fixture.componentRef.setInput('documentId', 'd1');
    fixture.componentRef.setInput('assignedCount', assignedCount);
    fixture.detectChanges();
    form = fixture.componentInstance;
  }
  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(s: string) => el().querySelector<T>(s);
  const type = (selector: string, value: string, index = 0) => {
    const input = el().querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(selector)[index];
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const fillAll = () => {
    form.file.set(FILE);
    form.approvedAt.set('2026-11-20');
    fixture.detectChanges();
    type('[data-test-approver-name]', 'Ana Ruiz');
    type('[data-test-approver-role]', 'Gerente general');
  };
  const submit = () => {
    q<HTMLFormElement>('#publish-form')!.requestSubmit();
    fixture.detectChanges();
  };

  it('needs the file, a day that is not in the future and a name and position for every approver', () => {
    setup();
    expect(form.canSubmit()).toBeFalse();
    form.file.set(FILE);
    form.approvedAt.set('2026-11-20');
    expect(form.canSubmit()).toBeFalse(); // faltan el aprobador
    type('[data-test-approver-name]', 'Ana Ruiz');
    expect(form.canSubmit()).toBeFalse(); // y su cargo
    type('[data-test-approver-role]', 'Gerente general');
    expect(form.canSubmit()).toBeTrue();
    form.approvedAt.set('2999-01-01');
    expect(form.canSubmit()).toBeFalse(); // una fecha futura no vale (approved_at.future)
  });

  it('lets from one to three approvers: adds up to three and removes down to one', () => {
    setup();
    expect(el().querySelectorAll('[data-test-approver]').length).toBe(1);
    expect(q('[data-test-remove-approver]')).toBeNull(); // el único no se quita
    q<HTMLButtonElement>('[data-test-add-approver]')!.click();
    fixture.detectChanges();
    q<HTMLButtonElement>('[data-test-add-approver]')!.click();
    fixture.detectChanges();
    expect(el().querySelectorAll('[data-test-approver]').length).toBe(3);
    expect(q('[data-test-add-approver]')).toBeNull(); // el tope es tres (approvers.array.max)
    q<HTMLButtonElement>('[data-test-remove-approver]')!.click();
    fixture.detectChanges();
    expect(el().querySelectorAll('[data-test-approver]').length).toBe(2);
  });

  it('removing the one in the middle keeps what was written in the others', () => {
    setup();
    q<HTMLButtonElement>('[data-test-add-approver]')!.click();
    q<HTMLButtonElement>('[data-test-add-approver]')!.click();
    fixture.detectChanges();
    ['Ana', 'Beto', 'Carla'].forEach((name, i) => type('[data-test-approver-name]', name, i));
    el().querySelectorAll<HTMLButtonElement>('[data-test-remove-approver]')[1].click();
    fixture.detectChanges();
    expect(form.approvers().map((a) => a.name)).toEqual(['Ana', 'Carla']);
  });

  it('sends the file, the day, the approvers as text and the note, and tells the parent which version was published', () => {
    setup();
    const published = jasmine.createSpy('published');
    form.published.subscribe(published);
    fillAll();
    type('[data-test-note]', 'Acta 12 de noviembre');
    submit();
    expect(api.publishVersion).toHaveBeenCalledOnceWith('d1', { file: FILE, approved_at: '2026-11-20', approvers: [{ name: 'Ana Ruiz', role_label: 'Gerente general' }], note: 'Acta 12 de noviembre' });
    expect(published).toHaveBeenCalledOnceWith(VERSION);
  });

  it('does not send anything while it is incomplete', () => {
    setup();
    submit();
    expect(api.publishVersion).not.toHaveBeenCalled();
  });

  it('keeps what was written and shows the message of the server when it refuses (file too large, wrong type, external document…)', () => {
    setup();
    api.publishVersion.and.returnValue(throwError(() => new HttpErrorResponse({ status: 413, error: { message: 'El archivo supera los 25 MB.', error: { code: 'FILE_TOO_LARGE' } } })));
    fillAll();
    submit();
    expect(q('[data-test-form-error]')!.textContent).toContain('El archivo supera los 25 MB.');
    expect(form.canSubmit()).toBeTrue();
    expect(form.saving()).toBeFalse();
  });

  it('is busy while the call runs, and a second submit is ignored', () => {
    setup();
    api.publishVersion.and.returnValue(NEVER);
    fillAll();
    submit();
    submit();
    expect(form.saving()).toBeTrue();
    expect(api.publishVersion).toHaveBeenCalledTimes(1);
  });

  it('warns that the people who already have it will have to accept the new version, only when there are any', () => {
    setup(4);
    expect(q('[data-test-reaccept]')!.textContent).toContain('DOCUMENTS.PUBLISH.REACCEPT');
    TestBed.resetTestingModule();
    setup(0);
    expect(q('[data-test-reaccept]')).toBeNull();
  });

  it('counts the note as 0/500 and updates the counter as it is written, with the hint next to it', () => {
    setup();
    expect(q('[data-test-note-count]')!.textContent!.trim()).toBe('0/500');
    expect(q('#publish-note-hint')!.textContent).toContain('DOCUMENTS.PUBLISH.NOTE_HINT');
    expect(q('[data-test-note]')!.getAttribute('maxlength')).toBe('500');
    type('[data-test-note]', 'Cambios del trimestre');
    expect(q('[data-test-note-count]')!.textContent!.trim()).toBe('21/500');
  });

  it('is dirty as soon as anything is written, so closing the modal asks first', () => {
    setup();
    expect(form.dirty()).toBeFalse();
    type('[data-test-note]', 'x');
    expect(form.dirty()).toBeTrue();
  });
});
